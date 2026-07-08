# Plan de Desarrollo — Sistema de Gestión para Peluquería

**Versión:** 1.5
**Fecha:** Julio 2026
**Estado:** ✅ Fase 1 (MVP) completa — venta, caja, cierre de día, configuración, dashboard del dueño y Auth (login por usuario, sin email ni registro) funcionando end-to-end

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

### 2.1 Sin auto-registro — cuentas aprovisionadas por el dueño

**Decisión (confirmada):** no existe una pantalla de registro. El dueño es quien crea, modifica y desactiva las cuentas de cajero desde `/configuracion` (nombre, usuario, contraseña). Esto evita cuentas falsas y mantiene el control de acceso centralizado en una sola persona.

- **Login por nombre de usuario, no por email:** ni el dueño ni los cajeros escriben un email para entrar — solo "Usuario" y contraseña. Supabase Auth exige internamente un email para el login por contraseña, así que el sistema genera uno **sintético** a partir del username (`lib/auth-username.ts`, ej. `el.maestro@peluqueria.internal`) que nunca se muestra ni se usa para enviar nada. El username se normaliza (minúsculas, sin acentos, espacios → puntos) tanto al crear la cuenta como al loguearse, así "El Maestro", "el maestro" o "EL MAESTRO" resuelven al mismo usuario.
- **Creación:** el dueño ingresa nombre + usuario + contraseña. Por detrás se crea el usuario en Supabase Auth con el email sintético (vía Service Role Key, API admin — nunca expuesta al cliente) y se vincula al registro `Usuario` en Prisma (`authUserId`, `username`).
- **Edición:** nombre editable; contraseña se puede resetear en cualquier momento (`admin.auth.admin.updateUserById`).
- **"Borrado" = desactivar, no eliminar:** como las ventas y sesiones de caja pasadas referencian al `Usuario` del cajero, no se puede borrar el registro sin perder ese historial. En su lugar, el dueño lo marca como inactivo (`activo = false`): pierde acceso al sistema (el login lo rechaza aunque la contraseña sea correcta), pero el historial se preserva y se puede reactivar después.
- **Cuenta inicial del dueño:** como no hay registro, la primera cuenta de dueño (usuario `el.maestro`) se creó y vinculó una única vez a mano (Service Role Key + vinculación manual al `Usuario` con `rol = DUENO` del seed) — no es un flujo repetible desde la UI.
- **Autorización en el servidor:** cada Server Action de escritura sensible (`crearCajero`, `actualizarComision`, etc.) valida `requireDueno()` — no alcanza con ocultar el link en el menú; si un cajero navega directo a `/configuracion` o `/dueno`, el propio layout lo redirige a `/ventas`.

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
- **Ticket de control de caja (cajero, al cerrar su sesión):** al presionar "Cerrar caja" (la sesión, no el día), se muestra un ticket chico con el desglose de ingresos por método de pago (Efectivo/Tarjeta/Transferencia) y los servicios brindados en esa sesión — para que el cajero controle la plata en mano antes de irse. **No incluye sueldo ni bono** (eso se calcula recién en el cierre de día).
- **Ticket de peluquero:** se genera al cierre del día, con el detalle de cortes/servicios realizados y el monto de comisión que le corresponde.
- **Ticket de cajero (liquidación):** se genera al cierre del día, detallando sueldo base ($15.000) + bono (si se alcanzó algún escalón) = total a cobrar, para cada sesión de caja liquidada ese día.
- Los tickets de peluquero y de liquidación de cajero se generan **automáticamente** al presionar "Cerrar caja del día" (ver 6.3), no hace falta imprimirlos manualmente uno por uno.
- Método de impresión (Fase 1): **`react-to-print`** (no `window.print()` directo). Clona solo el nodo del ticket en un iframe aislado con su propio documento, evitando que el resto de la app interfiera con la impresión. Formato ticket angosto **58mm**, con `@page { size: 58mm auto; margin: 0 }`.
- **Los tickets se arman como texto plano monoespaciado (`lib/ticket-texto.ts`), no con layout CSS (flexbox/bordes).** La impresora térmica real usa el driver "Generic / Text Only" de Windows, que ignora casi todo el CSS y solo respeta caracteres literales + espacios manuales — con flexbox los montos alineados a la derecha no imprimían, y las líneas separadoras con `border` tampoco. La solución (igual a la que ya usa el dueño en otro proyecto con impresora térmica) es construir cada línea como un string ya alineado a mano dentro de un ancho fijo (`MAX`, ver nota de calibración abajo): `addCenter` para centrar, `addExtremes` para alinear un label a la izquierda y un monto a la derecha, `addSeparator` para las líneas divisorias (con guiones, no con `border`). Todo se renderiza en un único `<pre>` con fuente monoespaciada.
- **Los montos NO se formatean con `Intl.NumberFormat({style:"currency"})`.** Ese formateador inserta un espacio "no separable" (U+00A0, no ASCII) entre el `$` y el número — la impresora en modo texto no lo reconoce y corta la línea justo ahí (solo se veía el `$`). `formatoMonto()` en `lib/ticket-texto.ts` arma el monto a mano (`$` + separador de miles con `.`) usando exclusivamente caracteres ASCII.
- **Calibración del ancho (`MAX`):** el valor correcto de caracteres por línea depende del driver/fuente real de cada impresora — no hay forma de saberlo sin probar en el hardware. Se ajusta un único número en `lib/ticket-texto.ts`. Si las líneas se siguen cortando, bajarlo; si sobra mucho margen a la derecha, subirlo.

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

