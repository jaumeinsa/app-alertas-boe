import type { Metadata } from "next";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://notifikado.com";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Notifikado — Que no te pille por sorpresa el BOE",
    template: "%s · Notifikado",
  },
  description:
    "Notifikado vigila el BOE, el Tablón Edictal Único, el BORME y los boletines provinciales y autonómicos por ti. Te avisamos al instante si tu nombre aparece: multas, embargos, citaciones judiciales y más.",
  keywords: [
    "alertas BOE",
    "Tablón Edictal Único",
    "multas DGT notificación",
    "embargo Hacienda",
    "citación judicial",
    "BORME",
    "notificaciones edictales",
  ],
  openGraph: {
    title: "Notifikado — Que no te pille por sorpresa el BOE",
    description:
      "Te avisamos al instante si tu nombre aparece en un boletín oficial. Multas, embargos, citaciones... antes de que sea tarde.",
    url: appUrl,
    siteName: "Notifikado",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Notifikado — Que no te pille por sorpresa el BOE",
    description:
      "Vigilamos los boletines oficiales por ti y te avisamos si tu nombre aparece.",
  },
  alternates: { canonical: appUrl },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
