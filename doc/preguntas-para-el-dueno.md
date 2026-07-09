# Preguntas pendientes para el dueño del negocio

Registro de decisiones que necesitan la opinión del dueño antes de implementarse. Cada entrada: la pregunta, las opciones evaluadas, y la respuesta una vez que la dé (con fecha).

---

## 1. ¿Quién puede cerrar la caja del día?

**Contexto:** hoy `cerrarDia()` (la acción que calcula el bono y liquida el sueldo del día) solo pide que haya alguien logueado (`requireUsuario()`), sin filtrar por rol — cualquier cajero o el dueño pueden dispararla. Es una acción sensible (mueve plata/liquidación), así que vale la pena confirmar con el dueño cómo quiere manejarlo.

**Opciones:**

1. **Solo el dueño** puede cerrar la caja del día.
2. **El dueño designa a un cajero** específico autorizado a cerrarla (requiere guardar quién está autorizado, y probablemente por cuánto tiempo — más trabajo de implementación).
3. **Cualquier cajero o el dueño** puede cerrarla (comportamiento actual, sin cambios).

**Estado:** pendiente de respuesta del dueño.

**Respuesta:** _(completar acá cuando el dueño decida, con fecha)_
