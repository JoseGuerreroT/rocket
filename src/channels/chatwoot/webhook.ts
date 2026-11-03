import { handleIncoming } from '../../conversation.js'
import { getStore } from '../../store/index.js'
import type { ChatwootConfig, Tenant } from '../../tenants/types.js'

import { type ChatwootChannel, createChatwootChannel } from './channel.js'
import type { ChatwootClient, ChatwootConversation, ChatwootWebhookPayload } from './types.js'

const SOCIAL_NAMES = { messenger: 'Messenger', instagram: 'Instagram' } as const

/**
 * WhatsApp se reconoce por el teléfono. En la bandeja de Facebook (Messenger e Instagram) no
 * hay teléfono: el cliente es su contacto de Chatwoot. Otras bandejas, por ahora, no.
 */
const clientOf = (conversation: ChatwootConversation): ChatwootClient | undefined => {
    const sender = conversation.meta?.sender
    if (conversation.channel === 'Channel::FacebookPage') {
        if (!sender?.id) return undefined
        const kind = conversation.additional_attributes?.type === 'instagram_direct_message' ? 'instagram' : 'messenger'
        const name = sender.name || `contacto ${sender.id}`
        return { kind, clientId: `chatwoot:${sender.id}`, keyId: `cw${sender.id}`, label: `${SOCIAL_NAMES[kind]} · ${name}`, name: sender.name || undefined }
    }
    const phone = sender?.phone_number
    if (!phone) return undefined
    return { kind: 'whatsapp', clientId: phone, keyId: phone.replace(/\D/g, ''), label: phone, name: sender?.name || undefined }
}

/** `incoming` siempre es del cliente. Su `sender` no trae `type` (`Contact#webhook_data`). */
const isFromClient = (payload: ChatwootWebhookPayload) => payload.message_type === 'incoming'

const isFromTeam = (payload: ChatwootWebhookPayload) =>
    payload.message_type === 'outgoing' && payload.sender?.type === 'user'

/**
 * Una persona escribió en un chat que todavía era del bot: lo toma. Así basta con responder
 * desde la app, sin cambiar antes el estado a mano.
 */
const takeOverFromBot = async (channel: ChatwootChannel, payload: ChatwootWebhookPayload, text: string) => {
    await getStore().pushNote(channel.key, `Equipo: ${text}`)
    if (payload.conversation?.status === 'pending') await channel.takeOver()
}

/**
 * Chatwoot le manda al bot todo lo que pasa en la bandeja. El bot solo responde mensajes del
 * cliente en conversaciones `pending`; de lo demás guarda el texto como contexto para cuando
 * la conversación vuelva a él. Las notas privadas y los mensajes del propio bot se ignoran.
 */
export const handleChatwootEvent = async (
    tenant: Tenant,
    chatwoot: ChatwootConfig,
    payload: ChatwootWebhookPayload
): Promise<void> => {
    const { conversation } = payload
    if (payload.event !== 'message_created' || payload.private || !conversation) return

    const client = clientOf(conversation)
    if (!client) {
        console.warn('[rocket] Conversación de Chatwoot sin cliente reconocible:', conversation.id, conversation.channel)
        return
    }
    const whatsappMessageId = client.kind === 'whatsapp' ? payload.source_id ?? undefined : undefined
    const channel = createChatwootChannel(tenant, chatwoot, conversation, client, whatsappMessageId)
    const text = payload.content?.trim() || undefined

    if (isFromClient(payload)) {
        if (conversation.status === 'pending') {
            await handleIncoming(tenant, channel, { id: `chatwoot:${payload.id}`, text })
        } else if (text) {
            await getStore().pushNote(channel.key, `Cliente: ${text}`)
        }
        return
    }
    if (isFromTeam(payload) && text) await takeOverFromBot(channel, payload, text)
}
