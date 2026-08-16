"use client";

/**
 * Mi perfil: los datos que Dorsalia vuelca en las inscripciones.
 * Se pueden extraer automáticamente de fotos del DNI (anverso/reverso) y
 * siempre se revisan antes de guardar. Todo se guarda cifrado en local.
 */

import { useEffect, useState } from "react";

interface Profile {
  nombre: string;
  apellido1: string;
  apellido2: string;
  tipoDocumento: "DNI" | "NIE" | "PASAPORTE";
  numeroDocumento: string;
  fechaNacimiento: string;
  sexo: "M" | "F" | "";
  nacionalidad: string;
  email: string;
  telefono: string;
  direccion: string;
  codigoPostal: string;
  localidad: string;
  provincia: string;
  pais: string;
  club: string;
  federado: boolean;
  numeroLicencia: string;
  tallaCamiseta: "XS" | "S" | "M" | "L" | "XL" | "XXL" | "";
  contactoEmergenciaNombre: string;
  contactoEmergenciaTelefono: string;
  observaciones: string;
}

const EMPTY: Profile = {
  nombre: "",
  apellido1: "",
  apellido2: "",
  tipoDocumento: "DNI",
  numeroDocumento: "",
  fechaNacimiento: "",
  sexo: "",
  nacionalidad: "España",
  email: "",
  telefono: "",
  direccion: "",
  codigoPostal: "",
  localidad: "",
  provincia: "",
  pais: "España",
  club: "",
  federado: false,
  numeroLicencia: "",
  tallaCamiseta: "",
  contactoEmergenciaNombre: "",
  contactoEmergenciaTelefono: "",
  observaciones: "",
};

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => d.profile && setProfile({ ...EMPTY, ...d.profile }))
      .catch(() => {});
  }, []);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  async function extractDni() {
    if (!front && !back) return;
    setExtracting(true);
    setError(null);
    setWarnings([]);
    setStatus(null);
    try {
      const form = new FormData();
      if (front) form.append("front", front);
      if (back) form.append("back", back);
      const res = await fetch("/api/dni/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error extrayendo el DNI");
        return;
      }
      const f = data.fields ?? {};
      setProfile((p) => ({
        ...p,
        nombre: f.nombre ?? p.nombre,
        apellido1: f.apellido1 ?? p.apellido1,
        apellido2: f.apellido2 ?? p.apellido2,
        numeroDocumento: f.numeroDocumento ?? p.numeroDocumento,
        fechaNacimiento: f.fechaNacimiento ?? p.fechaNacimiento,
        sexo: f.sexo ?? p.sexo,
        nacionalidad: f.nacionalidad ?? p.nacionalidad,
      }));
      setWarnings(data.warnings ?? []);
      setStatus(
        "Datos extraídos del DNI. Revísalos antes de guardar" +
          (data.verified?.length
            ? ` (verificados automáticamente: ${data.verified.join(", ")})`
            : "") +
          ".",
      );
    } catch {
      setError("No se pudo contactar con el servidor");
    } finally {
      setExtracting(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error guardando el perfil");
        return;
      }
      setStatus(
        data.completeness?.ready
          ? "Perfil guardado. ¡Listo para inscribirte!"
          : `Perfil guardado. Aún falta: ${data.completeness?.missing?.join(", ")}.`,
      );
    } catch {
      setError("No se pudo contactar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1>Mi perfil de corredor</h1>
      <p className="lead">
        Rellénalo una vez y olvídate de los formularios. Se guarda cifrado en tu
        máquina; las fotos del DNI no salen de ella salvo para la extracción.
      </p>

      <div className="card">
        <h2>Rellenar desde el DNI</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Sube una foto del anverso y, si quieres máxima fiabilidad, también del
          reverso (la banda de letras de abajo permite verificar los datos).
        </p>
        <div className="grid">
          <label className="field">
            <span>Anverso (cara con la foto)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFront(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="field">
            <span>Reverso (opcional, recomendado)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setBack(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <button onClick={extractDni} disabled={extracting || (!front && !back)}>
          {extracting ? "Leyendo el DNI…" : "Extraer datos del DNI"}
        </button>
        {warnings.map((w, i) => (
          <div key={i} className="notice warn">
            {w}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Identidad</h2>
        <div className="grid">
          <label className="field">
            <span>Nombre</span>
            <input type="text" value={profile.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </label>
          <label className="field">
            <span>Primer apellido</span>
            <input type="text" value={profile.apellido1} onChange={(e) => set("apellido1", e.target.value)} />
          </label>
          <label className="field">
            <span>Segundo apellido</span>
            <input type="text" value={profile.apellido2} onChange={(e) => set("apellido2", e.target.value)} />
          </label>
          <label className="field">
            <span>Tipo de documento</span>
            <select
              value={profile.tipoDocumento}
              onChange={(e) => set("tipoDocumento", e.target.value as Profile["tipoDocumento"])}
            >
              <option value="DNI">DNI</option>
              <option value="NIE">NIE</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </label>
          <label className="field">
            <span>Número de documento</span>
            <input type="text" value={profile.numeroDocumento} onChange={(e) => set("numeroDocumento", e.target.value)} />
          </label>
          <label className="field">
            <span>Fecha de nacimiento</span>
            <input type="date" value={profile.fechaNacimiento} onChange={(e) => set("fechaNacimiento", e.target.value)} />
          </label>
          <label className="field">
            <span>Sexo (como figura en el DNI)</span>
            <select value={profile.sexo} onChange={(e) => set("sexo", e.target.value as Profile["sexo"])}>
              <option value="">—</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </label>
          <label className="field">
            <span>Nacionalidad</span>
            <input type="text" value={profile.nacionalidad} onChange={(e) => set("nacionalidad", e.target.value)} />
          </label>
        </div>
      </div>

      <div className="card">
        <h2>Contacto y dirección</h2>
        <div className="grid">
          <label className="field">
            <span>Email</span>
            <input type="email" value={profile.email} onChange={(e) => set("email", e.target.value)} />
          </label>
          <label className="field">
            <span>Teléfono</span>
            <input type="tel" value={profile.telefono} onChange={(e) => set("telefono", e.target.value)} />
          </label>
          <label className="field">
            <span>Dirección</span>
            <input type="text" value={profile.direccion} onChange={(e) => set("direccion", e.target.value)} />
          </label>
          <label className="field">
            <span>Código postal</span>
            <input type="text" value={profile.codigoPostal} onChange={(e) => set("codigoPostal", e.target.value)} />
          </label>
          <label className="field">
            <span>Localidad</span>
            <input type="text" value={profile.localidad} onChange={(e) => set("localidad", e.target.value)} />
          </label>
          <label className="field">
            <span>Provincia</span>
            <input type="text" value={profile.provincia} onChange={(e) => set("provincia", e.target.value)} />
          </label>
          <label className="field">
            <span>País</span>
            <input type="text" value={profile.pais} onChange={(e) => set("pais", e.target.value)} />
          </label>
        </div>
      </div>

      <div className="card">
        <h2>Datos de corredor</h2>
        <div className="grid">
          <label className="field">
            <span>Club (opcional)</span>
            <input type="text" value={profile.club} onChange={(e) => set("club", e.target.value)} />
          </label>
          <label className="field">
            <span>Talla de camiseta</span>
            <select
              value={profile.tallaCamiseta}
              onChange={(e) => set("tallaCamiseta", e.target.value as Profile["tallaCamiseta"])}
            >
              <option value="">—</option>
              {["XS", "S", "M", "L", "XL", "XXL"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Nº licencia federativa (si tienes)</span>
            <input type="text" value={profile.numeroLicencia} onChange={(e) => set("numeroLicencia", e.target.value)} />
          </label>
          <label className="field" style={{ alignSelf: "end" }}>
            <span>&nbsp;</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontWeight: 400 }}>
              <input
                type="checkbox"
                checked={profile.federado}
                onChange={(e) => set("federado", e.target.checked)}
                style={{ width: "auto" }}
              />
              Estoy federado/a
            </span>
          </label>
          <label className="field">
            <span>Contacto de emergencia — nombre</span>
            <input
              type="text"
              value={profile.contactoEmergenciaNombre}
              onChange={(e) => set("contactoEmergenciaNombre", e.target.value)}
            />
          </label>
          <label className="field">
            <span>Contacto de emergencia — teléfono</span>
            <input
              type="tel"
              value={profile.contactoEmergenciaTelefono}
              onChange={(e) => set("contactoEmergenciaTelefono", e.target.value)}
            />
          </label>
        </div>
        <label className="field">
          <span>Alergias / observaciones médicas (opcional)</span>
          <textarea
            rows={2}
            value={profile.observaciones}
            onChange={(e) => set("observaciones", e.target.value)}
          />
        </label>
      </div>

      <div className="row">
        <button onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar perfil"}
        </button>
      </div>
      {status && <div className="notice ok">{status}</div>}
      {error && <div className="notice error">{error}</div>}
    </>
  );
}
