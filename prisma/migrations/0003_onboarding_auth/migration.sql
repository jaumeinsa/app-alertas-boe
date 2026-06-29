-- Onboarding (consentimiento RGPD), login por magic-link y tipo de documento.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "consentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "consentVersion" TEXT;

ALTER TABLE "MonitoredProfile"
  ADD COLUMN IF NOT EXISTS "idType" TEXT;

CREATE TABLE IF NOT EXISTS "LoginToken" (
  "id"        TEXT NOT NULL,
  "token"     TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoginToken_token_key" ON "LoginToken"("token");
CREATE INDEX IF NOT EXISTS "LoginToken_userId_idx" ON "LoginToken"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LoginToken_userId_fkey'
  ) THEN
    ALTER TABLE "LoginToken"
      ADD CONSTRAINT "LoginToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
