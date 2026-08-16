/**
 * Contrato común para las plataformas de inscripción.
 *
 * El motor de autorrelleno (`automation/engine.ts`) funciona de forma
 * heurística sobre CUALQUIER formulario: localiza los campos por etiqueta,
 * name, placeholder o autocomplete y los rellena desde el perfil. Un
 * adaptador de plataforma solo aporta lo que la heurística no puede
 * adivinar: cómo llegar del enlace de la carrera al formulario real
 * (`prepare`) y selectores concretos para campos raros (`overrides`).
 *
 * Añadir una plataforma = implementar `PlatformAdapter` + registrar en
 * `index.ts` + catalogarla en `catalog.ts`. Nunca acoplar el motor a una
 * plataforma concreta.
 */

import type { Page } from "playwright";
import type { RunnerProfile } from "../profile/types";

export interface FieldOverride {
  /** Selector CSS del campo en esta plataforma. */
  selector: string;
  value: (p: RunnerProfile) => string;
  description?: string;
}

export interface PlatformAdapter {
  /** Código único, p.ej. "rockthesport". */
  readonly id: string;
  readonly name: string;
  /** ¿Esta URL pertenece a la plataforma? */
  matches(url: URL): boolean;
  /**
   * Navegación previa al relleno: aceptar cookies, pulsar "Inscríbete",
   * elegir modalidad... Debe dejar la página en el formulario de datos.
   */
  prepare?(page: Page): Promise<void>;
  /** Selectores específicos que la heurística no encuentra sola. */
  overrides?: FieldOverride[];
}

/** Utilidades comunes para adaptadores. */

/** Cierra banners de cookies típicos (OneTrust, Cookiebot, genéricos). */
export async function dismissCookieBanners(page: Page): Promise<void> {
  const candidates = [
    "#onetrust-accept-btn-handler",
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
    'button:has-text("Aceptar todas")',
    'button:has-text("Aceptar cookies")',
    'button:has-text("Aceptar")',
    'button:has-text("Accept all")',
  ];
  for (const sel of candidates) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 400 })) {
        await btn.click({ timeout: 1500 });
        return;
      }
    } catch {
      // siguiente candidato
    }
  }
}

/** Pulsa el primer enlace/botón visible que parezca "inscríbete". */
export async function clickInscription(page: Page): Promise<boolean> {
  const candidates = [
    'a:has-text("Inscríbete")',
    'a:has-text("Inscribirse")',
    'a:has-text("Inscripción")',
    'a:has-text("Inscripciones")',
    'button:has-text("Inscríbete")',
    'button:has-text("Inscribirse")',
    'a:has-text("Register")',
    'button:has-text("Register")',
  ];
  for (const sel of candidates) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 500 })) {
        await el.click({ timeout: 3000 });
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        return true;
      }
    } catch {
      // siguiente candidato
    }
  }
  return false;
}
