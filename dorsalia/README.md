# Dorsalia 🏃

**Inscríbete en carreras y maratones sin volver a rellenar el mismo formulario estúpido.**

Guardas tu perfil de corredor **una vez** — a mano o subiendo una foto de tu DNI — y,
cuando quieras correr una carrera, pegas el enlace: Dorsalia abre el formulario de la
plataforma que sea, lo rellena con tus datos y te lo deja listo. Tú revisas, marcas los
consentimientos y pagas. Nada más que teclear.

> Nombre provisional. App independiente dentro de este repo (no toca Notifikado).

## Cómo funciona

1. **Perfil único** (`/perfil`): nombre, DNI, fecha de nacimiento, contacto, dirección,
   club, talla, contacto de emergencia… Todos los datos que piden los formularios.
2. **Foto del DNI**: sube anverso y reverso y el perfil se rellena solo (visión con la
   API de Claude). El resultado se **verifica** de forma independiente — letra del DNI
   (módulo 23) y dígitos de control de la MRZ del reverso — y siempre lo revisas tú
   antes de guardar.
3. **Inscripción** (`/`): pega la URL de la carrera. Un motor Playwright abre la página,
   reconoce los campos por heurística (etiquetas, `name`, `autocomplete`… en español,
   catalán e inglés) y los rellena. Lo relleno queda resaltado en verde; lo dudoso, en
   amarillo.
4. **Tú tienes la última palabra**: Dorsalia **nunca** marca casillas de consentimiento,
   ni resuelve captchas, ni pulsa "enviar", ni paga. El navegador queda abierto para que
   termines tú.

## Arquitectura

- `src/lib/profile/` — modelo del perfil del corredor (zod).
- `src/lib/vault.ts` — almacén local cifrado (AES-256-GCM) para perfil y fotos del DNI.
- `src/lib/dni/` — extracción por visión (`claude.ts`), validación de letra del DNI y
  parser de MRZ con dígitos de control (`mrz.ts`).
- `src/lib/platforms/` — contrato `PlatformAdapter`, catálogo de plataformas objetivo y
  adaptadores activos (RockTheSport, Sportmaniacs). Añadir plataforma = implementar
  adaptador + registrarlo en `index.ts` + catalogarlo.
- `src/lib/automation/` — diccionario de campos (`fields.ts`) y motor de autorrelleno
  Playwright (`engine.ts`). El motor funciona sobre **cualquier** formulario; los
  adaptadores solo aportan la navegación hasta él.
- `src/app/` — interfaz web (Next.js App Router) y API.
- `scripts/inscribir.ts` — CLI equivalente para usar desde terminal.

## Puesta en marcha

```bash
cd dorsalia
npm install
npx playwright install chromium   # navegador para el autorrelleno
npm run dev                        # http://localhost:3100
```

Variables de entorno (opcionales):

| Variable | Para qué |
| --- | --- |
| `ANTHROPIC_API_KEY` | Activa la extracción de datos desde la foto del DNI. Sin ella, el perfil se rellena a mano. |
| `DORSALIA_CLAUDE_MODEL` | Modelo de visión (por defecto `claude-opus-5`). |
| `DORSALIA_KEY` | Clave hex de 64 caracteres para el cifrado local (si no, se genera en `data/.key`). |
| `DORSALIA_DATA_DIR` | Carpeta de datos (por defecto `./data`). |
| `DORSALIA_HEADLESS` | `1` fuerza modo sin pantalla, `0` lo desactiva. |
| `DORSALIA_CHROMIUM` | Ruta a un Chromium concreto. |

CLI:

```bash
npm run inscribir -- https://www.rockthesport.com/es/evento/mi-carrera
npm run typecheck
```

## Privacidad (RGPD)

- Todo se guarda **en tu máquina**, cifrado en reposo (`data/`, fuera de git).
- Las fotos del DNI solo se envían a la API de visión para la extracción que tú pides,
  y puedes borrarlas cuando quieras (`DELETE /api/dni/extract`).
- Los informes de inscripción no guardan los valores rellenados, solo qué campos fueron.

## Límites (a propósito y conocidos)

- **Sin pagos ni envío automático**: el paso final es siempre humano. Además de ser lo
  legalmente sensato (consentimientos, condiciones de cada plataforma), es lo que evita
  inscripciones erróneas irreversibles.
- **Captchas**: si la plataforma pone uno, lo resuelves tú (el navegador ya está abierto).
- Los formularios con pasos previos raros (elegir modalidad, login obligatorio) pueden
  requerir que navegues tú hasta el formulario y vuelvas a lanzar el relleno con esa URL.
- Los adaptadores dedicados mejoran con el uso real: la primera vez en una plataforma
  nueva revisa el resultado con calma.
