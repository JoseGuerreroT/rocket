/**
 * Por dónde entra y sale una conversación. La lógica de `conversation.ts` no sabe si el
 * cliente llegó directo por la Cloud API de Meta o a través de una bandeja de Chatwoot.
 */
export type Channel = {
    /** Conversación estable por negocio y cliente (`<negocio>:<teléfono>`). */
    key: string
    /** Teléfono del cliente en E.164. Va al token del MCP: la IA nunca lo elige. */
    phoneE164: string
    /** Marca el mensaje como leído o muestra "escribiendo…". No es crítico. */
    acknowledge(): Promise<void>
    /** `false` si una persona del equipo tomó la conversación: el bot no responde. */
    botOwnsConversation(): Promise<boolean>
    sendText(text: string): Promise<void>
    /** Pasa la conversación a una persona. Se llama después de enviar la última respuesta del bot. */
    handoff(motivo: string): Promise<void>
}
