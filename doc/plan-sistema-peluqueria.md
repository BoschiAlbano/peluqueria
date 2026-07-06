# Plan de Desarrollo — Sistema de Gestión para Peluquería

**Versión:** 1.1
**Fecha:** Julio 2026
**Estado:** Diseño aprobado — listo para iniciar Fase 1 (MVP)

---

## 1. Resumen del proyecto

Aplicación web (responsive, usable en PC y celular) para gestionar las operaciones diarias de una peluquería: registro de ventas, cálculo automático de comisiones, control de cajeros con bonos por objetivo, e impresión de tickets para clientes y peluqueros.

### 1.1 Datos del negocio

| Concepto | Detalle |
|---|---|
| Empleados peluqueros | 6 |
| Cajeros | Cantidad flexible (hoy 2, configurable a futuro). El negocio funciona con "sesiones de caja" (apertura/cierre), no con turnos fijos |
| Servicios | Corte, Barba, Afeitado |
| Comisión peluquero | 60% del servicio |
| Comisión dueño | 40% del servicio |
| Sueldo base cajero | $15.000 **por sesión de caja cerrada** |
| Bono cajero | $5.000 extra al alcanzar 60 cortes **en el día**, aplicado a **cada sesión de caja cerrada** ese día (escalones configurables) |
| Servicio que cuenta para el bono | Solo **Corte** (no Barba ni Afeitado) |

---

## 2. Roles y permisos

| Rol | Login | Acceso |
|---|---|---|
| **Dueño** | Sí (Supabase Auth) | Dashboard completo, reportes históricos, configuración de precios/comisiones/metas, acceso en cualquier momento del día |
| **Cajero** | Sí (Supabase Auth) | Registrar ventas, imprimir tickets, abrir/cerrar su sesión de caja. Ve el avance del bono del día en tiempo real |
| **Peluquero** | No | Se selecciona desde el POS al cargar una venta. No accede al sistema (a futuro, portal de solo lectura opcional) |

---

## 3. Reglas de negocio confirmadas

### 3.1 Comisión de peluqueros
- Se calcula **por línea de servicio**, no por ticket completo.
- `comisionPeluquero = precioServicio * 0.60`
- `comisionDueno = precioServicio * 0.40`
- El % se guarda como "foto" (snapshot) en cada venta. Si el dueño cambia el porcentaje a futuro, las ventas pasadas no se recalculan.

### 3.2 Bono de cajeros
- Se evalúa **por día completo**, sumando los cortes de todas las sesiones de caja del día (sea 1, 2 o más), no por sesión individual.
- Solo cuentan los servicios de tipo **Corte**.
- **Con escalones** (confirmado): a mayor cantidad de cortes en el día, mayor el bono. Ejemplo inicial:

  | Cortes en el día | Bono por sesión de caja cerrada |
  |---|---|
  | 60 o más | $5.000 |
  | 100 o más | $10.000 |

  Se toma el escalón más alto alcanzado (no se suman los escalones entre sí — si se llega a 100 cortes, el bono es $10.000, no $15.000). Los escalones son 100% configurables desde la tabla `MetaCajero`, se pueden agregar más niveles sin tocar código.
- **Regla clave (confirmada): el pago (sueldo base + bono) se calcula por cada sesión de caja cerrada, no por persona ni por turno fijo.** El sistema no tiene el concepto de "turno tarde/noche" — solo existen aperturas y cierres de caja. Esto da total libertad al dueño: puede operar con 1 cajero todo el día (una sola sesión), con 2 (como hoy), o con más en el futuro, sin que el sistema le imponga una estructura.
  - Si se alcanza el nivel de bono, se cobra **una vez por cada sesión de caja cerrada** ese día.
  - El sueldo base también se paga **una vez por cada sesión cerrada** (ver 3.2.1).
  - Ejemplo: si un cajero abre y cierra 2 sesiones en el mismo día (porque cubrió a otro que faltó), genera 2 pagos. Si el negocio opera con un solo cajero todo el día, hay una sola sesión y un solo pago.
