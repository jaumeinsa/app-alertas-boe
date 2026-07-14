/**
 * Administración: la lista de emails con acceso al panel /admin vive en la
 * variable de entorno ADMIN_EMAILS (separados por comas). Sin variable, nadie
 * es administrador (no hay valores por defecto en el código: el repo es público).
 */

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}