### Nota sobre la PWA

- **Manifest:** `app/manifest.ts` (convención de Next.js, se sirve en `/manifest.webmanifest`). `start_url` apunta a `/ventas` (la pantalla que usa el cajero a diario).
- **Íconos:** generados desde `public/Logo.svg` con `scripts/generar-iconos.ts` (usa `sharp`). El color original del logo (`#FDE5F2`, rosa muy claro) se reemplaza por un gris oscuro (`#171717`, el mismo que `--foreground`) para que se vea bien como ícono. Volver a correr el script (`pnpm exec tsx scripts/generar-iconos.ts`) si el logo cambia.
- **Service worker:** `public/sw.js`, mínimo a propósito — no cachea nada bajo `/api/`, y las navegaciones van siempre a la red primero (con fallback offline a `/`). Solo cachea assets estáticos para que abra más rápido.
- **⚠️ El service worker solo se registra en producción (`NODE_ENV === "production"`).** En dev con Turbopack, los chunks de JS no tienen hash de contenido como en producción — el service worker cacheando "cache primero" puede servir un chunk viejo aunque el código ya cambió del lado del servidor, rompiendo el HMR con un error confuso (`Module ... was instantiated ... but the module factory is not available`) que en un primer momento parecía un bug de routing/caché de Next, no del service worker. `components/pwa/register-sw.tsx` además desregistra cualquier SW ya instalado y limpia el Cache Storage cuando corre en dev, para autocurar el navegador de quien ya lo tenía activo de una prueba anterior.
- **Bug encontrado y corregido:** `proxy.ts` (el middleware de auth) no excluía `/manifest.webmanifest` ni `/sw.js` de la protección de rutas, así que un usuario sin sesión los recibía redirigidos a `/login` en vez del archivo real — rompía la instalación de la PWA. Se agregaron ambos al matcher que excluye rutas públicas.

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
  username    String?   @unique // login por usuario, no por email (ver lib/auth-username.ts)
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
2. Si el método es **Efectivo**, el POS muestra un campo "Paga con" para calcular el vuelto en vivo (monto recibido − total). Es solo una ayuda visual para el cajero — no se guarda en la base, no es parte del modelo de datos.
3. Si el método es **Transferencia**, el POS muestra un campo para ingresar los **últimos 4 dígitos del comprobante bancario** (obligatorio antes de confirmar).
3. Por cada línea: se calcula `comisionPeluquero` (60%) y `comisionDueno` (40%) según la config vigente.
4. Se persiste `Venta` + `VentaDetalle` en una transacción (`prisma.$transaction`), incluyendo `comprobanteTransferenciaUlt4` cuando corresponda.
5. Se genera el número de ticket y se dispara la impresión (`react-to-print`). En transferencias, el ticket de cliente puede incluir esos 4 dígitos como referencia.