- **Control de una sola caja abierta a la vez:** como hay una única caja física, el sistema no permite abrir una nueva sesión mientras ya hay una abierta sin cerrar. Esto evita que se dupliquen cajas activas por error, sin importar cuántos cajeros maneje el negocio.

#### 3.2.1 Ejemplo — un cajero cubre todo el día (2 sesiones)
El cajero de la mañana cubre también la tarde porque el otro cajero faltó: cierra su primera sesión de caja y abre una segunda a su nombre. En el día se hicieron 65 cortes (se alcanza el escalón de $5.000):

- Primera sesión (cubierta por Juan): $15.000 (sueldo) + $5.000 (bono) = $20.000
- Segunda sesión (cubierta también por Juan): $15.000 (sueldo) + $5.000 (bono) = $20.000
- **Total que cobra Juan ese día: $40.000** (por haber cerrado 2 sesiones de caja)

#### 3.2.2 Ejemplo — el negocio opera con un solo cajero todo el día
Si en el futuro el dueño decide tener un solo cajero cubriendo todo el día, se abre y cierra una única sesión de caja. Si ese día se hacen 65 cortes:

- Única sesión: $15.000 (sueldo) + $5.000 (bono) = **$20.000** para ese cajero.
- El sistema funciona exactamente igual, solo que hay una sesión en vez de dos.


### 3.3 Tickets
- **Ticket de cliente:** se imprime al cerrar cada venta.
- **Ticket de peluquero:** se genera al cierre del día, con el detalle de cortes/servicios realizados y el monto de comisión que le corresponde.
- **Ticket de cajero:** se genera al cierre del día, detallando sueldo base ($15.000) + bono (si se alcanzó algún escalón) = total a cobrar.
- Los tres tipos de ticket se generan **automáticamente** en el momento del cierre de día (ver 6.3), no hace falta imprimirlos manualmente uno por uno.
- Método de impresión (Fase 1): `window.print()` + CSS con `@media print`, formato ticket angosto (80mm).

### 3.4 Pagos por transferencia
- Cuando el método de pago es **Transferencia**, el cajero debe ingresar los **últimos 4 dígitos del comprobante de pago del banco** antes de confirmar la venta.
- Esos 4 dígitos se guardan en la venta (`Venta.comprobanteTransferenciaUlt4`) para poder cruzar el pago con el extracto bancario en caso de duda o reclamo.
- Solo aplica a `MetodoPago.TRANSFERENCIA`; para Efectivo y Tarjeta el campo queda en `null`.
- Validación en el servidor: exactamente 4 caracteres numéricos. Si el método es Transferencia y el campo falta o no cumple el formato, la venta no se persiste.

---

## 4. Stack tecnológico

| Capa | Tecnología | Motivo |
|---|---|---|
| Framework | **Next.js (App Router)** | SSR/Server Actions, un solo proyecto para PC y celular, deploy directo a Vercel |
| Hosting | **Vercel** | Integración nativa con Next.js, CI/CD automático |
| Base de datos | **Supabase (Postgres)** | Postgres administrado + Auth incluido |
| Autenticación | **Supabase Auth** (`@supabase/ssr`) | Solo para login/sesión de dueño y cajeros |
| ORM | **Prisma** | Toda la lógica de datos (ventas, comisiones, reportes) vía Server Actions, con su propia connection string |
| Estilos | **Tailwind CSS** | Ya definido — rapidez de desarrollo |
| Componentes UI | **shadcn/ui** | No es una librería tradicional: son componentes que se copian a tu proyecto (no agregan peso de runtime), están hechos sobre Tailwind + Radix, y se integran perfecto con Next.js. Ideal para tu tiempo limitado: tablas, formularios, modales y botones ya resueltos y accesibles |
| Iconos | **lucide-react** | Se integra directo con shadcn/ui, liviano |
| Gestión de estado remoto | **SWR** o `revalidatePath` de Next.js | Alcanza para refrescar el dashboard del dueño cada 30-60s, sin necesidad de Supabase Realtime en el MVP |

