#!/usr/bin/env bash
# Simula al cliente de prueba escribiendo en la bandeja local.
#   ./say.sh "Hola, ¿cuánto vale ir a Playa Cristal?"
#   ./say.sh --list      muestra la conversación
set -euo pipefail
cd "$(dirname "$0")"
value() { python3 -c "import json,sys;print(json.load(open('setup-out.json'))[sys.argv[1]])" "$1"; }
BASE="http://localhost:3030/public/api/v1/inboxes/$(value inbox_identifier)/contacts/$(value contact_source_id)/conversations"

CONV=$(curl -s "$BASE" | python3 -c 'import json,sys;c=json.load(sys.stdin);print(c[-1]["id"] if c else "")')
[ -n "$CONV" ] || CONV=$(curl -s -X POST "$BASE" -H 'content-type: application/json' -d '{}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')

if [ "${1:-}" = "--list" ]; then
  curl -s "$BASE/$CONV/messages" | python3 -c '
import json,sys
for m in json.load(sys.stdin): print("cliente" if m["message_type"] == 0 else "bot/equipo", "|", m.get("content") or "")'
  exit
fi
BODY=$(python3 -c 'import json,sys;print(json.dumps({"content": sys.argv[1]}))' "$1")
curl -s -o /dev/null -w "enviado (%{http_code})\n" -X POST "$BASE/$CONV/messages" -H 'content-type: application/json' -d "$BODY"
