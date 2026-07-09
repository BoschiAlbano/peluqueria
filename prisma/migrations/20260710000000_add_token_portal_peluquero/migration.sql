-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "tokenPortal" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_tokenPortal_key" ON "Usuario"("tokenPortal");
