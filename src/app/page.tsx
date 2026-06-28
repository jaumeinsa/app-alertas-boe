import DemoSearch from "@/components/DemoSearch";
import { countCatalog } from "@/lib/sources/catalog";
import Link from "next/link";

export default function Home() {
  const catalog = countCatalog();

  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <LogosBar />
      <Problem />
      <HowItWorks />
      <Coverage total={catalog.total} />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </main>
  );
}

/* ───────────────────────── Header ───────────────────────── */

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            N
          </span>
          Notifikado
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
          <a href="#como-funciona" className="hover:text-slate-900">
            Cómo funciona
          </a>
          <a href="#cobertura" className="hover:text-slate-900">
            Qué vigilamos
          </a>
          <a href="#precios" className="hover:text-slate-900">
            Precios
          </a>
          <a href="#faq" className="hover:text-slate-900">
            Preguntas
          </a>
        </nav>
        <a
          href="#demo"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Probar gratis
        </a>
      </div>
    </header>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero() {
  return (
    <section className="bg-brand-gradient" id="demo">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700">
            ⚡ Avisos el mismo día de la publicación
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Que no te pille por sorpresa
            <span className="text-brand-600"> el BOE</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600">
            Multas que no te notificaron, embargos de Hacienda, citaciones
            judiciales… cuando la Administración no te localiza, lo publica en un
            boletín oficial y los plazos corren igual. <strong>Notifikado vigila
            todos los boletines por ti</strong> y te avisa al instante si tu
            nombre aparece.
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <Check /> Primera búsqueda gratis
            </li>
            <li className="flex items-center gap-2">
              <Check /> Sin permanencia
            </li>
            <li className="flex items-center gap-2">
              <Check /> Datos tratados con RGPD
            </li>
          </ul>
        </div>

        <div>
          <DemoSearch />
        </div>
      </div>
    </section>
  );
}

