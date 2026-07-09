-- Se saca "TARJETA" del enum MetodoPago: el negocio solo maneja efectivo y
-- transferencia. Postgres no permite borrar un valor de enum directamente,
-- así que se recrea el tipo sin ese valor.
BEGIN;
CREATE TYPE "MetodoPago_new" AS ENUM ('EFECTIVO', 'TRANSFERENCIA');
ALTER TABLE "Venta" ALTER COLUMN "metodoPago" TYPE "MetodoPago_new" USING ("metodoPago"::text::"MetodoPago_new");
ALTER TYPE "MetodoPago" RENAME TO "MetodoPago_old";
ALTER TYPE "MetodoPago_new" RENAME TO "MetodoPago";
DROP TYPE "MetodoPago_old";
COMMIT;
