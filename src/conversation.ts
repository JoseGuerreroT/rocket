import { runTurn } from './agent/agent.js'
import { markReadWithTyping, sendText } from './channels/whatsapp/send.js'
import type { IncomingMessage } from './channels/whatsapp/types.js'
import { store } from './store/index.js'
import { findTenantByPhoneNumberId } from './tenants/index.js'
import type { Tenant } from './tenants/types.js'

const conversationKey = (tenant: Tenant, waId: string) => `${tenant.id}:${waId}`

/** Responde a lo acumulado en la bandeja. Si falla, el cliente recibe el contacto del equipo. */
const answer = async (tenant: Tenant, waId: string, key: string, userText: string): Promise<void> => {
    try {
        const history = await store.getHistory(key)
        const result = await runTurn({ tenant, phoneE164: `+${waId}`, history, userText })
        await store.saveHistory(key, result.history)
        await sendText(tenant, waId, result.reply)
    } catch (error) {
        console.error('[rocket] Error al responder:', error)
        await sendText(tenant, waId, tenant.replies.error)
    }
}

/**
 * Una sola respuesta a la vez por conversación. Si el cliente manda tres mensajes seguidos,
 * el primero se responde y los otros dos se juntan en el turno siguiente. Tras soltar el
 * candado se vuelve a mirar la bandeja: un mensaje que llegó justo en ese momento no se pierde.
 */
const processInbox = async (tenant: Tenant, waId: string, key: string): Promise<void> => {
    while (await store.acquireLock(key)) {
        try {
            for (let texts = await store.drainInbox(key); texts.length; texts = await store.drainInbox(key)) {
                await answer(tenant, waId, key, texts.join('\n'))
            }
        } finally {
            await store.releaseLock(key)
        }
        if (!(await store.inboxSize(key))) return
    }
}

export const handleIncoming = async (message: IncomingMessage): Promise<void> => {
    const tenant = findTenantByPhoneNumberId(message.phoneNumberId)
    if (!tenant) {
        console.warn('[rocket] Mensaje para un número sin negocio:', message.phoneNumberId)
        return
    }
    if (!(await store.markSeen(message.id))) return

    await markReadWithTyping(tenant, message.id)
    if (!message.text) {
        await sendText(tenant, message.from, tenant.replies.onlyText)
        return
    }

    const key = conversationKey(tenant, message.from)
    await store.pushInbox(key, message.text)
    await processInbox(tenant, message.from, key)
}
