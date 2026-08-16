/**
 * CLI de inscripción: rellena el formulario de una carrera con tu perfil.
 *
 *   npm run inscribir -- https://www.rockthesport.com/es/evento/mi-carrera
 *   npm run inscribir -- <url> --headless   (solo informe + captura)
 *
 * El navegador se queda abierto para que revises, marques consentimientos,
 * envíes y pagues tú. Dorsalia jamás pulsa "enviar" ni paga por ti.
 */

import { loadJson } from "../src/lib/vault";
import {
  RunnerProfile,
  RunnerProfileSchema,
  completeness,
} from "../src/lib/profile/types";
import { runInscripcion } from "../src/lib/automation/engine";

async function main() {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith("--"));
  const headless = args.includes("--headless");

  if (!url) {
    console.error("Uso: npm run inscribir -- <url-de-la-carrera> [--headless]");
    process.exit(1);
  }

  const stored = loadJson<RunnerProfile>("profile");
  if (!stored) {
    console.error(
      "No hay perfil guardado. Arranca la web (npm run dev) y rellena tu perfil en /perfil.",
    );
    process.exit(1);
  }
  const profile = RunnerProfileSchema.parse(stored);
  const check = completeness(profile);
  if (!check.ready) {
    console.error(`Faltan datos en el perfil: ${check.missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`→ Abriendo ${url}`);
  const { result, browser } = await runInscripcion(url, profile, { headless });

  if (result.status === "error") {
    console.error(`✗ Error: ${result.error}`);
    process.exit(1);
  }

  console.log(`\nPlataforma: ${result.platform}`);
  console.log(`Campos rellenados: ${result.filled}`);
  for (const item of result.items) {
    const mark =
      item.status === "filled"
        ? "✓"
        : item.status === "consent_pending"
          ? "☐"
          : item.status === "unmatched"
            ? "?"
            : "·";
    console.log(`  ${mark} ${item.label}${item.matchedAs ? `  (${item.matchedAs})` : ""}`);
  }
  if (result.consentPending > 0) {
    console.log(
      `\n☐ Hay ${result.consentPending} casilla(s) de consentimiento SIN marcar: léelas y márcalas tú.`,
    );
  }
  if (result.screenshot) console.log(`Captura: ${result.screenshot}`);

  if (browser) {
    console.log(
      "\nRevisa el navegador: completa lo que falte, marca consentimientos y paga tú mismo.",
    );
    console.log("Pulsa Enter aquí cuando termines para cerrar el navegador.");
    await new Promise<void>((resolve) => {
      process.stdin.resume();
      process.stdin.once("data", () => resolve());
    });
    await browser.close();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
