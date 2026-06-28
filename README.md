# Notifikado

**Que no te pille por sorpresa el BOE.** Notifikado vigila los boletines
oficiales españoles por ti y te avisa al instante si tu nombre aparece: multas
de tráfico no notificadas, embargos de Hacienda, citaciones judiciales,
requerimientos administrativos y más.

> Desde 2015, cuando la Administración no consigue notificarte en persona, lo
> publica por edicto en el **Tablón Edictal Único (TEU)** del BOE. A efectos
> legales quedas notificado y los plazos corren aunque no te enteres.
> Notifikado existe para que sí te enteres, a tiempo.

- 🌐 Web: [notifikado.com](https://notifikado.com)
- 💶 Suscripción: **9 €/mes** (planes anual y familiar disponibles)

---

## ¿Qué incluye este repositorio?

Una app **Next.js (App Router) + TypeScript** lista para autohospedar en un VPS:

- **Landing de conversión** con **demo en vivo** que busca tu nombre en el BOE
  real de los últimos días (`/` y `POST /api/demo`).
- **Motor de fuentes** con arquitectura de adaptadores para cubrir **todo** el
  mapa de publicaciones oficiales: BOE/TEU, BORME, los 50 boletines
  provinciales y los diarios autonómicos (catálogo en
  `src/lib/sources/catalog.ts`). El adaptador del **BOE está implementado** vía
  la API oficial de datos abiertos; el resto quedan catalogados y listos para
  activar.
- **Motor de matching** (`src/lib/matching/`) con normalización de nombres
  (acentos, orden de apellidos, mayúsculas) y señales para reducir falsos
  positivos (sufijo de DNI, provincia).
- **Workers** de ingesta diaria y matching (`scripts/`) pensados para cron.
- **Modelo de datos** completo en Prisma + PostgreSQL (`prisma/schema.prisma`):
  usuarios, suscripciones, perfiles vigilados, fuentes, publicaciones,
  coincidencias y notificaciones.
- **Docker** (`Dockerfile`, `docker-compose.yml`) para desplegar en el VPS.

## Arquitectura

```
Navegador ──▶ Next.js (landing + demo + API + dashboard)
                   │
                   ├─ /api/demo ──▶ Motor de matching ──▶ Adaptador BOE (datos abiertos)
                   │
                   └─ PostgreSQL (Prisma)
                         ▲
        cron diario ─────┤  scripts/ingest.ts  → descarga boletines del día
                         └  scripts/match.ts   → cruza con perfiles vigilados
                                                  → crea alertas → notifica (email/WhatsApp)
```

## Puesta en marcha (desarrollo)

Requisitos: Node 20+ y PostgreSQL (o Docker).

```bash
cp .env.example .env          # rellena DATABASE_URL y claves
npm install
npx prisma migrate dev        # crea el esquema
npm run db:seed               # carga el catálogo de fuentes
npm run dev                   # http://localhost:3000
```

Probar los workers manualmente:

```bash
npm run worker:ingest         # ingiere el BOE de hoy
npm run worker:ingest -- 0 7  # ingiere de hoy a hace 7 días
npm run worker:match -- 7     # cruza publicaciones de los últimos 7 días
```

## Despliegue en el VPS

Ver **[docs/DEPLOY.md](docs/DEPLOY.md)** (Docker Compose + Nginx/HTTPS + cron).

## Estado y roadmap

- [x] Landing + demo en vivo contra el BOE real
- [x] Adaptador BOE/TEU (API de datos abiertos)
- [x] Motor de matching con normalización y anti-falsos-positivos
- [x] Modelo de datos y workers de ingesta/matching
- [ ] Autenticación y dashboard de usuario
- [ ] Suscripciones con Stripe (9 €/mes, anual, familiar)
- [ ] Envío de notificaciones (email con Resend; WhatsApp/SMS)
- [ ] Adaptadores BORME, BOPs y autonómicos
- [ ] Enriquecimiento del cuerpo de los documentos (no solo títulos)

Ver el detalle en [docs/ROADMAP.md](docs/ROADMAP.md).

## Aviso legal y privacidad

Notifikado solo consulta **publicaciones oficiales y de acceso público** y
busca **el propio nombre del usuario** por encargo de este. Los datos
personales se tratan conforme al **RGPD**: minimización (solo nombre y, de forma
opcional, sufijo de DNI y provincia), no se venden ni se comparten.
