import { waitUntil } from '@vercel/functions'
import { Hono } from 'hono'

import { isValidChatwootSignature } from './channels/chatwoot/signature.js'
import type { ChatwootWebhookPayload } from './channels/chatwoot/types.js'
import { handleChatwootEvent } from './channels/chatwoot/webhook.js'
import { createWhatsAppChannel } from './channels/whatsapp/channel.js'
import { parseWebhook } from './channels/whatsapp/parse.js'
import { isValidSignature } from './channels/whatsapp/signature.js'
import type { IncomingMessage, WhatsAppWebhookPayload } from './channels/whatsapp/types.js'
import { requireEnv } from './config.js'
import { handleIncoming } from './conversation.js'
import { findTenantById, findTenantByPhoneNumberId } from './tenants/index.js'

export const app = new Hono()

app.get('/', (c) => c.text('rocket'))

/** Verificación del webhook al registrarlo en Meta. */
app.get('/webhooks/whatsapp', (c) => {
    const mode = c.req.query('hub.mode')
    const token = c.req.query('hub.verify_token')
    if (mode !== 'subscribe' || token !== requireEnv('WHATSAPP_VERIFY_TOKEN')) return c.text('forbidden', 403)
    return c.text(c.req.query('hub.challenge') ?? '')
})

/**
 * Responde 200 de inmediato y procesa después: Meta reintenta si tardamos, y Claude tarda
 * segundos. En Vercel, `waitUntil` mantiene viva la función; en local la promesa corre igual.
 */
app.post('/webhooks/whatsapp', async (c) => {
    const rawBody = await c.req.text()
    if (!isValidSignature(rawBody, c.req.header('x-hub-signature-256'), requireEnv('WHATSAPP_APP_SECRET'))) {
        return c.text('invalid signature', 401)
    }

    const messages = parseWebhook(JSON.parse(rawBody) as WhatsAppWebhookPayload)
    waitUntil(logFailures(Promise.allSettled(messages.map(handleWhatsAppMessage))))
    return c.text('ok')
})

/**
 * Agent Bot de Chatwoot, uno por negocio. Igual que con Meta: 200 de inmediato y el trabajo
 * en segundo plano. Si Rocket fallara al recibir, Chatwoot pasaría la conversación a una persona.
 */
app.post('/webhooks/chatwoot/:tenant', async (c) => {
    const tenant = findTenantById(c.req.param('tenant'))
    if (!tenant?.chatwoot) return c.text('not found', 404)

    const rawBody = await c.req.text()
    const valid = isValidChatwootSignature(
        rawBody,
        c.req.header('x-chatwoot-signature'),
        c.req.header('x-chatwoot-timestamp'),
        tenant.chatwoot.webhookSecret
    )
    if (!valid) return c.text('invalid signature', 401)

    const payload = JSON.parse(rawBody) as ChatwootWebhookPayload
    waitUntil(logFailures(Promise.allSettled([handleChatwootEvent(tenant, tenant.chatwoot, payload)])))
    return c.text('ok')
})

const handleWhatsAppMessage = async (message: IncomingMessage): Promise<void> => {
    const tenant = findTenantByPhoneNumberId(message.phoneNumberId)
    if (!tenant?.whatsapp) {
        console.warn('[rocket] Mensaje para un número sin negocio:', message.phoneNumberId)
        return
    }
    await handleIncoming(tenant, createWhatsAppChannel(tenant, tenant.whatsapp, message), message)
}

const logFailures = (work: Promise<PromiseSettledResult<void>[]>): Promise<void> =>
    work.then((results) =>
        results
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            .forEach((r) => console.error('[rocket] Error procesando un mensaje:', r.reason))
    )

/** Entrada para Vercel: su detección de Hono toma `src/app.ts` y usa el export por defecto. */
export default app
