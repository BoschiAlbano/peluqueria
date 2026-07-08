-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");
