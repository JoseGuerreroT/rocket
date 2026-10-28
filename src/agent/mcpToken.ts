import { SignJWT } from 'jose'

import type { Tenant } from '../tenants/types.js'

/** Dura un turno de la conversación con margen; se firma uno nuevo en cada turno. */
const TTL = '5m'

/**
 * Token para el MCP del negocio. Lleva el teléfono del cliente tal como llegó en el webhook:
 * la IA nunca lo elige, así no puede reservar a nombre de otro número.
 */
export const signMcpToken = (tenant: Tenant, phoneE164: string, conversationId?: string): Promise<string> =>
    new SignJWT(conversationId ? { conv: conversationId } : {})
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('rocket')
        .setAudience(`${tenant.id}-mcp`)
        .setSubject(phoneE164)
        .setIssuedAt()
        .setExpirationTime(TTL)
        .sign(new TextEncoder().encode(tenant.mcp.secret))