### Nota sobre Prisma + Supabase (importante)

Supabase promueve Row Level Security (RLS) pensado para usarse con `supabase-js`, pero Prisma se conecta con una connection string que no respeta RLS automáticamente. Para evitar fricción, la estrategia del proyecto es:

- **Supabase Auth** → solo login/sesión.
- **Prisma** → toda la lógica de negocio corre en el servidor (Server Actions), y ahí mismo se valida "¿este usuario es dueño o cajero?" en código, no en RLS.
- RLS queda activado como resguardo general (deny-by-default), pero no es donde vive la lógica fina.

### Nota sobre conexión a la base (Vercel es serverless)

Supabase entrega dos connection strings:
- **Pooled** (puerto 6543, vía pgbouncer) → usar en `DATABASE_URL` (runtime de la app).
- **Directa** (puerto 5432) → usar solo en `DIRECT_URL` (migraciones de Prisma).

Si se usa la directa en runtime, en producción se agotan las conexiones rápidamente.

---

## 5. Modelo de datos (Prisma Schema)

```prisma
enum Rol {
  DUENO
  CAJERO
}

enum MetodoPago {
  EFECTIVO
  TARJETA
  TRANSFERENCIA
}

model Usuario {
  id          String    @id @default(uuid())
  authUserId  String?   @unique // vínculo con Supabase Auth (null para peluqueros)
  nombre      String
  rol         Rol?      // null si es peluquero (no loguea)
  esPeluquero Boolean   @default(false)
  activo      Boolean   @default(true)
  createdAt   DateTime  @default(now())

  ventasComoCajero    Venta[]        @relation("CajeroVentas")
  serviciosRealizados VentaDetalle[] @relation("PeluqueroServicios")
  sesionesCaja        SesionCaja[]
}

model Servicio {
  id           String  @id @default(uuid())
  nombre       String  // Corte, Barba, Afeitado
  precio       Decimal @db.Decimal(10,2)
  cuentaParaBono Boolean @default(false) // true solo para "Corte"
  activo       Boolean @default(true)

  detalles VentaDetalle[]
}

model Venta {
  id                          String         @id @default(uuid())
  numeroTicket                Int            @unique @default(autoincrement())
  fecha                       DateTime       @default(now())
  cajeroId                    String
  cajero                      Usuario        @relation("CajeroVentas", fields: [cajeroId], references: [id])
  metodoPago                  MetodoPago
  comprobanteTransferenciaUlt4 String?       @db.Char(4) // obligatorio si metodoPago = TRANSFERENCIA; null en efectivo/tarjeta
  total                       Decimal        @db.Decimal(10,2)
  detalles                    VentaDetalle[]
}

model VentaDetalle {
  id                String   @id @default(uuid())
  ventaId           String
  venta             Venta    @relation(fields: [ventaId], references: [id])
  servicioId        String
  servicio          Servicio @relation(fields: [servicioId], references: [id])
  peluqueroId       String
  peluquero         Usuario  @relation("PeluqueroServicios", fields: [peluqueroId], references: [id])
  precioCobrado     Decimal  @db.Decimal(10,2)
  comisionPeluquero Decimal  @db.Decimal(10,2) // snapshot 60%
  comisionDueno     Decimal  @db.Decimal(10,2) // snapshot 40%
}

model ConfiguracionComision {
  id                  String   @id @default(uuid())
  porcentajePeluquero Decimal  @db.Decimal(5,2) @default(60)
  porcentajeDueno     Decimal  @db.Decimal(5,2) @default(40)
  vigenteDesde        DateTime @default(now())
}

model MetaCajero {
  id           String  @id @default(uuid())
  umbralCortes Int     // ej: 60, 100 (cada fila es un escalón)
  montoBono    Decimal @db.Decimal(10,2) // ej: 5000, 10000
  activo       Boolean @default(true)
}
```

