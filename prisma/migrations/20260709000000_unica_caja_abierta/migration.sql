-- Garantiza a nivel de base de datos que solo puede haber una SesionCaja
-- abierta (horaCierre IS NULL) a la vez. Antes esto solo se validaba en el
-- servidor (findFirst + create sin transacción), lo que permitía una
-- condición de carrera: dos aperturas casi simultáneas podían pasar la
-- validación antes de que cualquiera de las dos se confirmara.
CREATE UNIQUE INDEX "sesion_caja_una_abierta" ON "SesionCaja" ((1)) WHERE "horaCierre" IS NULL;
