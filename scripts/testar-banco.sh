#!/usr/bin/env bash
# Aplica as migrações em um PostgreSQL local descartável e executa os cenários de teste.
# Uso: scripts/testar-banco.sh   (requer PostgreSQL 15+ e acesso como usuário "postgres")
set -euo pipefail
DB=${DB_TESTE:-pnc_teste}
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
PSQL="psql -X -q -t -A -v ON_ERROR_STOP=1 -d $DB"
run() { if [ -n "${PGHOST:-}" ] || [ "$(id -un)" = "postgres" ]; then "$@"; else su postgres -c "$(printf '%q ' "$@")"; fi; }
run dropdb --if-exists "$DB"
run createdb "$DB"
run $PSQL -o /dev/null -f "$RAIZ/supabase/tests/00_simular_supabase.sql"
for f in "$RAIZ"/supabase/migrations/*.sql; do
  echo "→ migração $(basename "$f")"
  run $PSQL -o /dev/null -f "$f"
done
for f in "$RAIZ"/supabase/tests/[1-9]*.sql; do
  echo "→ testes $(basename "$f")"
  run $PSQL -f "$f"
done
echo "✔ Banco de dados: todos os testes passaram."
