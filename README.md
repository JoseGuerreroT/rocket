# Rocket

Agente de WhatsApp con IA para varios negocios. Responde con Claude y usa las herramientas que cada negocio expone por MCP. **Fluver** es el primer cliente.

Dos canales de entrada, por negocio:
- **Chatwoot** (el de Fluver): Meta le entrega a Chatwoot y Rocket es el Agent Bot de la bandeja. El equipo ve todo y toma el chat desde la app móvil.
- **Cloud API directo**: Meta le entrega a Rocket, sin bandeja. Útil para probar sin Chatwoot.

El plan completo vive en fluver-web: `docs/whatsapp-bot/mvp.md` y `docs/whatsapp-bot/plan-tecnico-chatwoot.md`.

## Cómo funciona

```
Cliente → Meta → Chatwoot → POST /webhooks/chatwoot/<negocio>   (o Meta → POST /webhooks/whatsapp)
                                   ↓ 200 de inmediato; en segundo plano
          firma ✓ → ¿repetido? → espera 4 s para agrupar → candado por conversación
                                   ↓
          Claude (claude-haiku-5-5) + MCP del negocio + escalar_a_humano
                                   ↓
          respuesta por la API de Chatwoot (o la Cloud API)
```

- **Frontera:** Rocket no sabe nada del negocio. Catálogo, precios y reservas salen del MCP del negocio, que llama la API de Claude directamente (conector MCP). La voz de marca y los textos fijos viven en `src/tenants/<negocio>.ts`.
- **Seguridad:** el teléfono del cliente sale del webhook y viaja al MCP dentro de un JWT HS256 firmado con un secreto compartido (`src/agent/mcpToken.ts`). La IA nunca lo elige.
- **Memoria:** Upstash Redis. El historial vence tras 24 horas sin mensajes y solo crece, nunca se edita.
- **Chatwoot, quién responde:** el bot solo contesta conversaciones `pending`. Al escalar deja una nota privada, la etiqueta `escalado` y pasa el chat a `open`. Si una persona escribe en un chat `pending`, lo toma. Para devolvérselo al bot, se pasa otra vez a `pending`; lo que hablaron mientras tanto le llega como contexto.
- **Escalamiento sin Chatwoot:** solo avisa en Slack, si está configurado.
- **Solo texto:** a fotos, audios y ubicaciones responde que por ahora solo lee texto.

## Estructura

```
src/
  app.ts                 rutas Hono; su export por defecto es la entrada de Vercel
  dev.ts                 servidor local
  conversation.ts        repetidos, bandeja, candado y respuesta
  agent/                 Claude, prompt, token del MCP, escalar_a_humano
  channels/types.ts      interfaz común de los canales
  channels/chatwoot/     Agent Bot: firma, filtros, API de la conversación
  channels/whatsapp/     Cloud API directo: firma, lectura del webhook, envío
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

## Conectar Chatwoot

1. En Chatwoot: bandeja de WhatsApp Cloud con el número, el WABA id, el token y el App Secret de la app de Meta. En Meta, el webhook apunta a la URL que da esa bandeja.
2. Ajustes → Bots → nuevo bot con URL `https://<rocket>/webhooks/chatwoot/fluver`. Copiar su token y su secreto a `FLUVER_CHATWOOT_BOT_TOKEN` y `FLUVER_CHATWOOT_WEBHOOK_SECRET`.
3. En la bandeja → Bot: elegir ese bot. Las conversaciones nuevas entran en `pending` y las responde Rocket.
4. `FLUVER_WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_TOKEN` son opcionales: con ellos, Rocket muestra "escribiendo…" en el WhatsApp del cliente (Chatwoot solo lo muestra en su bandeja).

### Chatwoot local (para desarrollar)

```bash
./dev/chatwoot/setup.sh          # Chatwoot en http://localhost:3030, con bandeja simulada y el bot Rocket
yarn dev:chatwoot                # Rocket en :8787 con dev/chatwoot/rocket.env
./dev/chatwoot/say.sh "Hola"     # el cliente de prueba escribe
./dev/chatwoot/say.sh --list     # la conversación
```

Usuario y clave quedan en `dev/chatwoot/credenciales.txt` (fuera de git). La bandeja es de tipo API: simula WhatsApp sin Meta.
