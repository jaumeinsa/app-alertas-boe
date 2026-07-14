-- Minimización de datos (RGPD art. 5.1.c): el DNI completo no se usa para el
-- matching (solo el sufijo, que es lo que publican los boletines anonimizados).
-- Se vacían los valores ya almacenados; la columna se eliminará en una
-- migración futura cuando el worker antiguo se haya reconstruido.
UPDATE "MonitoredProfile" SET "fullDni" = NULL WHERE "fullDni" IS NOT NULL;
