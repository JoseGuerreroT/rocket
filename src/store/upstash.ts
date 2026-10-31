import { Redis } from '@upstash/redis'

import { HISTORY_TTL_S, LOCK_TTL_S, SEEN_TTL_S, type History, type Store } from './types.js'

/** Upstash parsea como JSON lo que lee: un mensaje "5" volvería como número. Se guarda envuelto. */
type InboxItem = { text: string }

export const createUpstashStore = (redis: Redis): Store => ({
    markSeen: async (id) => (await redis.set(`seen:${id}`, 1, { nx: true, ex: SEEN_TTL_S })) === 'OK',
    pushInbox: async (key, text, messageId) => {
        await redis
            .multi()
            .rpush<InboxItem>(`inbox:${key}`, { text })
            .set(`last:${key}`, { id: messageId }, { ex: LOCK_TTL_S })
            .exec()
    },
    lastInboxMessage: async (key) => (await redis.get<{ id: string }>(`last:${key}`))?.id,
    drainInbox: async (key) => {
        const [items] = await redis
            .multi()
            .lrange<InboxItem>(`inbox:${key}`, 0, -1)
            .del(`inbox:${key}`)
            .exec<[InboxItem[], number]>()
        return items.map((item) => item.text)
    },
    inboxSize: (key) => redis.llen(`inbox:${key}`),
    acquireLock: async (key) => (await redis.set(`lock:${key}`, 1, { nx: true, ex: LOCK_TTL_S })) === 'OK',
    releaseLock: async (key) => {
        await redis.del(`lock:${key}`)
    },
    getHistory: async (key) => (await redis.get<History>(`history:${key}`)) ?? [],
    saveHistory: async (key, history) => {
        await redis.set(`history:${key}`, history, { ex: HISTORY_TTL_S })
    }
})
