import { createHmac, timingSafeEqual } from 'node:crypto'

/** Meta firma el cuerpo crudo con el secreto de la app: `X-Hub-Signature-256: sha256=<hex>`. */
export const isValidSignature = (rawBody: string, header: string | undefined, appSecret: string): boolean => {
    if (!header?.startsWith('sha256=')) return false
    const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest()
    const received = Buffer.from(header.slice('sha256='.length), 'hex')
    return received.length === expected.length && timingSafeEqual(received, expected)
}
