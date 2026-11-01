import type Anthropic from '@anthropic-ai/sdk'

export const ESCALATE_TOOL_NAME = 'escalar_a_humano'

export const escalateTool: Anthropic.Beta.BetaTool = {
    name: ESCALATE_TOOL_NAME,
    description:
        'Pasa la conversación a una persona del equipo. Úsala ante quejas, reembolsos, errores de una herramienta, algo que no puedas resolver, o si el cliente pide hablar con una persona.',
    input_schema: {
        type: 'object',
        properties: {
            motivo: { type: 'string', description: 'Qué necesita el cliente, en una frase, para quien lo atienda' }
        },
        required: ['motivo'],
        additionalProperties: false
    },
    strict: true
}

/**
 * Lo que Claude recibe al escalar. El traspaso real (aviso al equipo, bandeja) lo hace el
 * canal después de enviar esta última respuesta: si la conversación pasara antes a una
 * persona, el bot ya no podría despedirse.
 */
export const ESCALATE_RESULT =
    'Listo, el equipo ya tiene el aviso. Dile al cliente, con el trato que vienes usando, que una persona del equipo escribe por esta misma conversación lo antes posible. No le pidas más datos: a partir de aquí sigue la persona.'
