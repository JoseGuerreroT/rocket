import { notifyTeam } from '../../agent/notifyTeam.js'
import type { Tenant, WhatsAppConfig } from '../../tenants/types.js'
import type { Channel } from '../types.js'

import { markReadWithTyping, sendText } from './send.js'
import type { IncomingMessage } from './types.js'

/**
 * Directo con la Cloud API, sin bandeja: nadie más ve la conversación, así que el bot
 * siempre responde y escalar solo avisa al equipo.
 */
export const createWhatsAppChannel = (tenant: Tenant, whatsapp: WhatsAppConfig, message: IncomingMessage): Channel => {
    const phoneE164 = `+${message.from}`
    return {
        key: `${tenant.id}:${message.from}`,
        phoneE164,
        acknowledge: () => markReadWithTyping(whatsapp, message.id),
        botOwnsConversation: async () => true,
        sendText: (text) => sendText(whatsapp, message.from, text),
        handoff: (motivo) => notifyTeam(tenant, phoneE164, motivo)
    }
}
