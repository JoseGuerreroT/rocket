/**
 * Simula un webhook de Meta firmado contra el servidor local.
 *   yarn simulate "Hola, ¿cuánto vale ir a Playa Cristal?" [573000000001] [text|image]
 * Sin WHATSAPP_TOKEN, las respuestas se imprimen en la consola del servidor en vez de enviarse.
 */
import { createHmac, randomUUID } from 'node:crypto'

const [text = 'Hola', from = '573000000001', type = 'text'] = process.argv.slice(2)
const url = process.env.SIMULATE_URL ?? 'http://localhost:8787/webhooks/whatsapp'
const secret = process.env.WHATSAPP_APP_SECRET ?? ''
const phoneNumberId = process.env.FLUVER_WHATSAPP_PHONE_NUMBER_ID ?? ''

// SIMULATE_ID fijo para probar un reintento de Meta: el segundo envío debe ignorarse.
const id = process.env.SIMULATE_ID ?? `wamid.${randomUUID()}`
const message = type === 'text'
    ? { id, from, type: 'text', text: { body: text } }
    : { id, from, type, [type]: { id: 'media-id' } }

const body = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
        changes: [{
            field: 'messages',
            value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: phoneNumberId },
                contacts: [{ wa_id: from, profile: { name: 'Prueba' } }],
                messages: [message]
            }
        }]
    }]
})
const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`

const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature },
    body
})
console.info(response.status, await response.text(), message.id)
