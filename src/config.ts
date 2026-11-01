/** Lee una variable obligatoria al usarla, no al importar: así el servidor arranca y el error dice cuál falta. */
export const requireEnv = (name: string): string => {
    const value = process.env[name]
    if (!value) throw new Error(`Falta la variable de entorno ${name}`)
    return value
}

export const optionalEnv = (name: string): string | undefined => process.env[name] || undefined

// Haiku: 20 veces más barato que Sonnet (US$0,10 / US$0,50 por millón de tokens) y más rápido;
// Anthropic lo recomienda para atención al cliente en vivo.
export const MODEL = 'claude-haiku-5-5'

export const graphApiUrl = (path: string): string =>
    `https://graph.facebook.com/${optionalEnv('GRAPH_API_VERSION') ?? 'v23.0'}/${path}`
