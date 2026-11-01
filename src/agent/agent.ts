import Anthropic from '@anthropic-ai/sdk'

import { MODEL } from '../config.js'
import type { History } from '../store/types.js'
import type { Tenant } from '../tenants/types.js'

import { ESCALATE_RESULT, ESCALATE_TOOL_NAME, escalateTool } from './escalate.js'
import { signMcpToken } from './mcpToken.js'
import { buildSystemPrompt, nowNote } from './prompt.js'

/** Vueltas máximas por mensaje del cliente: las herramientas del MCP no cuentan, corren dentro de una. */
const MAX_STEPS = 6
const MCP_SERVER_NAME = 'negocio'

let client: Anthropic | undefined

/** Se crea al primer uso: sin ANTHROPIC_API_KEY el servidor arranca igual y el error sale en la petición. */
const getClient = (): Anthropic => (client ??= new Anthropic())

export type TurnInput = {
    tenant: Tenant
    phoneE164: string
    history: History
    userText: string
}

export type TurnResult = {
    reply: string
    history: History
    /** Motivo, si Claude pidió pasar la conversación a una persona. */
    handoff?: string
}

type Response = Anthropic.Beta.BetaMessage

const textOf = (response: Response): string =>
    response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim()

const callClaude = async (tenant: Tenant, phoneE164: string, messages: History): Promise<Response> =>
    getClient().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ['mcp-client-2025-11-20', 'server-side-fallback-2026-07-01'],
        // Si el modelo se niega por un falso positivo de seguridad, la API reintenta con otro.
        fallbacks: 'default',
        // Es un chat: respuestas cortas, poca deliberación. El default de este modelo es `high`.
        output_config: { effort: 'low' },
        cache_control: { type: 'ephemeral' },
        system: buildSystemPrompt(tenant),
        mcp_servers: [
            {
                type: 'url',
                url: tenant.mcp.url,
                name: MCP_SERVER_NAME,
                authorization_token: await signMcpToken(tenant, phoneE164)
            }
        ],
        tools: [{ type: 'mcp_toolset', mcp_server_name: MCP_SERVER_NAME }, escalateTool],
        messages
    })

const toolCalls = (response: Response) =>
    response.content.filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use')

/** Herramientas propias que pidió Claude (hoy, solo escalar). Escalar solo se anota: lo ejecuta el canal. */
const runOwnTools = (calls: Anthropic.Beta.BetaToolUseBlock[]): Anthropic.Beta.BetaToolResultBlockParam[] =>
    calls.map((call) => {
        const known = call.name === ESCALATE_TOOL_NAME
        const content = known ? ESCALATE_RESULT : `Herramienta desconocida: ${call.name}`
        return { type: 'tool_result', tool_use_id: call.id, content, is_error: !known }
    })

const escalationReason = (calls: Anthropic.Beta.BetaToolUseBlock[]): string | undefined => {
    const call = calls.find((c) => c.name === ESCALATE_TOOL_NAME)
    return call && String((call.input as { motivo?: unknown }).motivo ?? '')
}

/**
 * Un turno: el mensaje del cliente entra al historial y Claude responde, usando el MCP del
 * negocio (lo llama la API directamente) y `escalar_a_humano` (lo corre Rocket). El historial
 * solo crece: se guarda el `content` completo de cada respuesta, razonamiento incluido.
 */
export const runTurn = async ({ tenant, phoneE164, history, userText }: TurnInput): Promise<TurnResult> => {
    const messages: History = [
        ...history,
        { role: 'user', content: userText },
        { role: 'system', content: nowNote() }
    ]
    const replies: string[] = []
    let handoff: string | undefined

    for (let step = 0; step < MAX_STEPS; step++) {
        const response = await callClaude(tenant, phoneE164, messages)
        messages.push({ role: 'assistant', content: response.content })

        if (response.stop_reason === 'refusal') return { reply: tenant.replies.error, history: messages }

        const text = textOf(response)
        if (text) replies.push(text)

        if (response.stop_reason === 'pause_turn') continue
        if (response.stop_reason !== 'tool_use') break

        const calls = toolCalls(response)
        handoff ??= escalationReason(calls)
        messages.push({ role: 'user', content: runOwnTools(calls) })
    }

    return { reply: replies.join('\n\n') || tenant.replies.error, history: messages, handoff }
}
