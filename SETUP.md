# Gestor Universitario — Guía de Configuración

## Stack
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Auth + RLS)
- **Deploy**: Vercel

---

## Paso 1 — Crear proyecto en Supabase

1. Ve a https://supabase.com y crea una cuenta
2. Crea un nuevo proyecto (elige la región más cercana)
3. Anota la **URL** y la **anon key** (en Settings → API)

---

## Paso 2 — Ejecutar las migraciones SQL

En el **SQL Editor** de Supabase, ejecuta los archivos en orden:

```
1. supabase/migrations/001_initial_schema.sql
2. supabase/migrations/002_rls_policies.sql
3. supabase/migrations/003_functions.sql
```

> Copia el contenido de cada archivo y pégalo en el editor SQL.

---

## Paso 3 — Configurar variables de entorno locales

Crea el archivo `.env.local` en la raíz del proyecto:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Paso 4 — Instalar dependencias y correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000 — te redirigirá a `/auth/login`.

---

## Paso 5 — Desplegar en Vercel

### Opción A: Desde GitHub (recomendado)

1. Sube el proyecto a un repositorio en GitHub
2. Ve a https://vercel.com → "New Project" → importa el repo
3. En **Environment Variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click en **Deploy**

### Opción B: Con Vercel CLI

```bash
npm i -g vercel
vercel
```

Sigue las instrucciones y agrega las variables de entorno cuando te las pida.

---

## Paso 6 — Configurar URL de callback OAuth (si usas Google login)

En Supabase → Authentication → URL Configuration:
- **Site URL**: `https://tu-dominio.vercel.app`
- **Redirect URLs**: `https://tu-dominio.vercel.app/auth/callback`

---

## Cómo registrar nuevos profesores

Cualquier persona puede registrarse con **Crear cuenta** en la página de login.
Cada cuenta es completamente independiente — sus datos están aislados por RLS.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── auth/login/         → Página de login/registro
│   ├── auth/callback/      → Handler OAuth/PKCE
│   ├── dashboard/          → Portal del profesor
│   │   ├── page.tsx        → Panel de inicio
│   │   ├── cursos/         → Gestión de cursos
│   │   ├── estudiantes/    → Ficha individual
│   │   ├── pase-lista/     → Toma de asistencia
│   │   ├── agenda/         → Calendario semanal
│   │   ├── tutorias/       → Gestión de tutorías
│   │   └── config/         → Perfil del profesor
│   ├── student/            → Portal del estudiante
│   │   ├── onboarding/     → Setup inicial
│   │   ├── tutorias/       → Reserva de tutorías
│   │   └── perfil/         → Perfil del estudiante
│   └── tutoria-action/     → Confirmación por email token
├── components/
│   ├── layout/             → Sidebar y Header
│   ├── cursos/             → Componentes de cursos
│   ├── pase-lista/         → UI de toma de asistencia
│   ├── calificaciones/     → Tabla de notas editable
│   ├── agenda/             → Calendario semanal
│   ├── student/            → Componentes del portal estudiante
│   └── ...
├── lib/
│   ├── supabase/           → Clientes (browser + server)
│   └── actions/            → Server Actions por módulo
└── types/
    ├── database.types.ts   → Tipos Supabase (generado)
    └── domain.ts           → Aliases y tipos de dominio
supabase/
└── migrations/             → Historial SQL (ejecutar en orden)
```

---

## Seguridad

- **Middleware**: Protege `/dashboard/*` — sin sesión redirige al login
- **RLS en Supabase**: Cada tabla filtra por `profesor_id = auth.uid()`
- **Server Actions**: El `profesor_id` se lee del servidor, nunca del cliente
- Ningún profesor puede ver datos de otro aunque tenga el URL
