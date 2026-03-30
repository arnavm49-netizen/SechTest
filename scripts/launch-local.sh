#!/bin/zsh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

DEFAULT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/psychometrics?schema=public"
DEFAULT_APP_URL="http://localhost:3000"
OPEN_BROWSER="${EPS_OPEN_BROWSER:-1}"

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

load_env_file() {
  if [ -f ".env" ]; then
    set -a
    source ".env"
    set +a
  fi
}

parse_url_part() {
  local part="$1"
  node -e '
    const target = new URL(process.argv[1]);
    const mode = process.argv[2];
    if (mode === "host") console.log(target.hostname);
    if (mode === "port") console.log(target.port || (target.protocol === "https:" ? "443" : "80"));
  ' "$APP_URL" "$part"
}

app_is_running() {
  curl -sf "${APP_URL%/}/api/health" >/dev/null 2>&1
}

ensure_dependencies() {
  if [ ! -d "node_modules" ]; then
    log "Installing Node dependencies."
    npm install
  fi
}

database_reachable() {
  node <<'NODE' >/dev/null 2>&1
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
  } finally {
    await prisma.$disconnect();
  }
})().catch(() => {
  process.exit(1);
});
NODE
}

database_is_empty() {
  node <<'NODE'
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    const count = await prisma.organization.count();
    console.log(count === 0 ? "yes" : "no");
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
}

wait_for_database() {
  local attempts=30

  for _ in $(seq 1 "$attempts"); do
    if database_reachable; then
      return 0
    fi
    sleep 2
  done

  return 1
}

start_docker_services() {
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi

  if lsof -iTCP:5432 -sTCP:LISTEN >/dev/null 2>&1; then
    return 1
  fi

  log "Starting Docker Postgres and Redis."
  docker compose up -d postgres redis
  export DATABASE_URL="$DEFAULT_DATABASE_URL"
  wait_for_database
}

open_browser_when_ready() {
  if [ "$OPEN_BROWSER" != "1" ]; then
    return
  fi

  (
    for _ in $(seq 1 90); do
      if app_is_running; then
        open "$APP_URL"
        exit 0
      fi
      sleep 1
    done
  ) >/dev/null 2>&1 &
}

load_env_file
export DATABASE_URL="${DATABASE_URL:-$DEFAULT_DATABASE_URL}"
export APP_URL="${APP_URL:-$DEFAULT_APP_URL}"

APP_HOST="$(parse_url_part host)"
APP_PORT="$(parse_url_part port)"

if app_is_running; then
  log "App is already running at $APP_URL."
  if [ "$OPEN_BROWSER" = "1" ]; then
    open "$APP_URL"
  fi
  exit 0
fi

if lsof -iTCP:"$APP_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  log "Port $APP_PORT is already in use by another process. Stop it or change APP_URL in .env."
  exit 1
fi

ensure_dependencies

if ! database_reachable; then
  log "Current DATABASE_URL is not reachable. Trying Docker fallback."
  if ! start_docker_services; then
    log "Unable to reach PostgreSQL on $DATABASE_URL and Docker fallback was not available."
    exit 1
  fi
fi

log "Applying database migrations."
npm run db:deploy

if [ "$(database_is_empty)" = "yes" ]; then
  log "Seeding initial demo data."
  npm run db:seed
fi

log "Launching the app at $APP_URL."
open_browser_when_ready
npm run dev -- --hostname "$APP_HOST" --port "$APP_PORT"