function LogosBar() {
  const items = ["BOE", "Tablón Edictal Único", "BORME", "50 Boletines Provinciales", "Diarios Autonómicos"];
  return (
    <div className="border-y border-slate-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-5 py-5 text-sm font-medium text-slate-400">
        <span className="text-slate-500">Vigilamos:</span>
        {items.map((i) => (
          <span key={i}>{i}</span>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Problema ───────────────────────── */

function Problem() {
  const cards = [
    {
      icon: "🚗",
      title: "Multas que nunca recibiste",
      body: "Si la DGT no consigue notificarte, publica la sanción por edicto. El plazo para recurrir corre aunque no te enteres, y acaba en embargo.",
    },
    {
      icon: "🏦",
      title: "Embargos de Hacienda",
      body: "Las providencias de apremio y embargos se notifican en el Tablón Edictal Único del BOE. Descubrirlo tarde multiplica recargos e intereses.",
    },
    {
      icon: "⚖️",
      title: "Citaciones judiciales",
      body: "Juzgados y administraciones citan por edicto cuando no te encuentran. No comparecer tiene consecuencias serias.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <h2 className="text-center text-3xl font-bold text-slate-900">
        Lo que no sabes <span className="text-alert-600">sí</span> te puede hacer daño
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
        Desde 2015, cuando la Administración no logra notificarte en persona, lo
        hace publicándolo en el <strong>Tablón Edictal Único</strong>. A efectos
        legales, ya estás notificado.
      </p>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="text-3xl">{c.icon}</div>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">
              {c.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Cómo funciona ───────────────────────── */

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Añade tu nombre",
      body: "Indica tu nombre completo y, opcionalmente, los últimos dígitos de tu DNI y tu provincia para afinar y evitar falsas alarmas.",
    },
    {
      n: "2",
      title: "Vigilamos cada día",
      body: "Cada mañana descargamos y analizamos los boletines oficiales recién publicados buscando cualquier mención a ti.",
    },
    {
      n: "3",
      title: "Te avisamos al instante",
      body: "Si apareces, recibes un email (y WhatsApp si lo activas) con el enlace al documento oficial y de qué trata. A tiempo para actuar.",
    },
  ];
  return (
    <section id="como-funciona" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-center text-3xl font-bold text-slate-900">
          Tres pasos. Cero sorpresas.
        </h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="relative">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-600 text-lg font-bold text-white">
                {s.n}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Cobertura ───────────────────────── */

function Coverage({ total }: { total: number }) {
  return (
    <section id="cobertura" className="mx-auto max-w-6xl px-5 py-20">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            Una sola suscripción. <br />
            <span className="text-brand-600">{total} fuentes oficiales</span> vigiladas.
          </h2>
          <p className="mt-4 text-slate-600">
            No tienes que saber en qué boletín puede salir tu nombre. Nosotros
            cubrimos el mapa completo de publicaciones oficiales de España.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-700">
            <li className="flex gap-2">
              <Check /> <strong>BOE</strong> y <strong>Tablón Edictal Único</strong> — multas, embargos, citaciones.
            </li>
            <li className="flex gap-2">
              <Check /> <strong>BORME</strong> — actos mercantiles, concursos, administradores.
            </li>
            <li className="flex gap-2">
              <Check /> <strong>50 Boletines Provinciales</strong> — ayuntamientos y diputaciones.
            </li>
            <li className="flex gap-2">
              <Check /> <strong>Diarios autonómicos</strong> — BOJA, DOGC, DOG, BOCM y más.
            </li>
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-50 to-white p-8">
          <div className="grid grid-cols-3 gap-4 text-center">
            <Stat n="1" label="BOE + TEU" />
            <Stat n="1" label="BORME" />
            <Stat n="50" label="Provinciales" />
            <Stat n="17" label="Autonómicos" />
            <Stat n="24/7" label="Vigilancia" />
            <Stat n="9€" label="al mes" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="text-2xl font-extrabold text-brand-700">{n}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

/* ───────────────────────── Precios ───────────────────────── */

function Pricing() {
  const plans = [
    {
      name: "Personal",
      price: "9 €",
      period: "/mes",
      highlight: true,
      features: [
        "1 nombre vigilado",
        "Todas las fuentes oficiales",
        "Avisos por email",
        "Primer escaneo del histórico reciente",
        "Sin permanencia",
      ],
      cta: "Empezar ahora",
    },
    {
      name: "Anual",
      price: "90 €",
      period: "/año",
      badge: "2 meses gratis",
      features: [
        "Todo lo del plan Personal",
        "Ahorro equivalente a 2 meses",
        "Avisos por email + WhatsApp",
      ],
      cta: "Ahorrar con el plan anual",
    },
    {
      name: "Familiar",
      price: "15 €",
      period: "/mes",
      features: [
        "Hasta 5 nombres vigilados",
        "Ideal para familias y autónomos",
        "Avisos por email + WhatsApp",
        "Panel único de control",
      ],
      cta: "Proteger a mi familia",
    },
  ];

  return (
    <section id="precios" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-center text-3xl font-bold text-slate-900">
          Tranquilidad por menos de lo que cuesta una multa
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
          Una sola notificación que detectes a tiempo ya paga años de
          suscripción. Cancela cuando quieras.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-2xl border bg-white p-7 shadow-sm ${
                p.highlight
                  ? "border-brand-500 ring-2 ring-brand-200"
                  : "border-slate-200"
              }`}
            >
              {p.badge && (
                <span className="absolute -top-3 right-6 rounded-full bg-alert-500 px-3 py-1 text-xs font-bold text-white">
                  {p.badge}
                </span>
              )}
              {p.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">
                  Más popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-slate-900">{p.name}</h3>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-extrabold text-slate-900">
                  {p.price}
                </span>
                <span className="mb-1 text-slate-500">{p.period}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check /> {f}
                  </li>
                ))}
              </ul>
              <a
                href="#demo"
                className={`mt-7 rounded-xl px-5 py-3 text-center text-sm font-semibold transition ${
                  p.highlight
                    ? "bg-brand-600 text-white hover:bg-brand-700"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */

function Faq() {
  const faqs = [
    {
      q: "¿Es legal vigilar los boletines oficiales?",
      a: "Sí. El BOE y el resto de boletines son publicaciones públicas y de acceso libre. Notifikado solo busca tu propio nombre por ti y te avisa, usando datos abiertos oficiales.",
    },
    {
      q: "¿Qué pasa con mis datos personales?",
      a: "Solo usamos tu nombre (y opcionalmente los últimos dígitos de tu DNI y tu provincia) para vigilar en tu nombre. Tratamos los datos conforme al RGPD y nunca los vendemos ni los compartimos.",
    },
    {
      q: "¿Cómo evitáis los falsos positivos si mi nombre es común?",
      a: "Puedes afinar la vigilancia con los últimos dígitos de tu DNI y tu provincia. Nuestro motor da más confianza a las coincidencias que casan también esos datos, reduciendo el ruido.",
    },
    {
      q: "¿Con qué rapidez me avisáis?",
      a: "Analizamos los boletines el mismo día de su publicación. En cuanto detectamos una coincidencia, recibes el aviso con el enlace al documento oficial.",
    },
    {
      q: "¿Puedo cancelar cuando quiera?",
      a: "Sí, sin permanencia ni penalización. Cancelas desde tu panel en cualquier momento.",
    },
  ];
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-20">
      <h2 className="text-center text-3xl font-bold text-slate-900">
        Preguntas frecuentes
      </h2>
      <div className="mt-10 divide-y divide-slate-200">
        {faqs.map((f) => (
          <details key={f.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-base font-semibold text-slate-900">
              {f.q}
              <span className="ml-4 text-brand-600 transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── CTA final ───────────────────────── */

function FinalCta() {
  return (
    <section className="bg-brand-600">
      <div className="mx-auto max-w-4xl px-5 py-16 text-center">
        <h2 className="text-3xl font-bold text-white">
          Empieza a dormir tranquilo hoy
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-brand-100">
          Haz la primera búsqueda gratis y descubre si tu nombre ya aparece en
          algún boletín oficial.
        </p>
        <a
          href="#demo"
          className="mt-7 inline-flex rounded-xl bg-white px-7 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
        >
          Probar gratis ahora
        </a>
      </div>
    </section>
  );
}

/* ───────────────────────── Footer ───────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row">
        <div className="flex items-center gap-2 font-semibold text-slate-700">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-white">
            N
          </span>
          Notifikado
        </div>
        <p className="text-center">
          © {new Date().getFullYear()} Notifikado · Vigilancia de boletines
          oficiales · Datos tratados conforme al RGPD
        </p>
        <div className="flex gap-4">
          <a href="#" className="hover:text-slate-900">
            Privacidad
          </a>
          <a href="#" className="hover:text-slate-900">
            Términos
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────── Helpers ───────────────────────── */

function Check() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.1 3.1 6.8-6.8a1 1 0 011.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
