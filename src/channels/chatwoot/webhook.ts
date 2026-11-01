import { handleIncoming } from '../../conversation.js'
import { getStore } from '../../store/index.js'
import type { ChatwootConfig, Tenant } from '../../tenants/types.js'

import { type ChatwootChannel, createChatwootChannel } from './channel.js'
import type { ChatwootWebhookPayload } from './types.js'

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

    const phoneE164 = conversation.meta?.sender?.phone_number
    if (!phoneE164) {
        console.warn('[rocket] Conversación de Chatwoot sin teléfono:', conversation.id)
        return
    }
    const channel = createChatwootChannel(tenant, chatwoot, conversation, phoneE164)
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
