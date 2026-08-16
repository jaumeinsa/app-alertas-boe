/**
 * Motor de autorrelleno de inscripciones.
 *
 * Dada la URL de una carrera y el perfil del corredor:
 *   1. Abre la página con Playwright (con cabeza si hay pantalla).
 *   2. Si hay adaptador de plataforma, le deja llegar hasta el formulario.
 *   3. Localiza los campos por heurística (etiqueta/name/autocomplete) y los
 *      rellena desde el perfil, resaltando en verde lo relleno.
 *   4. Se detiene SIEMPRE antes del final: no marca consentimientos legales,
 *      no resuelve captchas y no pulsa "enviar" ni paga. Eso es del humano.
 *
 * El resultado es un informe de qué se rellenó y qué quedó pendiente, y el
 * navegador queda abierto para que el usuario revise, consienta y pague.
 */

import fs from "node:fs";
import path from "node:path";
import { chromium, Browser, ElementHandle, Page } from "playwright";
import { RunnerProfile } from "../profile/types";
import { detectAdapter } from "../platforms";
import {
  CONSENT_RE,
  FieldKey,
  genderOptionMatches,
  matchField,
  monthOptionMatches,
  normalizeText,
  valueForField,
} from "./fields";
import { dataDir } from "../vault";

export interface FillItem {
  /** Texto identificativo del campo tal y como aparece en la página. */
  label: string;
  matchedAs: FieldKey | "consent" | null;
  status: "filled" | "consent_pending" | "unmatched" | "skipped" | "error";
}

export interface RunResult {
  id: string;
  url: string;
  platform: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "ready_for_review" | "error";
  headless: boolean;
  filled: number;
  consentPending: number;
  unmatched: number;
  items: FillItem[];
  screenshot?: string;
  error?: string;
}

export interface EngineOptions {
  headless?: boolean;
  onUpdate?: (r: RunResult) => void;
}

/** Descriptor de un campo, calculado dentro de la página. */
interface FieldInfo {
  tag: string;
  type: string;
  name: string;
  id: string;
  placeholder: string;
  ariaLabel: string;
  autocomplete: string;
  labelText: string;
  value: string;
  visible: boolean;
  options: Array<{ value: string; text: string }>;
}

