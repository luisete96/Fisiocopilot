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

En proyectos existentes, aplica también las migraciones de [`supabase/migrations`](./supabase/migrations), en particular `20261018135200_add_patient_and_episode_workflow_fields.sql`, para habilitar los campos de ficha médica/administrativa y el cierre de episodios.

**Aviso:** el script permite acceso CRUD a los roles `anon` y `authenticated` para mantener compatible la app, que actualmente no tiene inicio de sesión. Cualquier persona con la URL y la clave pública del proyecto podría acceder a los registros clínicos. No almacenes datos de pacientes identificables con estas políticas; implementa autenticación y autorización por usuario antes de producción.
