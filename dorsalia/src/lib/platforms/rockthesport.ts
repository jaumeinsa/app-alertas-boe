/**
 * Adaptador para RockTheSport (rockthesport.com).
 *
 * La ficha de una carrera tiene un botón "Inscríbete" que lleva al asistente
 * de inscripción. Los selectores concretos del formulario varían por evento,
 * así que el relleno lo hace el motor heurístico; aquí solo resolvemos la
 * navegación hasta él.
 */

import type { Page } from "playwright";
import { PlatformAdapter, clickInscription, dismissCookieBanners } from "./types";

export const rockTheSportAdapter: PlatformAdapter = {
  id: "rockthesport",
  name: "RockTheSport",

  matches(url: URL): boolean {
    return /(^|\.)rockthesport\.com$/.test(url.hostname);
  },

  async prepare(page: Page): Promise<void> {
    await dismissCookieBanners(page);
    // Si estamos en la ficha del evento (no en el formulario), entrar.
    if (!/inscripcion|registration/i.test(page.url())) {
      await clickInscription(page);
      await dismissCookieBanners(page);
    }
  },
};
