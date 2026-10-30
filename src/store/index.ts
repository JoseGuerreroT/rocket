import { Redis } from '@upstash/redis'

import { optionalEnv } from '../config.js'

import { createMemoryStore } from './memory.js'
import type { Store } from './types.js'
import { createUpstashStore } from './upstash.js'

const createStore = (): Store => {
    const url = optionalEnv('UPSTASH_REDIS_REST_URL')
    const token = optionalEnv('UPSTASH_REDIS_REST_TOKEN')
    if (url && token) return createUpstashStore(new Redis({ url, token }))

    if (process.env.VERCEL) throw new Error('En Vercel hace falta Upstash: la memoria local no se comparte entre instancias')
    console.warn('[rocket] Sin Upstash: memoria local, solo para desarrollo')
    return createMemoryStore()
}

let instance: Store | undefined

/** Se crea al primer uso: si falta Upstash en Vercel, falla la petición con un mensaje claro, no el arranque. */
export const getStore = (): Store => (instance ??= createStore())