**Ejemplo de datos semilla para los escalones del bono:**

```ts
await prisma.metaCajero.createMany({
  data: [
    { umbralCortes: 60, montoBono: 5000 },
    { umbralCortes: 100, montoBono: 10000 },
  ],
});
```

```prisma
// Cada apertura y cierre de caja física, sin importar cuántos cajeros maneje el negocio
model SesionCaja {
  id                String     @id @default(uuid())
  cajeroId          String
  cajero            Usuario    @relation(fields: [cajeroId], references: [id])
  cierreDiaId       String?    // se completa recién cuando cierra el día
  cierreDia         CierreDia? @relation(fields: [cierreDiaId], references: [id])
  etiqueta          String?    // opcional y solo informativo, ej: "Mañana", "Turno único" — no condiciona ninguna lógica
  horaApertura      DateTime
  horaCierre        DateTime?  // null mientras la caja sigue abierta
  totalCortesSesion Int?       // se calcula al cerrar la caja
  totalVentasSesion Decimal?   @db.Decimal(10,2)
  sueldoBaseSesion  Decimal?   @db.Decimal(10,2) // se completa en el cierre de día
  bonoSesion        Decimal?   @db.Decimal(10,2) // se completa en el cierre de día
}

// Cierre del DÍA: agrupa TODAS las sesiones de caja del día (1, 2 o más) y decide el bono
model CierreDia {
  id               String       @id @default(uuid())
  fecha            DateTime     @unique @db.Date
  totalCortesDia   Int
  bonoAlcanzado    Boolean      @default(false)
  montoBonoPorCaja Decimal?     @db.Decimal(10,2) // lo que cobra CADA sesión de caja cerrada, si se alcanzó un escalón
  sesionesCaja     SesionCaja[]
}
```

**Por qué este diseño resuelve tu pedido:** ya no existe el concepto de "turno tarde/noche" como algo fijo del sistema. Lo único que existe es **abrir una caja** y **cerrarla**. El dueño decide operativamente cuántas veces se abre y cierra la caja en un día — con 1 cajero (una sola apertura/cierre), con 2 (como hoy), o con más en el futuro. El sistema no le impone ninguna estructura: solo suma lo que efectivamente se abrió y cerró ese día.

**Control de una sola caja abierta a la vez:** dado que hay una única caja física, el sistema **no permite abrir una nueva `SesionCaja` mientras ya existe una sin `horaCierre`** (es decir, sin cerrar). Esto se valida en el servidor al momento de abrir caja, no depende de que el cajero o el dueño estén controlándolo manualmente. Si el cajero de la mañana necesita cubrir todo el día porque el otro faltó, cierra su primera sesión normalmente y abre una segunda a su nombre — el sistema lo permite sin fricción, ya que solo exige que no haya dos sesiones abiertas *al mismo tiempo*.

**Cómo se paga cada sesión:** al cierre de día, cada `SesionCaja` cerrada ese día recibe su propio `sueldoBaseSesion` (fijo) + `bonoSesion` (si el total de cortes del día alcanzó algún escalón de `MetaCajero` — el monto de ese escalón se aplica completo a **cada** sesión cerrada, no se reparte entre sesiones). Si un mismo cajero cerró 2 sesiones ese día, cobra 2 pagos — ver ejemplo actualizado en 3.2.1.

---

## 6. Flujos principales