### 6.2 Abrir y cerrar una sesión de caja (cajero)
1. Al empezar a trabajar, el cajero presiona "Abrir caja" (opcionalmente le puede poner una etiqueta libre, ej. "Mañana" — es solo informativo, no afecta ningún cálculo).
2. El sistema no permite abrir una nueva sesión si ya hay una abierta ese día sin cerrar (una sola caja física a la vez).
3. Al terminar, el cajero presiona "Cerrar caja" → se completan `horaCierre`, `totalCortesSesion` y `totalVentasSesion` de esa sesión. **Este cierre no calcula sueldo ni bono** (eso pasa recién en 6.3) — solo muestra el ticket de control de caja (3.3) para que el cajero verifique lo recaudado antes de irse.
4. **Caso — un cajero cubre el resto del día:** si el cajero de la tarde no puede ir, el cajero de la mañana simplemente cierra su primera sesión y **abre una segunda sesión a su propio nombre**. No hace falta ningún paso extra ni configuración especial — el sistema no distingue "quién debería" cubrir cada sesión, solo registra quién la abrió y cerró. El cajero puede abrir y cerrar caja las veces que haga falta en el día (mañana, tarde, noche, según cuántos cajeros trabajen).

### 6.3 Cierre de día (acción explícita: botón "Cerrar caja del día")
1. **No es automático.** Como el sistema solo permite una sesión de caja abierta a la vez, no hay forma confiable de saber en el momento de cerrar una sesión si "es la última del día" — cerrar una sesión no implica que no se vaya a abrir otra más tarde (ver ejemplo 3.2.1). Por eso el cierre de día es un botón separado en la página **Caja**, que el cajero o el dueño presiona cuando ya no va a haber más sesiones ese día.
2. El botón se habilita solo si **no hay ninguna caja abierta** en ese momento.
3. Al presionarlo, se toman **todas las sesiones de caja cerradas que todavía no fueron liquidadas** (sin importar cuántas hubo ni quién las cerró) y se agrupan en un `CierreDia` para esa fecha.
4. Se suman los cortes de todas esas sesiones → `totalCortesDia`. Se busca en `MetaCajero` el escalón más alto cuyo `umbralCortes` sea menor o igual a `totalCortesDia`. Si no se alcanza ningún escalón, no hay bono.
5. **El pago se calcula por cada sesión de caja liquidada, no por persona:** cada sesión recibe su propio `sueldoBaseSesion` ($15.000) + su propio `bonoSesion` (si se alcanzó un escalón, el monto de ese escalón). Si un mismo cajero cerró 2 sesiones ese día, se generan y suman 2 pagos a su nombre — ver ejemplos en 3.2.1 y 3.2.2.
6. Se muestra un resumen con el ticket de liquidación de cada sesión (sueldo + bono) y el ticket de comisión de cada peluquero (detalle de cortes/servicios del día + comisión 60%), listos para imprimir.
7. El dueño se queda con el 40% restante de cada servicio — esto no requiere ticket físico, queda reflejado en su dashboard como ganancia del día.
8. **Nota técnica:** si se presiona "Cerrar caja del día" y más tarde se abre y cierra otra sesión el mismo día calendario, al volver a presionar el botón el `CierreDia` de esa fecha se **recalcula** (no se duplica): el bono se reevalúa sobre el nuevo total de cortes y se actualiza retroactivamente en todas las sesiones de esa fecha, incluidas las ya liquidadas antes.

### 6.4 Dashboard del dueño
- Ventas del día/semana/mes, filtrable por rango.
- Ranking de peluqueros (cortes hechos, plata generada).
- Estado en vivo del avance hacia el bono del día (ej. "42/60 cortes").
- Acceso disponible en cualquier momento, desde PC o celular.

---

## 7. Roadmap por fases

### 🚀 Fase 1 — MVP (prioridad: salir a producción rápido)
- [x] Setup del proyecto: Next.js + Tailwind + shadcn/ui + Prisma + Supabase
- [x] Auth con Supabase (roles: dueño, cajero) — login real, sin registro; el dueño aprovisiona cajeros desde Configuración (ver §2.1)
- [x] CRUD de peluqueros (crear, editar nombre, desactivar/reactivar) en `/configuracion` — sin login, mismo patrón de "desactivar en vez de borrar" que los cajeros
- [x] POS: carga de venta con selección de peluquero + servicio + método de pago
- [x] Cálculo automático de comisión 60/40
- [x] Impresión de ticket de cliente (`react-to-print`, formato 58mm)
- [x] Apertura y cierre de sesión de caja por cajero (las veces que haga falta en el día), con ticket de control de caja al cerrar (desglose por método de pago y servicios)
- [x] Cierre de día (acción explícita "Cerrar caja del día") + cálculo de bono + ticket de peluquero + ticket de liquidación de cajero
- [x] Dashboard básico del dueño (ventas por rango hoy/semana/mes, ranking de peluqueros, avance en vivo del bono del día)

