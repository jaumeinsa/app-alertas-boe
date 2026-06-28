import type { Metadata } from "next";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://notifikado.com";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Notifikado — Que ninguna notificación te pille por sorpresa",
    template: "%s · Notifikado",
  },
  description:
    "Notifikado vigila todas las fuentes oficiales de España (BOE, Tablón Edictal Único, BORME, boletines provinciales y autonómicos) y te avisa el mismo día si tu nombre aparece: multas, embargos, citaciones, requerimientos y más.",
  keywords: [
    "notificaciones oficiales",
    "alertas BOE",
    "Tablón Edictal Único",
    "multas DGT notificación",
    "embargo Hacienda",
    "citación judicial",
    "BORME",
    "notificaciones edictales",
  ],
  openGraph: {
    title: "Notifikado — Que ninguna notificación te pille por sorpresa",
    description:
      "Vigilamos todas las fuentes oficiales y te avisamos el mismo día si tu nombre aparece. Multas, embargos, citaciones... antes de que sea tarde.",
    url: appUrl,
    siteName: "Notifikado",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Notifikado — Que ninguna notificación te pille por sorpresa",
    description:
      "Vigilamos las fuentes oficiales por ti y te avisamos el mismo día si tu nombre aparece.",
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
