# Sistema de Agendamiento de TutorÃ­as - Dr. Arturo RodrÃ­guez

Un sistema web moderno para la gestiÃ³n y agendamiento de tutorÃ­as acadÃ©micas, desarrollado con Next.js y conectado a una base de datos en **Supabase**, diseÃ±ado especÃ­ficamente para el Dr. Arturo RodrÃ­guez, PhD.

---

## ðŸŽ¯ CaracterÃ­sticas Principales

### Vista de Estudiante
- **Calendario semanal interactivo** con horarios de Lunes a SÃ¡bado  
- **Horarios flexibles** de 7:00 AM a 8:00 PM con intervalos de 30 minutos  
- **Sistema de reservas** con formulario de informaciÃ³n del estudiante  
- **NavegaciÃ³n entre semanas** para planificar con anticipaciÃ³n  
- **Estados visuales claros** para horarios disponibles, reservados y no disponibles  

### Vista de Administrador
- **Panel de control completo** para gestiÃ³n de horarios  
- **ConfiguraciÃ³n semanal** de disponibilidad  
- **EstadÃ­sticas en tiempo real** con datos desde Supabase  
- **ProtecciÃ³n de horarios reservados** (no modificables)  
- **Sistema de guardado** con indicador de cambios pendientes  

---

## ðŸš€ TecnologÃ­as Utilizadas

- **Framework**: Next.js 14 (App Router)  
- **Lenguaje**: TypeScript  
- **Estilos**: Tailwind CSS  
- **Componentes UI**: shadcn/ui  
- **Iconos**: Lucide React  
- **Base de Datos**: Supabase (PostgreSQL + API)  
- **Estado**: React Hooks (useState, useEffect)  

---

## ðŸ“‹ Requisitos Previos

- Node.js 18.0 o superior  
- npm o yarn  
- Una cuenta y proyecto configurado en [Supabase](https://supabase.com)  

---

## ðŸ› ï¸ InstalaciÃ³n

1. **Clonar el repositorio**
   ```bash
   git clone <url-del-repositorio>
   cd tutoring-scheduler
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   # o
   yarn install
   ```

3. **Configurar variables de entorno**  
   Crea un archivo `.env.local` en la raÃ­z del proyecto con tus credenciales de Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-public-key>
   ```

4. **Ejecutar en modo desarrollo**
   ```bash
   npm run dev
   # o
   yarn dev
   ```
   El proyecto se conectarÃ¡ automÃ¡ticamente a la base de datos en Supabase.

---

## ðŸ“ Estructura del Proyecto

```plaintext
tutoring-scheduler/
â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ admin/
â”‚   â”‚   â””â”€â”€ page.tsx          # Vista de administrador
â”‚   â”œâ”€â”€ globals.css           # Estilos globales
â”‚   â”œâ”€â”€ layout.tsx            # Layout principal
â”‚   â””â”€â”€ page.tsx              # Vista de estudiante
â”œâ”€â”€ components/
â”‚   â””â”€â”€ ui/                   # Componentes de shadcn/ui
â”œâ”€â”€ lib/
â”‚   â”œâ”€â”€ supabaseClient.ts     # Cliente configurado para Supabase
â”‚   â””â”€â”€ utils.ts              # Utilidades y helpers
â”œâ”€â”€ public/                   # Archivos estÃ¡ticos
â”œâ”€â”€ README.md                 # Este archivo
â”œâ”€â”€ next.config.mjs           # ConfiguraciÃ³n de Next.js
â”œâ”€â”€ package.json              # Dependencias del proyecto
â”œâ”€â”€ tailwind.config.ts        # ConfiguraciÃ³n de Tailwind
â””â”€â”€ tsconfig.json             # ConfiguraciÃ³n de TypeScript
```

---

## ðŸ”§ ConfiguraciÃ³n

### ConexiÃ³n a Supabase
Toda la informaciÃ³n de horarios y reservas se almacena en tablas de Supabase.  
Para modificar la estructura de datos, utiliza el panel de administraciÃ³n de Supabase o las migraciones SQL.

### PersonalizaciÃ³n de Horarios
Los intervalos y dÃ­as estÃ¡n definidos en variables que pueden editarse en:
- `app/page.tsx` (vista estudiante)
- `app/admin/page.tsx` (vista administrador)  

---

## ðŸš€ Despliegue

### Vercel (Recomendado)
1. Conecta tu repositorio a Vercel.  
2. Configura las **variables de entorno** en la secciÃ³n *Settings â†’ Environment Variables* con los valores de Supabase.  
3. Despliega automÃ¡ticamente.

---

## ðŸ”’ Seguridad

- ValidaciÃ³n de formularios en el frontend  
- ProtecciÃ³n de estados de horarios reservados  
- API de Supabase con *Row Level Security* (RLS) habilitado  
- Claves privadas protegidas en variables de entorno  

---

## ðŸ”„ PrÃ³ximas Mejoras

- [ ] **AutenticaciÃ³n** con Supabase Auth  
- [ ] **Notificaciones por email** usando Supabase Functions  
- [ ] **ExportaciÃ³n** de horarios a PDF/Excel  
- [ ] **Historial** de citas  
- [ ] **Recordatorios** automÃ¡ticos  

---

## ðŸ“„ Licencia

Este proyecto estÃ¡ bajo la Licencia MIT. Ver el archivo `LICENSE` para mÃ¡s detalles.

---

**VersiÃ³n**: 1.1.0  
**Ãšltima actualizaciÃ³n**: Agosto 2025  
**Estado**: En desarrollo activo  
