import type Anthropic from '@anthropic-ai/sdk'

export type History = Anthropic.Beta.BetaMessageParam[]

/**
 * La memoria de Rocket. `key` es la conversación (`<negocio>:<teléfono>`).
 *
 * El historial se guarda completo y solo se le agregan mensajes: Claude rechaza o ignora
 * su razonamiento si se edita lo anterior. Vence tras un día sin mensajes, igual que la
 * ventana de 24 horas de WhatsApp, y entonces la conversación empieza de cero.
 */
export type Store = {
    /** `true` la primera vez que se ve el mensaje. Meta reintenta los webhooks. */
    markSeen(messageId: string): Promise<boolean>
    /** Guarda el texto y lo marca como el último mensaje de la conversación. */
    pushInbox(key: string, text: string, messageId: string): Promise<void>
    /** Id del último mensaje que entró a la bandeja: decide quién responde tras la espera. */
    lastInboxMessage(key: string): Promise<string | undefined>
    drainInbox(key: string): Promise<string[]>
    inboxSize(key: string): Promise<number>
    /**
     * Lo que pasó mientras una persona atendía (sus mensajes y los del cliente). El bot no
     * los vio; se le pasan como contexto cuando la conversación vuelve a él.
     */
    pushNote(key: string, text: string): Promise<void>
    drainNotes(key: string): Promise<string[]>
    acquireLock(key: string): Promise<boolean>
    releaseLock(key: string): Promise<void>
    getHistory(key: string): Promise<History>
    saveHistory(key: string, history: History): Promise<void>
}

export const SEEN_TTL_S = 24 * 60 * 60
export const HISTORY_TTL_S = 24 * 60 * 60
/** Más que una respuesta lenta de Claude: si el proceso muere, el candado se libera solo. */
export const LOCK_TTL_S = 180