### 6.1 Cargar una venta (POS)
1. Cajero selecciona peluquero(s), servicio(s) y método de pago.
2. Si el método es **Transferencia**, el POS muestra un campo para ingresar los **últimos 4 dígitos del comprobante bancario** (obligatorio antes de confirmar).
3. Por cada línea: se calcula `comisionPeluquero` (60%) y `comisionDueno` (40%) según la config vigente.
4. Se persiste `Venta` + `VentaDetalle` en una transacción (`prisma.$transaction`), incluyendo `comprobanteTransferenciaUlt4` cuando corresponda.
5. Se genera el número de ticket y se dispara la impresión (`window.print()`). En transferencias, el ticket de cliente puede incluir esos 4 dígitos como referencia.

### 6.2 Abrir y cerrar una sesión de caja (cajero)
1. Al empezar a trabajar, el cajero presiona "Abrir caja" (opcionalmente le puede poner una etiqueta libre, ej. "Mañana" — es solo informativo, no afecta ningún cálculo).
2. El sistema no permite abrir una nueva sesión si ya hay una abierta ese día sin cerrar (una sola caja física a la vez).
3. Al terminar, el cajero presiona "Cerrar caja" → se completan `horaCierre`, `totalCortesSesion` y `totalVentasSesion` de esa sesión (aún sin definir el bono, eso pasa en el cierre de día).
4. **Caso — un cajero cubre el resto del día:** si el cajero de la tarde no puede ir, el cajero de la mañana simplemente cierra su primera sesión y **abre una segunda sesión a su propio nombre**. No hace falta ningún paso extra ni configuración especial — el sistema no distingue "quién debería" cubrir cada sesión, solo registra quién la abrió y cerró.

### 6.3 Cierre de día (se dispara automáticamente al cerrar la última sesión abierta)
1. El día contable **no cierra a las 00:00hs**, sino en el momento en que **ya no queda ninguna sesión de caja abierta ese día** — sin importar si hubo 1, 2 o más sesiones, ni quién las cerró.
2. Se suman los cortes de todas las `SesionCaja` del día → `totalCortesDia`.
3. Se busca en `MetaCajero` el escalón más alto cuyo `umbralCortes` sea menor o igual a `totalCortesDia`. Si no se alcanza ningún escalón, no hay bono.
4. **El pago se calcula por cada sesión de caja cerrada, no por persona:** cada sesión genera su propio `sueldoBaseSesion` ($15.000) + su propio `bonoSesion` (si se alcanzó un escalón, el monto de ese escalón). Si un mismo cajero cerró 2 sesiones ese día, se generan y suman 2 pagos a su nombre — ver ejemplos en 3.2.1 y 3.2.2.
5. En ese mismo momento se genera automáticamente **el ticket de cada sesión de caja** con el detalle de qué cubrió y el total a cobrar.
6. También se generan automáticamente los tickets de cada peluquero (detalle de cortes/servicios del día + comisión 60%).
7. El dueño se queda con el 40% restante de cada servicio — esto no requiere ticket físico, queda reflejado en su dashboard como ganancia del día.

### 6.4 Dashboard del dueño
- Ventas del día/semana/mes, filtrable por rango.
- Ranking de peluqueros (cortes hechos, plata generada).
- Estado en vivo del avance hacia el bono del día (ej. "42/60 cortes").
- Acceso disponible en cualquier momento, desde PC o celular.

---

## 7. Roadmap por fases

### 🚀 Fase 1 — MVP (prioridad: salir a producción rápido)
- [ ] Setup del proyecto: Next.js + Tailwind + shadcn/ui + Prisma + Supabase
- [ ] Auth con Supabase (roles: dueño, cajero)
- [ ] CRUD de empleados (peluqueros y cajeros) y servicios
- [ ] POS: carga de venta con selección de peluquero + servicio + método de pago
- [ ] Cálculo automático de comisión 60/40
- [ ] Impresión de ticket de cliente (`window.print()` + CSS)
- [ ] Apertura y cierre de sesión de caja por cajero
- [ ] Cierre de día + cálculo de bono + ticket de peluquero
- [ ] Dashboard básico del dueño (ventas del día, avance del bono)

