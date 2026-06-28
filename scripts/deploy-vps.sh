#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Notifikado — despliegue en VPS (Docker + Nginx + HTTPS)
#
# Uso (desde la raíz del repo, en el VPS):
#   sudo bash scripts/deploy-vps.sh notifikado.com tu-email@ejemplo.com
#
# Hace:
#   1. Genera .env (con contraseña de BD aleatoria) si no existe.
#   2. Levanta PostgreSQL + migraciones + seed + la web con Docker Compose.
#   3. Instala y configura Nginx como proxy inverso.
#   4. Si el dominio ya resuelve a este VPS, emite el certificado HTTPS (Certbot).
#
# Es idempotente: puedes reejecutarlo sin miedo.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:-notifikado.com}"
EMAIL="${2:-}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

log() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }
warn() { printf "\n\033[1;33m⚠ %s\033[0m\n" "$*"; }

# ── 1. .env ──────────────────────────────────────────────────
if [ ! -f .env ]; then
  log "Generando .env"
  DB_PASS="$(openssl rand -hex 24)"
  cat > .env <<EOF
NEXT_PUBLIC_APP_URL="https://${DOMAIN}"
NODE_ENV="production"

POSTGRES_USER="notifikado"
POSTGRES_PASSWORD="${DB_PASS}"
POSTGRES_DB="notifikado"
DATABASE_URL="postgresql://notifikado:${DB_PASS}@db:5432/notifikado?schema=public"

INITIAL_BACKSCAN_DAYS="180"
INGEST_USER_AGENT="NotifikadoBot/0.1 (+https://${DOMAIN})"

# Rellena cuando los actives:
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PRICE_MONTHLY=""
NEXT_PUBLIC_STRIPE_PRICE_YEARLY=""
NEXT_PUBLIC_STRIPE_PRICE_FAMILY=""
RESEND_API_KEY=""
EMAIL_FROM="Notifikado <avisos@${DOMAIN}>"
EOF
  echo "  .env creado (contraseña de BD generada)."
else
  echo "  .env ya existe, se reutiliza."
fi

# ── 2. Docker Compose ────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "Instalando Docker"
  curl -fsSL https://get.docker.com | sh
fi

log "Construyendo y levantando los contenedores"
docker compose up -d --build

log "Esperando a que la web responda en 127.0.0.1:3000"
for i in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "  Web arriba."
    break
  fi
  sleep 2
  [ "$i" = "60" ] && warn "La web tarda en arrancar; revisa 'docker compose logs web'."
done

# ── 3. Nginx ─────────────────────────────────────────────────
if ! command -v nginx >/dev/null 2>&1; then
  log "Instalando Nginx"
  apt-get update -y && apt-get install -y nginx
fi

log "Configurando el virtual host de Nginx"
cat > /etc/nginx/sites-available/notifikado <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
ln -sf /etc/nginx/sites-available/notifikado /etc/nginx/sites-enabled/notifikado
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  Nginx sirviendo en HTTP."

# ── 4. HTTPS (Certbot) ───────────────────────────────────────
SERVER_IP="$(curl -fsS --max-time 5 https://api.ipify.org || echo "")"
DOMAIN_IP="$(getent ahostsv4 "${DOMAIN}" | awk '{print $1; exit}' || echo "")"

log "Comprobando DNS: ${DOMAIN} -> ${DOMAIN_IP:-(sin resolver)} | este VPS -> ${SERVER_IP:-?}"

if [ -n "$SERVER_IP" ] && [ "$DOMAIN_IP" = "$SERVER_IP" ]; then
  if ! command -v certbot >/dev/null 2>&1; then
    log "Instalando Certbot"
    apt-get install -y certbot python3-certbot-nginx
  fi
  log "Emitiendo certificado HTTPS"
  CERTBOT_EMAIL_ARG="--register-unsafely-without-email"
  [ -n "$EMAIL" ] && CERTBOT_EMAIL_ARG="-m ${EMAIL}"
  certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" \
    --non-interactive --agree-tos --redirect ${CERTBOT_EMAIL_ARG}
  echo "  HTTPS activo: https://${DOMAIN}"
else
  warn "El dominio aún NO resuelve a este VPS (${SERVER_IP:-?})."
  echo "  1) En tu gestor DNS, pon registros A:  @ y www  ->  ${SERVER_IP:-31.97.154.104}"
  echo "  2) Espera a la propagación (minutos a horas)."
  echo "  3) Vuelve a ejecutar este script, o solo el certbot:"
  echo "       sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --agree-tos --redirect -m ${EMAIL:-tu-email@ejemplo.com}"
fi

# ── 5. Cron de ingesta diaria ────────────────────────────────
CRON_LINE="15 8 * * * cd ${APP_DIR} && docker compose exec -T worker sh -c 'npx tsx scripts/ingest.ts 0 1 && npx tsx scripts/match.ts 2' >> /var/log/notifikado-cron.log 2>&1"
if ! crontab -l 2>/dev/null | grep -qF "notifikado-cron.log"; then
  log "Programando cron diario de ingesta (08:15)"
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  echo "  Cron añadido."
else
  echo "  Cron de ingesta ya existe."
fi

log "Despliegue terminado."
echo "App: http://127.0.0.1:3000  ·  Público: http(s)://${DOMAIN}"
echo "Logs:   docker compose logs -f web"
echo "Estado: docker compose ps"
