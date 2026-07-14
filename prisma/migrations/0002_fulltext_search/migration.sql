-- Búsqueda full-text para localizar nombres dentro del texto de los documentos.
-- Convierte la tabla Publication en un motor de búsqueda escalable a millones
-- de filas: columna tsvector + índice GIN, con unaccent y sin stemming (ideal
-- para nombres propios). Un trigger mantiene el vector al insertar/actualizar.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Configuración de búsqueda: base 'simple' (sin stemming) + diccionario unaccent
-- para que "García" / "GARCIA" / "garcia" casen igual.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'es_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION es_unaccent (COPY = simple);
    ALTER TEXT SEARCH CONFIGURATION es_unaccent
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;
  END IF;
END$$;

ALTER TABLE "Publication" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- El vector se construye a partir del título + el cuerpo (searchText).
CREATE OR REPLACE FUNCTION notifikado_pub_tsv() RETURNS trigger AS $func$
BEGIN
  NEW."searchVector" := to_tsvector(
    'es_unaccent',
    coalesce(NEW.title, '') || ' ' || coalesce(NEW."searchText", '')
  );
  RETURN NEW;
END
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pub_tsv ON "Publication";
CREATE TRIGGER trg_pub_tsv
  BEFORE INSERT OR UPDATE OF title, "searchText"
  ON "Publication"
  FOR EACH ROW EXECUTE FUNCTION notifikado_pub_tsv();

-- Rellena el vector de las filas ya existentes.
UPDATE "Publication"
  SET "searchVector" = to_tsvector(
    'es_unaccent',
    coalesce(title, '') || ' ' || coalesce("searchText", '')
  );

-- Índice GIN: hace que la búsqueda de nombres sea casi instantánea.
CREATE INDEX IF NOT EXISTS "Publication_searchVector_gin"
  ON "Publication" USING GIN ("searchVector");