### Fase 2 — Consolidación
- [x] Reportes históricos (por rango de fechas personalizado, filtrable por peluquero y por servicio) en `/dueno/reportes`
- [x] Exportación a CSV (con BOM UTF-8 para que Excel muestre bien los acentos)
- [x] Configuración editable de porcentajes de comisión, precios de servicios y escalones de bono (`MetaCajero`) desde la UI (página `/configuracion`) — adelantada desde Fase 2
- [x] PWA (instalar como app en el celular del cajero): manifest, íconos (generados desde `public/Logo.svg`), service worker mínimo y responsive (sidebar colapsable en mobile)

### Fase 3 — Escalabilidad
- [ ] Portal de solo lectura para peluqueros (ver sus propias ganancias)
- [ ] Impresión sin diálogo (QZ Tray) para agilizar el POS
- [ ] Métodos de pago integrados (Mercado Pago u otro)
- [ ] Soporte multi-sucursal, si el negocio escala

---

## 8. Estructura de carpetas (Next.js App Router)

**Decisión (confirmada):** un único dashboard compartido para dueño y cajero, no dos áreas separadas. `(dashboard)/layout.tsx` es el shell común (sidebar/header); adentro, cada página es una sección funcional: **Ventas** (POS), **Caja** (abrir/cerrar sesión + cerrar día), **Configuración** (precios y comisión, solo dueño) y **Dueño** (reportes, pendiente). La validación de acceso (qué rol puede ver qué) se hace en cada página/Server Action, no duplicando layouts. `/` queda libre para una landing futura; por ahora tiene el placeholder de Next.js sin tocar.

```
/app
  page.tsx                          → landing (placeholder por ahora, libre para el futuro)
  /(auth)/login/page.tsx            → login real (dueño y cajero) — sin registro
  /(dashboard)/layout.tsx           → shell compartido — valida sesión (redirige a /login) y filtra el menú por rol
  /(dashboard)/ventas/page.tsx      → POS: carga de venta (requiere una caja abierta)
  /(dashboard)/caja/page.tsx        → abrir/cerrar sesión de caja + botón "Cerrar caja del día"
  /(dashboard)/configuracion/page.tsx → dueño: precios, % de comisión y CRUD de cajeros
  /(dashboard)/dueno/page.tsx       → dashboard del dueño: ventas por rango, ranking de peluqueros, avance del bono
  /(dashboard)/dueno/reportes/page.tsx → reportes históricos: rango de fechas + filtro por peluquero/servicio, export CSV
  /api/reportes/csv/route.ts        → genera y descarga el CSV con los mismos filtros del reporte
  /api/...                          → route handlers si hacen falta
  manifest.ts                       → manifest de la PWA (convención de Next.js, sirve en /manifest.webmanifest)
  icon.png, apple-icon.png          → favicon e ícono iOS (convención de Next.js, generados por scripts/generar-iconos.ts)
/actions
  ventas.ts                         → crearVenta (POS)
  caja.ts                           → abrirSesion, cerrarSesion, cerrarDia, obtenerEstadoCierreDia
  configuracion.ts                  → actualizarPrecioServicio, actualizarComision, listarMetas, crearMeta, actualizarMeta, cambiarEstadoMeta
  usuarios.ts                       → listarCajeros, crearCajero, actualizarCajero, cambiarPasswordCajero, cambiarEstadoCajero
  auth.ts                           → login, logout
/components
  ui/                               → componentes de shadcn/ui
  auth/                             → LoginForm
  layout/                           → NavLinks, MobileNav (sidebar desktop + panel deslizable en mobile)
  pwa/                              → RegisterServiceWorker
  pos/                              → PosForm, SesionCajaCard, CierreDiaCard
  configuracion/                    → PreciosForm, ComisionForm, CajerosForm, PeluquerosForm, MetasForm
  ticket/                           → componentes de impresión (cliente, control de caja, liquidación de cajero, peluquero)
/scripts
  generar-iconos.ts                 → regenera los íconos de la PWA a partir de public/Logo.svg
/lib
  prisma.ts                         → cliente Prisma
  auth.ts                           → obtenerUsuarioActual, requireUsuario, requireDueno (usados en páginas y Server Actions)
  auth-username.ts                  → normalizarUsername, emailSinteticoParaUsername (login por usuario, no por email)
  config-negocio.ts                 → SUELDO_BASE_CAJERO (fijo, no editable desde la UI todavía)
  rangos-fecha.ts                   → helpers de rango hoy/semana/mes para el dashboard del dueño
  reportes.ts                       → obtenerFilasReporte, filasACsv (usados por la página y por la ruta de export)
  supabase/server.ts                → cliente Supabase para Server Components/Actions (cookies, anon key)
  supabase/middleware.ts            → refresca la sesión y redirige rutas protegidas/públicas
  supabase/admin.ts                 → cliente con Service Role Key — solo en Server Actions ya validadas como DUEÑO
/proxy.ts                            → engancha lib/supabase/middleware.ts a nivel de Next.js (reemplaza a middleware.ts, deprecado en Next.js 16)
/prisma
  schema.prisma
  seed.ts                           → datos base: servicios, comisión 60/40, escalones de MetaCajero, usuarios de prueba
```

