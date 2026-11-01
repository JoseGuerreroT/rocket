import type { Tenant } from '../tenants/types.js'

/** Aviso al equipo en Slack, si el negocio lo configuró. Nunca bloquea la respuesta al cliente. */
export const notifyTeam = async (tenant: Tenant, phoneE164: string, motivo: string): Promise<void> => {
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
