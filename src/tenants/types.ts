export type WhatsAppConfig = {
    phoneNumberId: string
    token?: string
}

export type ChatwootConfig = {
    /** `https://chat.fluver.co`, sin barra al final. */
    url: string
    accountId: string
    /** Token del Agent Bot: solo puede responder, cambiar estado y etiquetas. */
    botToken: string
    /** Firma los webhooks del Agent Bot (`X-Chatwoot-Signature`). */
    webhookSecret: string
}

/** Todo lo que Rocket sabe de un negocio. Lo demás (catálogo, precios, reservas) vive en su MCP. */
export type Tenant = {
    id: string
    name: string
    /** Cloud API directo, sin bandeja. */
    whatsapp?: WhatsAppConfig
    /** Bandeja de Chatwoot: Meta le entrega a Chatwoot y Chatwoot al bot (Agent Bot). */
    chatwoot?: ChatwootConfig
    mcp: {
        url: string
        secret: string
    }
    /** Cómo habla el bot de este negocio. Va después de las reglas fijas de la plataforma. */
    voice: string
    escalation: {
        slackWebhookUrl?: string
    }
    replies: {
        /** Cuando llega una foto, un audio o una ubicación: el MVP solo lee texto. */
        onlyText: string
        /** Cuando algo falla y el bot no puede responder. */
        error: string
    }
}
