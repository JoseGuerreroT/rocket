import { graphApiUrl } from '../../config.js'
import type { WhatsAppConfig } from '../../tenants/types.js'

/** WhatsApp corta en 4.096 caracteres. El bot escribe corto, pero por si acaso. */
const MAX_LENGTH = 4000

const post = async (whatsapp: WhatsAppConfig, body: Record<string, unknown>): Promise<void> => {
    if (!whatsapp.token) {
        console.info('[rocket] Sin WHATSAPP_TOKEN, no se envía:', JSON.stringify(body))
        return
    }
    const response = await fetch(graphApiUrl(`${whatsapp.phoneNumberId}/messages`), {
        method: 'POST',
        headers: { authorization: `Bearer ${whatsapp.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...body })
    })
    if (!response.ok) throw new Error(`Cloud API ${response.status}: ${await response.text()}`)
}

const chunks = (text: string): string[] => {
    const parts: string[] = []
    for (let i = 0; i < text.length; i += MAX_LENGTH) parts.push(text.slice(i, i + MAX_LENGTH))
    return parts
}

export const sendText = async (whatsapp: WhatsAppConfig, to: string, text: string): Promise<void> => {
    for (const part of chunks(text)) {
        await post(whatsapp, { to, type: 'text', text: { body: part, preview_url: true } })
    }
}

/** Marca el mensaje como leído y muestra "escribiendo…" mientras Claude responde. No es crítico. */
export const markReadWithTyping = async (whatsapp: WhatsAppConfig, messageId: string): Promise<void> => {
    try {
        await post(whatsapp, { status: 'read', message_id: messageId, typing_indicator: { type: 'text' } })
    } catch (error) {
        console.warn('[rocket] No se pudo marcar como leído:', error)
    }
}
