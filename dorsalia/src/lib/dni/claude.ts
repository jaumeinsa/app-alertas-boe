/**
 * Motor de extracción de DNI con visión vía API de Claude.
 *
 * Manda las fotos (anverso/reverso) y pide un JSON con los campos del
 * documento más la transcripción literal de la MRZ, que luego el llamante
 * verifica con `parseMrz` y la letra del DNI. Requiere ANTHROPIC_API_KEY.
 */

import Anthropic from "@anthropic-ai/sdk";
import { DniExtraction, DniExtractionSchema, DniExtractor, DniImage } from "./extract";

const MODEL = process.env.DORSALIA_CLAUDE_MODEL ?? "claude-opus-5";

const PROMPT = `Estas imágenes son el anverso y/o reverso de un documento nacional de identidad español (DNI/NIE) que su titular ha aportado voluntariamente para autorrellenar su propio perfil de corredor.

Extrae los datos y responde SOLO con un objeto JSON (sin \`\`\`, sin texto adicional) con estas claves, omitiendo las que no puedas leer con claridad:

{
  "nombre": "solo el nombre de pila",
  "apellido1": "primer apellido",
  "apellido2": "segundo apellido",
  "numeroDocumento": "número de DNI/NIE con su letra, p.ej. 12345678Z",
  "fechaNacimiento": "YYYY-MM-DD",
  "sexo": "M" | "F",
  "nacionalidad": "p.ej. España",
  "fechaCaducidad": "YYYY-MM-DD",
  "mrz": "las 3 líneas de la zona de lectura mecánica del reverso, transcritas EXACTAMENTE carácter a carácter (incluidos los '<'), separadas por \\n"
}

No inventes nada: es mejor omitir una clave que devolver un valor dudoso.`;

async function extract(images: DniImage[]): Promise<DniExtraction> {
  const client = new Anthropic();

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...images.map(
      (img): Anthropic.Beta.BetaImageBlockParam => ({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mediaType,
          data: img.data.toString("base64"),
        },
      }),
    ),
    { type: "text", text: PROMPT },
  ];

  // Fallback en servidor: si los clasificadores declinan la petición
  // (falso positivo ocasional con documentos de identidad), se reintenta
  // automáticamente en el modelo de reserva dentro de la misma llamada.
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2048,
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: "claude-opus-4-8" }],
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      "El modelo declinó procesar la imagen. Prueba con una foto más nítida o introduce los datos a mano.",
    );
  }

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const jsonMatch = /\{[\s\S]*\}/.exec(text);
  if (!jsonMatch) {
    throw new Error("La respuesta del modelo no contiene JSON");
  }
  return DniExtractionSchema.parse(JSON.parse(jsonMatch[0]));
}

export const claudeExtractor: DniExtractor = {
  id: "claude-vision",
  available: () =>
    Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  extract,
};
