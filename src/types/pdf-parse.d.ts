/**
 * Declaración mínima para `pdf-parse`.
 *
 * Importamos el submódulo interno (`pdf-parse/lib/pdf-parse.js`) en lugar del
 * `index.js` raíz porque este último incluye un bloque de "debug" que intenta
 * leer un PDF de prueba al cargarse (rompe en producción). El submódulo es la
 * función limpia.
 */
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: Record<string, unknown>
  ): Promise<PdfParseResult>;
  export default pdfParse;
}