Nota: como `(auth)` y `(dashboard)` son *route groups* de Next.js (paréntesis), no agregan segmento a la URL — las rutas reales quedan en `/login`, `/ventas`, `/caja`, `/configuracion` y `/dueno`, todas hijas de `app/`.

---

## 9. Decisiones de negocio — estado

✅ Todas las decisiones de negocio necesarias para arrancar la Fase 1 quedaron confirmadas:

- Comisión peluqueros: 60% / 40%.
- Bono cajero: por día completo (sumando todas las sesiones de caja del día), solo cuenta el servicio "Corte".
- Bono con escalones (60 cortes = $5.000, 100 cortes = $10.000, configurable).
- **El sistema no maneja turnos fijos ("tarde"/"noche"), sino sesiones de caja (apertura + cierre).** El dueño decide operativamente cuántas sesiones hay por día — hoy 2, pero puede pasar a 1, a 3, o a la cantidad que necesite, sin cambios en el sistema.
- Si se alcanza un escalón de bono, **cada sesión de caja cerrada ese día cobra el monto completo** (no se reparte entre sesiones).
- El pago (sueldo base + bono) se calcula **por sesión cerrada, no por persona**: si un mismo cajero cierra 2 sesiones en el día (por cubrir a otro que faltó), cobra 2 pagos completos.
- Solo puede haber **una sesión de caja abierta a la vez** (una única caja física) — el sistema lo valida automáticamente, no depende del control manual del dueño o del cajero. El cajero puede abrir y cerrar caja las veces que necesite en el día (mañana, tarde, noche, según cuántos cajeros trabajen).
- **El cierre de día es una acción explícita** ("Cerrar caja del día" en la página Caja), no automática — cerrar una sesión no implica que sea la última del día, así que el sistema no puede "adivinarlo". El botón se habilita cuando no hay ninguna caja abierta, y liquida todas las sesiones cerradas pendientes, generando los tickets de peluqueros y de liquidación de cada sesión. Si se presiona más de una vez el mismo día (por abrirse otra sesión después), se recalcula sobre el total actualizado sin duplicar el registro.
- Al cerrar una **sesión de caja** (no el día), el cajero recibe un ticket de control chico con el desglose de lo cobrado por método de pago y los servicios brindados — para que pueda verificar la plata en mano antes de irse. No incluye sueldo ni bono.
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

## 11. Estado actual y próximo paso sugerido

Ya están construidos y verificados end-to-end: el flujo de venta completo (POS → comisión 60/40 → ticket), apertura/cierre de sesión de caja con ticket de control, cierre de día explícito con cálculo de bono y liquidación de sueldo por sesión, la página de Configuración (precios, % de comisión y CRUD de cajeros), el dashboard del dueño (ventas por rango, ranking de peluqueros, avance en vivo del bono), y ahora **Auth real con Supabase**: login sin registro, sesión validada en cada página (`(dashboard)/layout.tsx` redirige a `/login` si no hay sesión), menú y páginas filtrados por rol (`requireDueno()` protege `/configuracion` y `/dueno` incluso por acceso directo a la URL), y el cajero de cada venta/sesión se deriva de quién está logueado — ya no hay un selector manual.

**Próximo paso sugerido:** CRUD de peluqueros desde la UI (hoy solo existen vía seed) — o, si se prefiere avanzar hacia producción, reportes históricos con exportación (Fase 2) y PWA para que el cajero instale la app en el celular.
