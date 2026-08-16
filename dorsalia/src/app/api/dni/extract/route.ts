/**
 * POST /api/dni/extract — extrae los datos de las fotos del DNI.
 *
 * Recibe multipart/form-data con "front" y/o "back" (jpeg/png/webp), pasa las
 * imágenes por el motor de visión y verifica el resultado de forma
 * independiente: letra del DNI (módulo 23) y dígitos de control de la MRZ.
 * Devuelve los campos + avisos; el usuario los revisa antes de guardar nada.
 *
 * Las fotos también se guardan cifradas en el vault por si hay que
 * reprocesarlas (se pueden borrar con DELETE).
 */

import { NextRequest, NextResponse } from "next/server";
import { DniImage, getExtractor } from "@/lib/dni/extract";
import { parseMrz } from "@/lib/dni/mrz";
import { normalizeDocumento, validateDocumento } from "@/lib/dni/validate";
import { removeEntry, saveBlob } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  const extractor = getExtractor();
  if (!extractor) {
    return NextResponse.json(
      {
        error:
          "No hay motor de extracción configurado. Define ANTHROPIC_API_KEY en el entorno o introduce los datos a mano.",
      },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const images: DniImage[] = [];
  for (const field of ["front", "back"] as const) {
    const file = form.get(field);
    if (file instanceof File && file.size > 0) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `Formato no soportado (${file.type}): usa JPG, PNG o WebP.` },
          { status: 400 },
        );
      }
      const data = Buffer.from(await file.arrayBuffer());
      images.push({ data, mediaType: file.type as DniImage["mediaType"] });
      saveBlob(`dni-${field}`, data);
    }
  }
  if (images.length === 0) {
    return NextResponse.json(
      { error: "Adjunta al menos una foto del DNI (campos 'front'/'back')." },
      { status: 400 },
    );
  }

  try {
    const fields = await extractor.extract(images);
    const warnings: string[] = [];
    const verified: string[] = [];

    // Verificación 1: letra del DNI/NIE.
    if (fields.numeroDocumento) {
      fields.numeroDocumento = normalizeDocumento(fields.numeroDocumento);
      if (validateDocumento(fields.numeroDocumento)) {
        verified.push("numeroDocumento");
      } else {
        warnings.push(
          `El número ${fields.numeroDocumento} no supera la validación de la letra: revísalo.`,
        );
      }
    }

    // Verificación 2: MRZ del reverso (dígitos de control).
    if (fields.mrz) {
      const mrz = parseMrz(fields.mrz);
      if (mrz.valid) {
        // La MRZ manda: sus dígitos de control garantizan la lectura.
        if (mrz.dniNumber) {
          if (validateDocumento(mrz.dniNumber)) {
            fields.numeroDocumento = mrz.dniNumber;
            verified.push("numeroDocumento");
          }
        }
        if (mrz.birthDate) {
          fields.fechaNacimiento = mrz.birthDate;
          verified.push("fechaNacimiento");
        }
        if (mrz.sex) {
          fields.sexo = mrz.sex;
          verified.push("sexo");
        }
      } else {
        warnings.push(`MRZ ilegible o incompleta (${mrz.errors.join("; ")}).`);
      }
    }

    const { mrz: _mrz, ...clean } = fields;
    return NextResponse.json({
      fields: clean,
      verified: Array.from(new Set(verified)),
      warnings,
      engine: extractor.id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error extrayendo el DNI" },
      { status: 502 },
    );
  }
}

/** DELETE /api/dni/extract — borra las fotos del DNI del vault. */
export async function DELETE() {
  removeEntry("dni-front");
  removeEntry("dni-back");
  return NextResponse.json({ ok: true });
}
