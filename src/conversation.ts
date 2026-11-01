import { runTurn } from './agent/agent.js'
import type { Channel } from './channels/types.js'
import { getStore } from './store/index.js'
import type { Tenant } from './tenants/types.js'

/** Un mensaje del cliente, ya sacado del webhook de su canal. */
export type IncomingText = {
    /** Id del mensaje en el canal: Meta y Chatwoot reintentan, y así no se responde dos veces. */
    id: string
    /** Sin texto legible (foto, audio, ubicación): el MVP solo lee texto. */
    text?: string
}

/**
 * En WhatsApp la gente parte una idea en varios mensajes seguidos. Se espera este tiempo
 * desde el último antes de responder, para contestar todo junto y no una vez por mensaje.
 */
const QUIET_MS = 4000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Lo que pasó con una persona del equipo va antes del mensaje nuevo: el bot no lo vio. */
const withNotes = (notes: string[], text: string): string =>
    notes.length
        ? `[Mientras una persona del equipo atendía esta conversación:\n${notes.join('\n')}]\n\n${text}`
        : text

/** Responde a lo acumulado en la bandeja. Si falla, el cliente recibe un aviso y el chat pasa a una persona. */
const answer = async (tenant: Tenant, channel: Channel, userText: string): Promise<void> => {
    try {
        if (!(await channel.botOwnsConversation())) return
        const history = await getStore().getHistory(channel.key)
        const notes = await getStore().drainNotes(channel.key)
        const result = await runTurn({
            tenant,
            phoneE164: channel.phoneE164,
            history,
            userText: withNotes(notes, userText)
        })
        await getStore().saveHistory(channel.key, result.history)
        // Si una persona tomó el chat mientras Claude pensaba, la respuesta no sale.
        if (!(await channel.botOwnsConversation())) return
        await channel.sendText(result.reply)
        if (result.handoff !== undefined) await channel.handoff(result.handoff)
    } catch (error) {
        console.error('[rocket] Error al responder:', error)
        await channel.sendText(tenant.replies.error)
        await channel.handoff('El bot falló al responder; revisar la conversación.')
    }
}

/**
 * Una sola respuesta a la vez por conversación. Si el cliente manda tres mensajes seguidos,
 * el primero se responde y los otros dos se juntan en el turno siguiente. Tras soltar el
 * candado se vuelve a mirar la bandeja: un mensaje que llegó justo en ese momento no se pierde.
 */
const processInbox = async (tenant: Tenant, channel: Channel): Promise<void> => {
    const { key } = channel
    while (await getStore().acquireLock(key)) {
        try {
            for (let texts = await getStore().drainInbox(key); texts.length; texts = await getStore().drainInbox(key)) {
                await answer(tenant, channel, texts.join('\n'))
            }
        } finally {
            await getStore().releaseLock(key)
        }
        if (!(await getStore().inboxSize(key))) return
    }
}

export const handleIncoming = async (tenant: Tenant, channel: Channel, message: IncomingText): Promise<void> => {
    if (!(await getStore().markSeen(message.id))) return

    await channel.acknowledge()
    if (!message.text) {
        await channel.sendText(tenant.replies.onlyText)
        return
    }

    await getStore().pushInbox(channel.key, message.text, message.id)
    await sleep(QUIET_MS)
    // Si llegó otro mensaje durante la espera, responde quien lo recibió.
    if ((await getStore().lastInboxMessage(channel.key)) !== message.id) return
    await processInbox(tenant, channel)
}
