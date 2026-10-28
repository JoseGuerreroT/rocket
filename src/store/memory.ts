import { HISTORY_TTL_S, LOCK_TTL_S, SEEN_TTL_S, type History, type Store } from './types.js'

type Entry<T> = { value: T; expiresAt: number }

/** Solo para desarrollo local: se pierde al reiniciar y no se comparte entre instancias. */
export const createMemoryStore = (): Store => {
    const values = new Map<string, Entry<unknown>>()
    const inboxes = new Map<string, string[]>()

    const read = <T>(key: string): T | undefined => {
        const entry = values.get(key)
        if (!entry || entry.expiresAt < Date.now()) return undefined
        return entry.value as T
    }
    const write = (key: string, value: unknown, ttlS: number) =>
        values.set(key, { value, expiresAt: Date.now() + ttlS * 1000 })
    const setIfAbsent = (key: string, ttlS: number): boolean => {
        if (read(key) !== undefined) return false
        write(key, true, ttlS)
        return true
    }

    return {
        markSeen: async (id) => setIfAbsent(`seen:${id}`, SEEN_TTL_S),
        pushInbox: async (key, text) => {
            inboxes.set(key, [...(inboxes.get(key) ?? []), text])
        },
        drainInbox: async (key) => {
            const texts = inboxes.get(key) ?? []
            inboxes.delete(key)
            return texts
        },
        inboxSize: async (key) => inboxes.get(key)?.length ?? 0,
        acquireLock: async (key) => setIfAbsent(`lock:${key}`, LOCK_TTL_S),
        releaseLock: async (key) => {
            values.delete(`lock:${key}`)
        },
        getHistory: async (key) => read<History>(`history:${key}`) ?? [],
        saveHistory: async (key, history) => {
            write(`history:${key}`, history, HISTORY_TTL_S)
        }
    }
}
