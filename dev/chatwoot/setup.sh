#!/usr/bin/env bash
# Levanta Chatwoot local en http://localhost:3030 y lo deja listo para Rocket.
# Escribe en esta carpeta (fuera de git): .env, credenciales.txt y rocket.env.
# Luego: yarn dev:chatwoot y ./say.sh "Hola".
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  sed -e "s|^SECRET_KEY_BASE=.*|SECRET_KEY_BASE=$(openssl rand -hex 64)|" \
      -e "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$(openssl rand -hex 16)|" \
      -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 16)|" .env.example > .env
  chmod 600 .env
fi
if [ ! -f credenciales.txt ]; then
  printf 'URL=http://localhost:3030\nUSUARIO=admin@rocket.test\nCLAVE=Rk%s!\nBOT_SECRET=%s\n' \
    "$(openssl rand -hex 10)" "$(openssl rand -hex 24)" > credenciales.txt
  chmod 600 credenciales.txt
fi
# shellcheck disable=SC1091
source credenciales.txt

docker compose pull -q
docker compose run --rm rails bundle exec rails db:chatwoot_prepare >/dev/null
docker compose up -d
until curl -s -o /dev/null http://localhost:3030/; do sleep 3; done

docker compose cp setup.rb rails:/tmp/setup.rb >/dev/null 2>&1
OUT=$(docker compose exec -T -e ADMIN_PASSWORD="$CLAVE" -e BOT_SECRET="$BOT_SECRET" \
  -e ROCKET_WEBHOOK_URL="http://host.docker.internal:8787/webhooks/chatwoot/fluver" \
  rails bundle exec rails runner /tmp/setup.rb 2>/dev/null | tail -1)
echo "$OUT" > setup-out.json
chmod 600 setup-out.json

value() { python3 -c "import json,sys;print(json.load(open('setup-out.json'))[sys.argv[1]])" "$1"; }
cat > rocket.env <<ENV
# El conector MCP lo llama la API de Claude desde internet: tiene que ser una URL pública.
FLUVER_MCP_URL=https://fluver-qa.vercel.app/api/mcp
FLUVER_WHATSAPP_PHONE_NUMBER_ID=
FLUVER_CHATWOOT_URL=http://localhost:3030
FLUVER_CHATWOOT_ACCOUNT_ID=$(value account_id)
FLUVER_CHATWOOT_BOT_TOKEN=$(value bot_token)
FLUVER_CHATWOOT_WEBHOOK_SECRET=$(value bot_secret)
ENV
chmod 600 rocket.env
echo "Chatwoot listo en http://localhost:3030 (usuario y clave en dev/chatwoot/credenciales.txt)"
