-- Preferencias de canal de aviso del usuario.
ALTER TABLE "User" ADD COLUMN "notifyEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT false;
