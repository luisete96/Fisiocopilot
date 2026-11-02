# Prueba

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-cxoqjwjg)

## Desarrollo local

1. Instala las dependencias con `npm install`.
2. Crea `.env.local` en la raíz con la URL, la clave pública (anon/publishable) de Supabase y la clave de Google AI Studio:

   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-publica
   VITE_GEMINI_API_KEY=tu-clave-de-google-ai-studio
   ```

3. Inicia Vite con `npm run dev`. Si modificas `.env.local`, reinicia el servidor.

## Configurar la base de datos

En un proyecto Supabase vacío, copia y ejecuta [`supabase/schema.sql`](./supabase/schema.sql) desde el SQL Editor de Supabase. El script crea las tablas `patients`, `episodes` y `sessions` que consume la aplicación, junto con sus índices y políticas RLS.

En proyectos existentes, aplica también las migraciones de [`supabase/migrations`](./supabase/migrations), en particular `20261018135200_add_patient_and_episode_workflow_fields.sql`, para habilitar los campos de ficha médica/administrativa y el cierre de episodios. Para habilitar **Caja, Tarifas y Bonos**, ejecuta `20261102152000_create_billing_module.sql`, `20261102153500_link_agenda_appointment_billing.sql`, `20261102160400_sync_voucher_redemptions_with_agenda.sql` y `20261102160900_revert_billing_transaction.sql` desde el SQL Editor, en ese orden. Estas migraciones crean el catálogo, los bonos de pacientes, los movimientos y los cierres diarios, además de las funciones transaccionales para vender, canjear, cobrar sesiones desde la Agenda y anular movimientos, incluida la sincronización de canjes con citas de hoy. Los servicios de caja aparecen en la navegación como **Caja y Tarifas**.

**Aviso:** el script y la migración de caja permiten acceso CRUD a los roles `anon` y `authenticated` para mantener compatible la app, que actualmente no tiene inicio de sesión. Cualquier persona con la URL y la clave pública del proyecto podría acceder a datos clínicos, bonos y movimientos financieros. No uses estas políticas abiertas en producción con datos identificables; implementa autenticación y autorización por usuario antes de almacenar información real.
