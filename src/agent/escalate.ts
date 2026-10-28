import type Anthropic from '@anthropic-ai/sdk'

import type { Tenant } from '../tenants/types.js'

export const ESCALATE_TOOL_NAME = 'escalar_a_humano'

export const escalateTool: Anthropic.Beta.BetaTool = {
    name: ESCALATE_TOOL_NAME,
    description:
        'Pasa la conversación a una persona del equipo. Úsala ante quejas, reembolsos, errores de una herramienta, algo que no puedas resolver, o si el cliente pide hablar con una persona.',
    input_schema: {
        type: 'object',
        properties: {
            motivo: { type: 'string', description: 'Qué necesita el cliente, en una frase, para quien lo atienda' }
        },
        required: ['motivo'],
        additionalProperties: false
    },
    strict: true
}

/** Aviso al equipo en Slack, si el negocio lo configuró. Nunca bloquea la respuesta al cliente. */
const notifySlack = async (tenant: Tenant, phoneE164: string, motivo: string): Promise<void> => {
    if (!tenant.escalation.slackWebhookUrl) return
    try {
        await fetch(tenant.escalation.slackWebhookUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: `🙋 El bot de WhatsApp pasa a una persona: ${phoneE164}\nMotivo: ${motivo}` })
        })
    } catch (error) {
        console.warn('[rocket] No se pudo avisar en Slack:', error)
    }
}

/**
 * MVP sin Chatwoot: nadie lee este número, así que el cliente recibe el WhatsApp del equipo.
 * Con Chatwoot, esto abrirá la conversación para que la tome una persona.
 */
export const escalate = async (tenant: Tenant, phoneE164: string, motivo: string): Promise<string> => {
    await notifySlack(tenant, phoneE164, motivo)
    return `Listo. Dile al cliente que una persona del equipo lo atiende por este WhatsApp: https://wa.me/${tenant.escalation.humanWhatsapp}`
}
