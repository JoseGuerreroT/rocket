/** Todo lo que Rocket sabe de un negocio. Lo demás (catálogo, precios, reservas) vive en su MCP. */
export type Tenant = {
    id: string
    name: string
    whatsapp: {
        phoneNumberId: string
        token?: string
    }
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
