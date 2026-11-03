import { notifyTeam } from '../../agent/notifyTeam.js'
import type { ChatwootConfig, Tenant } from '../../tenants/types.js'
import { splitMessage } from '../split.js'
import type { Channel, ChannelKind } from '../types.js'
import { markReadWithTyping } from '../whatsapp/send.js'

import type { ChatwootClient, ChatwootConversation, ChatwootStatus } from './types.js'

const ESCALATED_LABEL = 'escalado'

/** Lo que acepta cada red por mensaje (Chatwoot, "supported features"). WhatsApp: 4.096, de sobra. */
const MAX_CHARS: Record<ChannelKind, number> = { whatsapp: 4096, messenger: 2000, instagram: 1000 }

/** El token del Agent Bot solo puede ver la conversación, responder, cambiar estado y etiquetas. */
const conversationApi = (chatwoot: ChatwootConfig, conversationId: number) => {
    const base = `${chatwoot.url}/api/v1/accounts/${chatwoot.accountId}/conversations/${conversationId}`
    const request = async <T>(path: string, init?: { method: 'POST'; body: unknown }): Promise<T> => {
        const response = await fetch(`${base}${path}`, {
            method: init?.method ?? 'GET',
            headers: { api_access_token: chatwoot.botToken, 'content-type': 'application/json' },
            body: init && JSON.stringify(init.body)
        })
        const body = await response.text()
        if (!response.ok) throw new Error(`Chatwoot ${response.status} ${path}: ${body}`)
        // Algunas acciones (escribiendo…) responden 200 sin cuerpo.
        return (body ? JSON.parse(body) : undefined) as T
    }
    return {
        status: async () => (await request<{ status: ChatwootStatus }>('')).status,
        post: (path: string, body: unknown) => request(path, { method: 'POST', body })
    }
}

export type ChatwootChannel = Channel & {
    /** Una persona del equipo toma la conversación: deja de ser del bot. */
    takeOver(): Promise<void>
}

/**
 * La conversación es del bot mientras está `pending`. Una persona la toma al pasarla a
 * `open`, y la devuelve al bot pasándola otra vez a `pending`.
 */
export const createChatwootChannel = (
    tenant: Tenant,
    chatwoot: ChatwootConfig,
    conversation: ChatwootConversation,
    client: ChatwootClient,
    whatsappMessageId?: string
): ChatwootChannel => {
    const api = conversationApi(chatwoot, conversation.id)
    return {
        key: `${tenant.id}:${client.keyId}`,
        kind: client.kind,
        clientId: client.clientId,
        clientName: client.name,
        // Chatwoot muestra "escribiendo" solo en su bandeja; en el WhatsApp del cliente lo pide Rocket a Meta.
        acknowledge: async () => {
            if (tenant.whatsapp && whatsappMessageId) await markReadWithTyping(tenant.whatsapp, whatsappMessageId)
        },
        botOwnsConversation: async () => (await api.status()) === 'pending',
        sendText: async (text) => {
            for (const content of splitMessage(text, MAX_CHARS[client.kind])) {
                await api.post('/messages', { content, message_type: 'outgoing' })
            }
        },
        takeOver: async () => {
            await api.post('/toggle_status', { status: 'open' })
        },
        handoff: async (motivo) => {
            await api.post('/messages', { content: `🙋 El bot pasa la conversación: ${motivo}`, private: true })
            await api.post('/labels', { labels: [...new Set([...(conversation.labels ?? []), ESCALATED_LABEL])] })
            await api.post('/toggle_status', { status: 'open' })
            await notifyTeam(tenant, client.label, motivo)
        }
    }
}
