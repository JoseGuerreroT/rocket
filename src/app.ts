import { waitUntil } from '@vercel/functions'
import { Hono } from 'hono'

import { parseWebhook } from './channels/whatsapp/parse.js'
import { isValidSignature } from './channels/whatsapp/signature.js'
import type { WhatsAppWebhookPayload } from './channels/whatsapp/types.js'
import { requireEnv } from './config.js'
import { handleIncoming } from './conversation.js'

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
    const work = Promise.allSettled(messages.map(handleIncoming)).then((results) =>
        results
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            .forEach((r) => console.error('[rocket] Error procesando un mensaje:', r.reason))
    )
    waitUntil(work)
    return c.text('ok')
})

/** Entrada para Vercel: su detección de Hono toma `src/app.ts` y usa el export por defecto. */
export default app
