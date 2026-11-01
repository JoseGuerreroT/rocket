import { createHmac, timingSafeEqual } from 'node:crypto'

/** Más viejo que esto se rechaza: alguien podría estar reenviando un webhook capturado. */
const MAX_AGE_S = 5 * 60

/**
 * Chatwoot firma `"<timestamp>.<cuerpo crudo>"` con el secreto del Agent Bot:
 * `X-Chatwoot-Signature: sha256=<hex>` y `X-Chatwoot-Timestamp` (`lib/webhooks/trigger.rb`).
 */
export const isValidChatwootSignature = (
    rawBody: string,
    header: string | undefined,
    timestamp: string | undefined,
    secret: string
): boolean => {
    if (!header?.startsWith('sha256=') || !timestamp) return false
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_AGE_S) return false
    const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest()
    const received = Buffer.from(header.slice('sha256='.length), 'hex')
    return received.length === expected.length && timingSafeEqual(received, expected)
}
