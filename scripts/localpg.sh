#!/usr/bin/env bash
# Manage the private local Postgres cluster that lives in this repo (.localpg).
# This avoids needing sudo / a shared DB role. It runs on port 5543.
#
# Usage:
#   ./scripts/localpg.sh start   # init (if needed) + start + create DB
#   ./scripts/localpg.sh stop
#   ./scripts/localpg.sh status
#
# Connection (matches backend/.env):
#   postgresql://salesmaintain:salesmaintain@localhost:5543/salesmaintain?schema=public

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA="$ROOT/.localpg/data"
LOG="$ROOT/.localpg/postgres.log"
SOCK="$ROOT/.localpg/sock"
PORT=5543
PGUSER=salesmaintain
PGPASS=salesmaintain
DB=salesmaintain
PGBIN=/usr/lib/postgresql/18/bin
export PGPASSWORD="$PGPASS"

cmd="${1:-status}"

case "$cmd" in
  start)
    if [ ! -d "$DATA" ]; then
      mkdir -p "$ROOT/.localpg"
      "$PGBIN/initdb" -D "$DATA" -U "$PGUSER" --pwfile=<(echo "$PGPASS") --auth=md5 -E UTF8 >/dev/null
      echo "Initialized cluster in .localpg/data"
    fi
    mkdir -p "$SOCK"
    if ! "$PGBIN/pg_isready" -h 127.0.0.1 -p "$PORT" -U "$PGUSER" >/dev/null 2>&1; then
      "$PGBIN/pg_ctl" -D "$DATA" -l "$LOG" -o "-p $PORT -k $SOCK" start
    fi
    # Create the app database if missing
    if ! "$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U "$PGUSER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1; then
      "$PGBIN/createdb" -h 127.0.0.1 -p "$PORT" -U "$PGUSER" "$DB"
      echo "Created database '$DB'"
    fi
    echo "Local Postgres ready: postgresql://$PGUSER:$PGPASS@localhost:$PORT/$DB?schema=public"
    ;;
  stop)
    "$PGBIN/pg_ctl" -D "$DATA" stop
    ;;
  status)
    "$PGBIN/pg_isready" -h 127.0.0.1 -p "$PORT" -U "$PGUSER" && echo "DB '$DB' exists: $("$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U "$PGUSER" -d postgres -tAc "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='$DB')")"
    ;;
  *)
    echo "Usage: $0 {start|stop|status}" >&2
    exit 1
    ;;
esac
