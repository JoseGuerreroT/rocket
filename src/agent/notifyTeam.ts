import type { Tenant } from '../tenants/types.js'

/** Aviso al equipo en Slack, si el negocio lo configuró. Nunca bloquea la respuesta al cliente. */
/** `client`: cómo lo reconoce el equipo, el teléfono o la red y el nombre (`Instagram · Ana`). */
export const notifyTeam = async (tenant: Tenant, client: string, motivo: string): Promise<void> => {
    if (!tenant.escalation.slackWebhookUrl) return
    try {
        await fetch(tenant.escalation.slackWebhookUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: `🙋 El bot pasa a una persona: ${client}\nMotivo: ${motivo}` })
        })
    } catch (error) {
        console.warn('[rocket] No se pudo avisar en Slack:', error)
    }
}
