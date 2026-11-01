/**
 * Lo mínimo del webhook del Agent Bot de Chatwoot que lee Rocket. Chatwoot le manda al bot
 * todos los mensajes de la bandeja: los del cliente, los del propio bot y los del equipo.
 * Formato: `Message#webhook_data` y `Conversations::EventDataPresenter` (Chatwoot v4.19).
 */
export type ChatwootSender = {
    /** `user` (persona del equipo) o `agent_bot`. El cliente no lo trae. */
    type?: string
    phone_number?: string | null
}

export type ChatwootStatus = 'open' | 'pending' | 'resolved' | 'snoozed'

export type ChatwootConversation = {
    /** Id visible en la cuenta: el que usa la API. */
    id: number
    status: ChatwootStatus
    labels?: string[]
    meta?: { sender?: ChatwootSender }
}

export type ChatwootWebhookPayload = {
    event: string
    id?: number
    content?: string | null
    message_type?: 'incoming' | 'outgoing' | 'template' | 'activity'
    private?: boolean
    /** En WhatsApp, el `wamid` del mensaje en Meta. */
    source_id?: string | null
    sender?: ChatwootSender
    conversation?: ChatwootConversation
}
