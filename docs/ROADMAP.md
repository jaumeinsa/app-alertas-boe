# Roadmap de Notifikado

Orden propuesto para llevar el MVP a producto cobrable y, después, a la
cobertura total de fuentes.

## Fase 1 — MVP cobrable (lo más cercano a ingresos)

1. **Autenticación** (magic-link por email con Resend, o email+contraseña).
2. **Dashboard**: alta/baja de perfiles vigilados, ver alertas, marcar
   coincidencia como confirmada o falso positivo.
3. **Stripe**: checkout y portal de cliente para los planes 9 €/mes, anual y
   familiar. Webhook que actualiza `Subscription`. Gating de `maxProfiles`.
4. **Notificaciones por email**: worker que envía las coincidencias `NEW` y las
   marca `NOTIFIED`. Plantilla con enlace al documento oficial y tipo de acto.
5. **Backscan inicial**: al crear un perfil, escanear el histórico reciente
   (`INITIAL_BACKSCAN_DAYS`) para dar valor inmediato.

## Fase 2 — Calidad y diferenciación

6. **Enriquecimiento de documentos**: descargar el cuerpo (XML/HTML) de los
   anuncios del BOE, no solo el título, para mejorar el recall del matching.
7. **Anti-falsos-positivos avanzado**: casar sufijo de DNI anonimizado del BOE
   (`***4567**`), provincia y año de nacimiento; umbral configurable por
   usuario; resumen semanal "sin novedades".
8. **WhatsApp/SMS** (Twilio) para alertas urgentes (embargos, plazos cortos).

## Fase 3 — Cobertura total

9. **BORME** (Registro Mercantil) — útil para autónomos y empresas.
10. **Boletines provinciales (50)** — empezar por los de mayor población
    (Madrid, Barcelona, Valencia, Sevilla...).
11. **Diarios autonómicos** (BOJA, DOGC, DOG, BOCM, ...).

Cada nueva fuente solo necesita implementar `SourceAdapter`
(`src/lib/sources/types.ts`), registrarse en `src/lib/sources/index.ts` y
marcar `ingestEnabled: true` en el catálogo.

## Ideas de negocio

- **Plan familiar** (hasta 5 nombres) y **plan autónomo/empresa** (incluye
  BORME y vigilancia del nombre comercial).
- **Primer aviso gratis** como gancho de conversión.
- **Resumen de tranquilidad** mensual ("no has aparecido en ningún boletín")
  para reforzar el valor percibido y reducir bajas.
- **Gestoría/abogado partner**: derivar a un profesional cuando aparece una
  alerta seria (posible comisión / upsell).
