import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dorsalia — inscríbete en carreras sin rellenar formularios",
  description:
    "Guarda tu perfil de corredor una vez (con foto del DNI) y Dorsalia rellena por ti las inscripciones de carreras y maratones en cualquier plataforma.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand">
              🏃 Dorsalia
            </Link>
            <nav>
              <Link href="/">Inscribirme</Link>
              <Link href="/perfil">Mi perfil</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            Dorsalia rellena formularios por ti, pero <strong>nunca</strong> marca
            consentimientos, resuelve captchas ni paga: la última palabra siempre es tuya.
          </div>
        </footer>
      </body>
    </html>
  );
}