function runsDir(): string {
  const dir = path.join(dataDir(), "runs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function persist(result: RunResult, onUpdate?: (r: RunResult) => void): void {
  fs.writeFileSync(
    path.join(runsDir(), `${result.id}.json`),
    JSON.stringify(result, null, 2),
  );
  onUpdate?.(result);
}

export function getRun(id: string): RunResult | null {
  if (!/^[\w-]+$/.test(id)) return null;
  const file = path.join(runsDir(), `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as RunResult;
}

export function listRuns(): RunResult[] {
  return fs
    .readdirSync(runsDir())
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(runsDir(), f), "utf8")) as RunResult)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** Sin pantalla (servidor/CI) no tiene sentido abrir navegador con cabeza. */
function defaultHeadless(): boolean {
  if (process.env.DORSALIA_HEADLESS === "1") return true;
  if (process.env.DORSALIA_HEADLESS === "0") return false;
  return process.platform === "linux" && !process.env.DISPLAY;
}

async function describeField(
  el: ElementHandle<SVGElement | HTMLElement>,
): Promise<FieldInfo> {
  return el.evaluate((node) => {
    const input = node as HTMLInputElement;
    let labelText = "";
    if (input.id) {
      try {
        const l = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        if (l) labelText = l.textContent ?? "";
      } catch {
        /* id raro */
      }
    }
    if (!labelText) {
      const parent = input.closest("label");
      if (parent) labelText = parent.textContent ?? "";
    }
    const options =
      input.tagName === "SELECT"
        ? Array.from((input as unknown as HTMLSelectElement).options).map((o) => ({
            value: o.value,
            text: o.text,
          }))
        : [];
    return {
      tag: input.tagName.toLowerCase(),
      type: (input.getAttribute("type") ?? "text").toLowerCase(),
      name: input.getAttribute("name") ?? "",
      id: input.id ?? "",
      placeholder: input.getAttribute("placeholder") ?? "",
      ariaLabel: input.getAttribute("aria-label") ?? "",
      autocomplete: input.getAttribute("autocomplete") ?? "",
      labelText: labelText.trim().slice(0, 200),
      value: input.value ?? "",
      visible: input.offsetWidth > 0 && input.offsetHeight > 0,
      options,
    };
  });
}

function fieldLabel(info: FieldInfo): string {
  return (
    info.labelText ||
    info.placeholder ||
    info.ariaLabel ||
    info.name ||
    info.id ||
    `${info.tag}[${info.type}]`
  );
}

function descriptorOf(info: FieldInfo): string {
  return [info.labelText, info.placeholder, info.ariaLabel, info.name, info.id].join(" ");
}

async function highlight(
  el: ElementHandle<SVGElement | HTMLElement>,
  color: string,
): Promise<void> {
  await el
    .evaluate((node, c) => {
      (node as HTMLElement).style.outline = `3px solid ${c}`;
      (node as HTMLElement).style.outlineOffset = "1px";
    }, color)
    .catch(() => {});
}

/** Elige la opción de un <select> que corresponde al campo y al perfil. */
function pickOption(
  info: FieldInfo,
  key: FieldKey,
  profile: RunnerProfile,
): string | null {
  const options = info.options.filter((o) => o.value !== "");
  if (options.length === 0) return null;

  if (key === "sexo") {
    if (!profile.sexo) return null;
    const hit = options.find(
      (o) => genderOptionMatches(o.text, profile.sexo as "M" | "F") ||
        genderOptionMatches(o.value, profile.sexo as "M" | "F"),
    );
    return hit?.value ?? null;
  }

  if (key === "diaNacimiento" || key === "anioNacimiento") {
    const target = Number(valueForField(key, profile));
    if (!target) return null;
    const hit = options.find(
      (o) => Number(o.value) === target || Number(o.text) === target,
    );
    return hit?.value ?? null;
  }

  if (key === "mesNacimiento") {
    const mm = valueForField(key, profile);
    if (!mm) return null;
    const hit = options.find((o) => monthOptionMatches(o.text, o.value, mm));
    return hit?.value ?? null;
  }

  if (key === "talla") {
    const talla = normalizeText(profile.tallaCamiseta);
    if (!talla) return null;
    const exact = options.find((o) => normalizeText(o.text) === talla);
    if (exact) return exact.value;
    const word = options.find((o) =>
      new RegExp(`\\b${talla}\\b`).test(normalizeText(o.text)),
    );
    return word?.value ?? null;
  }

  // provincia, país, nacionalidad, localidad...: coincidencia por inclusión.
  const wanted = normalizeText(valueForField(key, profile));
  if (!wanted) return null;
  const exact = options.find((o) => normalizeText(o.text) === wanted);
  if (exact) return exact.value;
  const partial = options.find(
    (o) =>
      normalizeText(o.text).includes(wanted) || wanted.includes(normalizeText(o.text)),
  );
  return partial?.value ?? null;
}

const SKIP_TYPES = new Set([
  "hidden", "submit", "button", "image", "reset", "file", "password", "search", "color", "range",
]);

/**
 * Recorre los campos del formulario y los rellena desde el perfil.
 */
async function fillPage(
  page: Page,
  profile: RunnerProfile,
  result: RunResult,
): Promise<void> {
  const elements = (await page.$$("input, select, textarea")).slice(0, 250);
  /** name de los grupos de radio ya resueltos. */
  const doneRadioGroups = new Set<string>();
  /** claves ya rellenas — evita machacar (p.ej. dos campos "nombre"). */
  const usedKeys = new Set<FieldKey>();

  for (const el of elements) {
    let info: FieldInfo;
    try {
      info = await describeField(el);
    } catch {
      continue;
    }
    if (!info.visible || SKIP_TYPES.has(info.type)) continue;

    const label = fieldLabel(info);
    const descriptor = descriptorOf(info);

    // Checkboxes: consentimientos NUNCA se marcan; "federado" sí se gestiona.
    if (info.type === "checkbox") {
      if (CONSENT_RE.test(normalizeText(descriptor))) {
        result.items.push({ label, matchedAs: "consent", status: "consent_pending" });
        await highlight(el, "#e8590c");
      } else if (/federad/.test(normalizeText(descriptor))) {
        try {
          await el.evaluate((node, checked) => {
            const box = node as HTMLInputElement;
            if (box.checked !== checked) box.click();
          }, profile.federado);
          result.items.push({ label, matchedAs: "licencia", status: "filled" });
          await highlight(el, "#2f9e44");
        } catch {
          result.items.push({ label, matchedAs: "licencia", status: "error" });
        }
      }
      continue;
    }

    // Radios: solo gestionamos el sexo, una vez por grupo.
    if (info.type === "radio") {
      const groupKey = info.name || info.id;
      if (doneRadioGroups.has(groupKey) || !profile.sexo) continue;
      const radioDescriptor = `${descriptor} ${info.value}`;
      if (
        /\bsexo\b|genero|gender|\bsex\b/.test(normalizeText(descriptor)) ||
        genderOptionMatches(radioDescriptor, profile.sexo as "M" | "F")
      ) {
        if (genderOptionMatches(`${info.labelText} ${info.value}`, profile.sexo as "M" | "F")) {
          try {
            await el.check({ timeout: 2000 });
            doneRadioGroups.add(groupKey);
            result.items.push({ label, matchedAs: "sexo", status: "filled" });
            await highlight(el, "#2f9e44");
          } catch {
            result.items.push({ label, matchedAs: "sexo", status: "error" });
          }
        }
      }
      continue;
    }

    const key = matchField(descriptor, info.autocomplete);
    if (!key) {
      // Solo contamos como "sin reconocer" los campos con pinta de dato personal.
      if (info.tag !== "select" || info.options.length > 1) {
        result.items.push({ label, matchedAs: null, status: "unmatched" });
        await highlight(el, "#fab005");
      }
      continue;
    }

    // Un mismo dato no se escribe dos veces (salvo confirmaciones de email).
    if (usedKeys.has(key) && key !== "emailConfirm") {
      continue;
    }

    if (info.tag === "select") {
      const optionValue = pickOption(info, key, profile);
      if (optionValue === null) {
        result.items.push({ label, matchedAs: key, status: "skipped" });
        continue;
      }
      try {
        await el.selectOption(optionValue);
        usedKeys.add(key);
        result.items.push({ label, matchedAs: key, status: "filled" });
        await highlight(el, "#2f9e44");
      } catch {
        result.items.push({ label, matchedAs: key, status: "error" });
      }
      continue;
    }

    // Inputs de texto (text, email, tel, date, number...) y textareas.
    let value = valueForField(key, profile);
    if (key === "fechaNacimiento" && info.type !== "date" && value) {
      // Formato español para inputs de texto libres.
      const [y, m, d] = value.split("-");
      value = `${d}/${m}/${y}`;
    }
    if (!value.trim()) {
      result.items.push({ label, matchedAs: key, status: "skipped" });
      continue;
    }
    if (info.value.trim()) {
      // Ya tiene contenido (p.ej. lo precargó la plataforma): no machacar.
      result.items.push({ label, matchedAs: key, status: "skipped" });
      continue;
    }
    try {
      await el.fill(value, { timeout: 3000 });
      usedKeys.add(key);
      result.items.push({ label, matchedAs: key, status: "filled" });
      await highlight(el, "#2f9e44");
    } catch {
      result.items.push({ label, matchedAs: key, status: "error" });
    }
  }
}

/**
 * Lanza el navegador, rellena la inscripción y deja el resultado a revisión.
 * Devuelve el navegador para que el llamante decida cuándo cerrarlo (en modo
 * con cabeza se deja abierto para que el usuario consienta, envíe y pague).
 */
export async function runInscripcion(
  rawUrl: string,
  profile: RunnerProfile,
  opts: EngineOptions = {},
): Promise<{ result: RunResult; browser: Browser | null }> {
  const url = new URL(rawUrl);
  const adapter = detectAdapter(url);
  const headless = opts.headless ?? defaultHeadless();
  const id = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  const result: RunResult = {
    id,
    url: rawUrl,
    platform: adapter?.name ?? "Genérico (heurística)",
    startedAt: new Date().toISOString(),
    status: "running",
    headless,
    filled: 0,
    consentPending: 0,
    unmatched: 0,
    items: [],
  };
  persist(result, opts.onUpdate);

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      headless,
      executablePath: process.env.DORSALIA_CHROMIUM || undefined,
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "es-ES",
    });
    const page = await context.newPage();
    await page.goto(rawUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

    await adapter?.prepare?.(page);

    // Overrides del adaptador (selectores concretos) antes de la heurística.
    for (const ov of adapter?.overrides ?? []) {
      const value = ov.value(profile);
      if (!value) continue;
      try {
        const el = page.locator(ov.selector).first();
        await el.fill(value, { timeout: 2000 });
        result.items.push({
          label: ov.description ?? ov.selector,
          matchedAs: null,
          status: "filled",
        });
      } catch {
        // El selector puede no existir en este evento concreto: no es error.
      }
    }

    await fillPage(page, profile, result);

    result.filled = result.items.filter((i) => i.status === "filled").length;
    result.consentPending = result.items.filter(
      (i) => i.status === "consent_pending",
    ).length;
    result.unmatched = result.items.filter((i) => i.status === "unmatched").length;

    const shot = path.join(runsDir(), `${id}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    if (fs.existsSync(shot)) result.screenshot = shot;

    result.status = "ready_for_review";
    result.finishedAt = new Date().toISOString();
    persist(result, opts.onUpdate);

    if (headless) {
      // Sin pantalla nadie puede revisar: cerramos y queda el informe + captura.
      await browser.close();
      browser = null;
    }
    return { result, browser };
  } catch (err) {
    result.status = "error";
    result.error = err instanceof Error ? err.message : String(err);
    result.finishedAt = new Date().toISOString();
    persist(result, opts.onUpdate);
    if (browser) await browser.close().catch(() => {});
    return { result, browser: null };
  }
}
