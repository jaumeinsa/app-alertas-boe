# Despliegue de Notifikado en un VPS de Hostinger

Guía para poner Notifikado en producción en `notifikado.com` usando Docker
Compose + Nginx (HTTPS) + cron para los workers.

## 1. Requisitos en el VPS

- Ubuntu/Debian con acceso `root` o `sudo`.
- Docker y el plugin Compose:
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
- DNS de `notifikado.com` (y `www`) apuntando a la IP del VPS.

## 2. Clonar y configurar

```bash
git clone <repo> /opt/notifikado
cd /opt/notifikado
cp .env.example .env
nano .env
```

Rellena al menos:

```ini
NEXT_PUBLIC_APP_URL="https://notifikado.com"
DATABASE_URL="postgresql://notifikado:UNA_CLAVE_FUERTE@db:5432/notifikado?schema=public"
POSTGRES_USER="notifikado"
POSTGRES_PASSWORD="UNA_CLAVE_FUERTE"
POSTGRES_DB="notifikado"
# Stripe, Resend, etc. cuando los actives.
```

> Importante: el host de la base de datos dentro de Docker Compose es **`db`**,
> no `localhost`.

## 3. Levantar el stack

```bash
docker compose up -d --build
```

Esto arranca PostgreSQL y la web. La web aplica las migraciones de Prisma
automáticamente al arrancar (`prisma migrate deploy`) y queda escuchando en
`127.0.0.1:3000`.

Cargar el catálogo de fuentes la primera vez:

```bash
docker compose exec web node node_modules/.bin/tsx prisma/seed.ts
```

## 4. Nginx + HTTPS

Instala Nginx y Certbot en el host y crea el virtual host:

```nginx
# /etc/nginx/sites-available/notifikado
server {
    server_name notifikado.com www.notifikado.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/notifikado /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d notifikado.com -d www.notifikado.com
```

## 5. Workers diarios (cron)

El BOE publica de madrugada. Programa la ingesta + matching a primera hora.
Edita el cron del host (`crontab -e`):

```cron
# Ingesta del BOE del día + matching, todos los días a las 08:15
15 8 * * * cd /opt/notifikado && docker compose exec -T web sh -c "node node_modules/.bin/tsx scripts/ingest.ts 0 1 && node node_modules/.bin/tsx scripts/match.ts 2" >> /var/log/notifikado-cron.log 2>&1
```

> El servicio `cron` del `docker-compose.yml` queda como contenedor en espera;
> en producción es más sencillo y observable usar el cron del host como arriba.

## 6. Actualizaciones

```bash
cd /opt/notifikado
git pull
docker compose up -d --build
```

## Notas

- Las publicaciones oficiales no cambian: la ingesta es **idempotente**
  (`unique(sourceId, externalId)`), puedes reejecutarla sin duplicar.
- Para el primer valor al usuario, ejecuta un backscan del histórico reciente:
  `docker compose exec -T web sh -c "node node_modules/.bin/tsx scripts/ingest.ts 0 180"`.
- En el VPS de Hostinger la red es normal: `npm ci` y el `prisma generate` del
  build descargan los engines sin problema (a diferencia del entorno de CI con
  proxy donde hubo que cachearlos a mano).
