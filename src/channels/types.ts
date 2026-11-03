/**
 * Por dónde entra y sale una conversación. La lógica de `conversation.ts` no sabe si el
 * cliente llegó directo por la Cloud API de Meta o a través de una bandeja de Chatwoot.
 */
export type ChannelKind = 'whatsapp' | 'messenger' | 'instagram'

export type Channel = {
    /** Conversación estable por negocio y cliente (`<negocio>:<teléfono>`). */
    key: string
    kind: ChannelKind
    /**
     * Quién escribe, para el token del MCP: la IA nunca lo elige. En WhatsApp, el teléfono en
     * E.164; en Instagram y Messenger no hay teléfono y va el contacto (`chatwoot:<id>`), con el
     * que el MCP solo deja consultar, no reservar.
     */
    clientId: string
    /** Nombre del perfil (WhatsApp, Instagram, Facebook), tal como lo puso el cliente. Puede no ser un nombre. */
    clientName?: string
    /** Marca el mensaje como leído o muestra "escribiendo…". No es crítico. */
    acknowledge(): Promise<void>
    /** `false` si una persona del equipo tomó la conversación: el bot no responde. */
    botOwnsConversation(): Promise<boolean>
    sendText(text: string): Promise<void>
    /** Pasa la conversación a una persona. Se llama después de enviar la última respuesta del bot. */
    handoff(motivo: string): Promise<void>
}
