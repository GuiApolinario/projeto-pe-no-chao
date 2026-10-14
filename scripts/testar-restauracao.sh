#!/usr/bin/env bash
# Teste de backup/restauração: exporta um banco local para JSON (mesmo formato do backup),
# gera o SQL com scripts/restaurar.mjs, aplica num banco novo e compara totais e saldo.
# Uso: scripts/testar-restauracao.sh [banco_origem]   (requer o banco criado por testar-banco.sh)
set -euo pipefail
ORIGEM=${1:-pnc_teste}; DESTINO=pnc_restauracao
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"; TMP=$(mktemp -d); chmod 755 "$TMP"
run() { if [ -n "${PGHOST:-}" ] || [ "$(id -un)" = "postgres" ]; then "$@"; else su postgres -c "$(printf '%q ' "$@")"; fi; }
TABS=$(cd "$RAIZ" && node -e "import('./scripts/tabelas.mjs').then(m=>console.log(m.TABELAS.join(' ')))")
Q="select json_build_object('meta', json_build_object('gerado_em', now()), 'dados', json_build_object($(for t in $TABS; do printf "'%s', coalesce((select json_agg(x) from public.%s x), '[]'::json)," "$t" "$t"; done | sed 's/,$//')))"
run psql -X -t -A -d "$ORIGEM" -c "$Q" > "$TMP/backup.json"
node "$RAIZ/scripts/restaurar.mjs" "$TMP/backup.json" > "$TMP/restauracao.sql"; chmod 644 "$TMP"/*
run dropdb --if-exists "$DESTINO"; run createdb "$DESTINO"
run psql -X -q -o /dev/null -v ON_ERROR_STOP=1 -d "$DESTINO" -f "$RAIZ/supabase/tests/00_simular_supabase.sql"
for f in "$RAIZ"/supabase/migrations/*.sql; do run psql -X -q -o /dev/null -v ON_ERROR_STOP=1 -d "$DESTINO" -f "$f"; done
run psql -X -q -o /dev/null -v ON_ERROR_STOP=1 -d "$DESTINO" -f "$TMP/restauracao.sql"
C="select (select count(*) from receitas)||'/'||(select count(*) from despesas)||'/'||(select count(*) from pagamentos)||'/'||(select count(*) from documentos)||'/'||(select count(*) from auditoria)||'/'||public.saldo_contabil_em('2099-12-31')"
A=$(run psql -X -t -A -d "$ORIGEM" -c "$C"); B=$(run psql -X -t -A -d "$DESTINO" -c "$C")
echo "origem:  $A"; echo "destino: $B"
[ "$A" = "$B" ] && echo "✔ Restauração idêntica." || { echo "✘ Divergência na restauração"; exit 1; }
