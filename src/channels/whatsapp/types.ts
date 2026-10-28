/** Un mensaje entrante, ya sacado del webhook de Meta. */
export type IncomingMessage = {
    id: string
    /** Número del negocio que lo recibió: identifica al tenant. */
    phoneNumberId: string
    /** `wa_id` del cliente, sin `+` (`573001234567`). */
    from: string
    profileName?: string
    type: string
    /** Texto legible, si lo hay: un texto, o el título del botón o de la opción elegida. */
    text?: string
}

/** Lo mínimo del webhook de la Cloud API que lee Rocket. */
export type WhatsAppWebhookPayload = {
    object?: string
    entry?: Array<{
        changes?: Array<{
            field?: string
            value?: {
                metadata?: { phone_number_id?: string }
                contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>
                messages?: Array<WhatsAppMessage>
            }
        }>
    }>
}

export type WhatsAppMessage = {
    id: string
    from: string
    type: string
    text?: { body?: string }
    button?: { text?: string }
    interactive?: {
        button_reply?: { title?: string }
        list_reply?: { title?: string }
    }
}
