-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DUENO', 'CAJERO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT,
    "nombre" TEXT NOT NULL,
    "rol" "Rol",
    "esPeluquero" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servicio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "cuentaParaBono" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" TEXT NOT NULL,
    "numeroTicket" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cajeroId" TEXT NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "comprobanteTransferenciaUlt4" CHAR(4),
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentaDetalle" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "peluqueroId" TEXT NOT NULL,
    "precioCobrado" DECIMAL(10,2) NOT NULL,
    "comisionPeluquero" DECIMAL(10,2) NOT NULL,
    "comisionDueno" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "VentaDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionComision" (
    "id" TEXT NOT NULL,
    "porcentajePeluquero" DECIMAL(5,2) NOT NULL DEFAULT 60,
    "porcentajeDueno" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfiguracionComision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaCajero" (
    "id" TEXT NOT NULL,
    "umbralCortes" INTEGER NOT NULL,
    "montoBono" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MetaCajero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesionCaja" (
    "id" TEXT NOT NULL,
    "cajeroId" TEXT NOT NULL,
    "cierreDiaId" TEXT,
    "etiqueta" TEXT,
    "horaApertura" TIMESTAMP(3) NOT NULL,
    "horaCierre" TIMESTAMP(3),
    "totalCortesSesion" INTEGER,
    "totalVentasSesion" DECIMAL(10,2),
    "sueldoBaseSesion" DECIMAL(10,2),
    "bonoSesion" DECIMAL(10,2),

    CONSTRAINT "SesionCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CierreDia" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "totalCortesDia" INTEGER NOT NULL,
    "bonoAlcanzado" BOOLEAN NOT NULL DEFAULT false,
    "montoBonoPorCaja" DECIMAL(10,2),

    CONSTRAINT "CierreDia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_authUserId_key" ON "Usuario"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_numeroTicket_key" ON "Venta"("numeroTicket");

-- CreateIndex
CREATE UNIQUE INDEX "CierreDia_fecha_key" ON "CierreDia"("fecha");

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaDetalle" ADD CONSTRAINT "VentaDetalle_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaDetalle" ADD CONSTRAINT "VentaDetalle_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaDetalle" ADD CONSTRAINT "VentaDetalle_peluqueroId_fkey" FOREIGN KEY ("peluqueroId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionCaja" ADD CONSTRAINT "SesionCaja_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionCaja" ADD CONSTRAINT "SesionCaja_cierreDiaId_fkey" FOREIGN KEY ("cierreDiaId") REFERENCES "CierreDia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
