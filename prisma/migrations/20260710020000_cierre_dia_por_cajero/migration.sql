-- El bono pasa a calcularse por cajero, no por local: CierreDia necesita una
-- dimensión de cajero además de la fecha. Se agrega la columna nullable
-- primero, se rellena con el cajeroId de la sesión que ya tenga asociada
-- (todo CierreDia existente tiene al menos una sesión), y recién después se
-- vuelve NOT NULL y se cambia el índice único de "fecha" a "(fecha, cajeroId)".

-- AlterTable
ALTER TABLE "CierreDia" ADD COLUMN "cajeroId" TEXT;

-- Backfill: cada CierreDia existente toma el cajero de su primera sesión.
UPDATE "CierreDia" cd
SET "cajeroId" = (
  SELECT sc."cajeroId" FROM "SesionCaja" sc WHERE sc."cierreDiaId" = cd.id LIMIT 1
);

ALTER TABLE "CierreDia" ALTER COLUMN "cajeroId" SET NOT NULL;

-- DropIndex
DROP INDEX "CierreDia_fecha_key";

-- CreateIndex
CREATE UNIQUE INDEX "CierreDia_fecha_cajeroId_key" ON "CierreDia"("fecha", "cajeroId");

-- AddForeignKey
ALTER TABLE "CierreDia" ADD CONSTRAINT "CierreDia_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
