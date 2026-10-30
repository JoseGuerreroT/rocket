# Rocket

Agente de WhatsApp con IA para varios negocios. Recibe los mensajes de la Cloud API de Meta, responde con Claude y usa las herramientas que cada negocio expone por MCP. **Fluver** es el primer cliente.

El plan completo vive en fluver-web: `docs/whatsapp-bot/mvp.md` y `docs/whatsapp-bot/plan-tecnico-chatwoot.md`.

## Cómo funciona

```
Cliente → Meta → POST /webhooks/whatsapp → (200 de inmediato)
                       ↓ en segundo plano
          firma ✓ → ¿mensaje repetido? → bandeja + candado por conversación
                       ↓
          Claude (claude-sonnet-5-5) + MCP del negocio + escalar_a_humano
                       ↓
          respuesta por la Cloud API
```

- **Frontera:** Rocket no sabe nada del negocio. Catálogo, precios y reservas salen del MCP del negocio, que llama la API de Claude directamente (conector MCP). La voz de marca y los textos fijos viven en `src/tenants/<negocio>.ts`.
- **Seguridad:** el teléfono del cliente sale del webhook y viaja al MCP dentro de un JWT HS256 firmado con un secreto compartido (`src/agent/mcpToken.ts`). La IA nunca lo elige.
- **Memoria:** Upstash Redis. El historial vence tras 24 horas sin mensajes y solo crece, nunca se edita.
- **Escalamiento (MVP, sin Chatwoot):** el bot le da al cliente el WhatsApp del equipo y, si está configurado, avisa en Slack.
- **Solo texto:** a fotos, audios y ubicaciones responde que por ahora solo lee texto.

## Estructura

```
src/
  app.ts                 rutas Hono; su export por defecto es la entrada de Vercel
  dev.ts                 servidor local
  conversation.ts        repetidos, bandeja, candado y respuesta
  agent/                 Claude, prompt, token del MCP, escalar_a_humano
  channels/whatsapp/     firma, lectura del webhook, envío
  store/                 Upstash o memoria local
  tenants/               un archivo por negocio
scripts/simulate.ts      webhook de Meta firmado, para probar en local
```

## Desarrollo

```bash
yarn install
cp .env.example .env.local   # llenar
yarn dev                     # http://localhost:8787
yarn simulate "Hola, ¿cuánto vale ir a Playa Cristal?"
yarn typecheck
```

Sin `WHATSAPP_TOKEN`, las respuestas se imprimen en la consola en vez de enviarse. Sin Upstash, la memoria es local.

El conector MCP lo llama la API de Claude desde internet, así que `FLUVER_MCP_URL` tiene que ser una URL pública (QA o producción): con `localhost` Claude no llega.

## Desplegar en Vercel

1. Proyecto nuevo apuntando a este repo; Vercel detecta Hono por `src/app.ts` (export por defecto).
2. Upstash Redis desde el Marketplace de Vercel, que crea `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.
3. Las demás variables de `.env.example`.
4. En Meta: webhook `https://<dominio>/webhooks/whatsapp`, el mismo `WHATSAPP_VERIFY_TOKEN`, suscrito al campo `messages`.
