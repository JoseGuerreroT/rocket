import { notifyTeam } from '../../agent/notifyTeam.js'
import type { ChatwootConfig, Tenant } from '../../tenants/types.js'
import type { Channel } from '../types.js'

import type { ChatwootConversation, ChatwootStatus } from './types.js'

const ESCALATED_LABEL = 'escalado'

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
    phoneE164: string
): ChatwootChannel => {
    const api = conversationApi(chatwoot, conversation.id)
    return {
        key: `${tenant.id}:${phoneE164.replace(/\D/g, '')}`,
        phoneE164,
        acknowledge: async () => {
            try {
                await api.post('/toggle_typing_status', { typing_status: 'on' })
            } catch (error) {
                console.warn('[rocket] No se pudo mostrar "escribiendo":', error)
            }
        },
        botOwnsConversation: async () => (await api.status()) === 'pending',
        sendText: async (text) => {
            await api.post('/messages', { content: text, message_type: 'outgoing' })
        },
        takeOver: async () => {
            await api.post('/toggle_status', { status: 'open' })
        },
        handoff: async (motivo) => {
            await api.post('/messages', { content: `🙋 El bot pasa la conversación: ${motivo}`, private: true })
            await api.post('/labels', { labels: [...new Set([...(conversation.labels ?? []), ESCALATED_LABEL])] })
            await api.post('/toggle_status', { status: 'open' })
            await notifyTeam(tenant, phoneE164, motivo)
        }
    }
}
