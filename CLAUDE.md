# CLAUDE.md — Notifikado

Contexto para asistentes que trabajen en este repo.

## Qué es

**Notifikado** (notifikado.com) es un SaaS que vigila los boletines oficiales
españoles y avisa al usuario cuando su nombre aparece (multas, embargos,
citaciones, edictos). Suscripción: 9 €/mes. Se autohospeda en un VPS de
Hostinger.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind.
- PostgreSQL + Prisma.
- Despliegue con Docker Compose detrás de Nginx; workers por cron.

## Mapa del código

- `src/app/` — landing (`page.tsx`), API (`api/demo`, `api/health`).
- `src/components/DemoSearch.tsx` — demo interactiva de la landing.
- `src/lib/sources/` — adaptadores de fuentes. `types.ts` define el contrato
  `SourceAdapter`; `boe.ts` lo implementa vía la API de datos abiertos del BOE;
  `catalog.ts` lista TODAS las fuentes objetivo; `index.ts` registra las activas.
- `src/lib/matching/` — `normalize.ts` (claves canónicas de nombres) y
  `match.ts` (scoring de coincidencias).
- `src/lib/demo/search.ts` — lógica de la demo (búsqueda real + ejemplos).
- `scripts/ingest.ts` / `scripts/match.ts` — workers diarios.
- `prisma/schema.prisma` — modelo de datos.

## Principios

- **Cubrirlo todo**: añadir una fuente = implementar `SourceAdapter` + registrar
  en `index.ts` + `ingestEnabled: true` en el catálogo. No acoplar la ingesta a
  ninguna fuente concreta.
- **Minimizar falsos positivos**: el matching exige nombre completo (≥2 tokens)
  y sube confianza con sufijo de DNI y provincia.
- **RGPD**: tratar solo datos mínimos del usuario; nunca presentar un ejemplo de
  la demo como si fuera un resultado real (`isSample`).
- **Idempotencia**: la ingesta no debe duplicar (`unique(sourceId, externalId)`).

## Comandos

```bash
npm run dev            # desarrollo
npm run build          # prisma generate + next build
npm run typecheck      # tsc --noEmit
npm run db:seed        # cargar catálogo de fuentes
npm run worker:ingest  # ingesta del BOE
npm run worker:match   # matching
```

## Notas de entorno

- En entornos con proxy de red, el cliente HTTP de Node puede fallar al
  descargar los engines de Prisma (ECONNRESET); `curl` sí funciona. Solución:
  descargar `libquery_engine` y `schema-engine` con curl desde
  `binaries.prisma.sh/all_commits/<hash>/<plataforma>/` y colocarlos en
  `node_modules/@prisma/engines/`. En el VPS de Hostinger no hace falta.
