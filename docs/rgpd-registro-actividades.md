# Registro de Actividades de Tratamiento — Notifikado (art. 30 RGPD)

**Responsable:** Jaume Insa Pérez, NIF 21693936Z · avisos@notifikado.com
**Última revisión:** 2 de julio de 2026

## Actividad 1 — Vigilancia de boletines oficiales

| Campo | Detalle |
|---|---|
| Finalidad | Detectar la aparición del nombre del usuario en boletines y diarios oficiales españoles y avisarle |
| Base jurídica | Consentimiento expreso (art. 6.1.a), recogido en el alta con fecha y versión de texto (`User.consentAt`, `consentVersion`) |
| Categorías de interesados | Clientes del servicio y personas que estos autorizan (plan Familiar) |
| Categorías de datos | Nombre completo; tipo de documento y **últimos dígitos** (el documento completo NO se almacena — minimización); provincia (opcional); coincidencias detectadas en publicaciones públicas |
| Destinatarios | Ninguno (no hay cesiones) |
| Transferencias internacionales | No (datos alojados en la UE — Hostinger) |
| Plazo de supresión | Al eliminar la cuenta (borrado inmediato en cascada, botón en el panel) |
| Medidas de seguridad | HTTPS; BD sin exposición a Internet (solo red interna Docker); cookie de sesión HMAC; minimización de datos; acceso restringido por clave SSH |

## Actividad 2 — Gestión de cuentas y avisos

| Campo | Detalle |
|---|---|
| Finalidad | Alta, autenticación sin contraseña (enlace de un solo uso), envío de avisos y comunicaciones de servicio |
| Base jurídica | Ejecución de contrato (art. 6.1.b) |
| Categorías de datos | Email, teléfono (opcional), preferencias de canal de aviso |
| Encargados | Resend (envío de email, región UE eu-west-1) |
| Plazo | Al eliminar la cuenta |

## Actividad 3 — Facturación y cobros

| Campo | Detalle |
|---|---|
| Finalidad | Cobro de suscripciones y cumplimiento fiscal |
| Base jurídica | Ejecución de contrato (art. 6.1.b) y obligación legal (art. 6.1.c) |
| Categorías de datos | Identificadores de cliente/suscripción de Stripe, plan y estado. Los datos de tarjeta los trata únicamente Stripe |
| Encargados | Stripe Payments Europe (posible transferencia a EE. UU.: EU-US Data Privacy Framework + SCC) |
| Plazo | Justificantes de facturación: plazos de la normativa tributaria (4-6 años); resto, al eliminar la cuenta |

## Decisiones de diseño relevantes

- **Minimización (art. 5.1.c):** desde la migración `0005_rgpd_minimizacion` el DNI/NIE/CIF completo no se guarda; solo se usa en memoria durante el alta para validar la letra y derivar el sufijo con el que casan los boletines anonimizados. Los valores históricos se vaciaron.
- **Derecho de supresión (art. 17):** botón "Eliminar mi cuenta y todos mis datos" en el panel → cancela la renovación en Stripe y borra usuario + perfiles + coincidencias + avisos + tokens en cascada.
- **Cookies:** solo cookie técnica de sesión (exenta de banner según guía AEPD).
- **Consentimiento versionado:** el texto vigente vive en `src/lib/consent.ts` (`CONSENT_VERSION`); cada usuario guarda qué versión aceptó y cuándo.
- **Los boletines son públicos:** las publicaciones indexadas son datos de fuentes de acceso público editadas por las administraciones; Notifikado no las altera ni las difunde, solo avisa al propio interesado.
