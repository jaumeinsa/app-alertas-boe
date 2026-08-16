/**
 * Adaptador para Sportmaniacs (sportmaniacs.com).
 *
 * Igual que RockTheSport: resolvemos la navegación de la ficha del evento
 * al formulario y dejamos el relleno al motor heurístico.
 */

import type { Page } from "playwright";
import { PlatformAdapter, clickInscription, dismissCookieBanners } from "./types";

export const sportmaniacsAdapter: PlatformAdapter = {
  id: "sportmaniacs",
  name: "Sportmaniacs",

  matches(url: URL): boolean {
    return /(^|\.)sportmaniacs\.com$/.test(url.hostname);
  },

  async prepare(page: Page): Promise<void> {
    await dismissCookieBanners(page);
    if (!/inscri|registr/i.test(page.url())) {
      await clickInscription(page);
      await dismissCookieBanners(page);
    }
  },
};