### Fase 2 — Consolidación
- [ ] Reportes históricos (por rango de fechas, por peluquero, por servicio)
- [ ] Exportación a CSV/Excel
- [ ] Configuración editable de porcentajes de comisión y umbral de bono desde la UI
- [ ] PWA (instalar como app en el celular del cajero)

### Fase 3 — Escalabilidad
- [ ] Portal de solo lectura para peluqueros (ver sus propias ganancias)
- [ ] Impresión sin diálogo (QZ Tray) para agilizar el POS
- [ ] Métodos de pago integrados (Mercado Pago u otro)
- [ ] Soporte multi-sucursal, si el negocio escala

---

## 8. Estructura de carpetas sugerida (Next.js App Router)

```
/app
  /(auth)/login
  /(dashboard)/dueno/...        → páginas del dueño
  /(pos)/caja/...               → páginas del cajero
  /api/...                      → route handlers si hacen falta
/actions
  ventas.ts                     → server actions de POS
  cierres.ts                    → server actions de cierre de sesión de caja / día
  reportes.ts
/components
  ui/                           → componentes de shadcn/ui
  ticket/                       → componentes de impresión (cliente y peluquero)
/lib
  prisma.ts                     → cliente Prisma
  supabase/server.ts            → cliente Supabase (auth)
/prisma
  schema.prisma
```

---

## 9. Decisiones de negocio — estado

✅ Todas las decisiones de negocio necesarias para arrancar la Fase 1 quedaron confirmadas:

- Comisión peluqueros: 60% / 40%.
- Bono cajero: por día completo (sumando todas las sesiones de caja del día), solo cuenta el servicio "Corte".
- Bono con escalones (60 cortes = $5.000, 100 cortes = $10.000, configurable).
- **El sistema no maneja turnos fijos ("tarde"/"noche"), sino sesiones de caja (apertura + cierre).** El dueño decide operativamente cuántas sesiones hay por día — hoy 2, pero puede pasar a 1, a 3, o a la cantidad que necesite, sin cambios en el sistema.
- Si se alcanza un escalón de bono, **cada sesión de caja cerrada ese día cobra el monto completo** (no se reparte entre sesiones).
- El pago (sueldo base + bono) se calcula **por sesión cerrada, no por persona**: si un mismo cajero cierra 2 sesiones en el día (por cubrir a otro que faltó), cobra 2 pagos completos.
- Solo puede haber **una sesión de caja abierta a la vez** (una única caja física) — el sistema lo valida automáticamente, no depende del control manual del dueño o del cajero.
- El día contable cierra cuando se cierra la última sesión de caja abierta ese día (no a las 00:00hs), y en ese momento se generan los tickets de peluqueros y de cada sesión de caja.
- Pagos por **Transferencia**: se guardan los últimos 4 dígitos del comprobante bancario en cada venta (`comprobanteTransferenciaUlt4`).

**Único detalle técnico a tener en cuenta durante el desarrollo (no bloquea el arranque):** si una sesión de caja cruza la medianoche, hay que definir con qué `fecha` se guarda el `CierreDia` — normalmente se usa la fecha en que **empezó** la primera sesión del día (el "día comercial"), no la fecha del reloj en el momento exacto del cierre. Esto se resuelve en el código, no requiere ninguna decisión adicional de tu parte.

---

## 10. Variables de entorno necesarias

```env
# Prisma (runtime — connection pooled)
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true"

# Prisma (solo migraciones — conexión directa)
DIRECT_URL="postgresql://...supabase.co:5432/postgres"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
```

---

## 11. Próximo paso sugerido

Con el tiempo acotado que mencionás, lo más eficiente es arrancar por el **flujo de venta completo**: cargar venta → calcular comisión → generar ticket. Es el corazón del sistema y una vez que funciona, el resto (cierres, dashboard) se construye alrededor de esa base.
