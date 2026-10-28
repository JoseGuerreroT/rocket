import type { IncomingMessage, WhatsAppMessage, WhatsAppWebhookPayload } from './types.js'

const readableText = (message: WhatsAppMessage): string | undefined =>
    message.text?.body ??
    message.button?.text ??
    message.interactive?.button_reply?.title ??
    message.interactive?.list_reply?.title

/** Saca los mensajes entrantes. Los estados de entrega (`statuses`) se ignoran. */
export const parseWebhook = (payload: WhatsAppWebhookPayload): IncomingMessage[] =>
    (payload.entry ?? []).flatMap((entry) =>
        (entry.changes ?? [])
            .filter((change) => change.field === 'messages')
            .flatMap(({ value }) =>
                (value?.messages ?? []).map((message) => ({
                    id: message.id,
                    phoneNumberId: value?.metadata?.phone_number_id ?? '',
                    from: message.from,
                    profileName: value?.contacts?.find((c) => c.wa_id === message.from)?.profile?.name,
                    type: message.type,
                    text: readableText(message)?.trim() || undefined
                }))
            )
    )
