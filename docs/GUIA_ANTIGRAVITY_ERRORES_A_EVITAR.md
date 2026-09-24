# Guía para Antigravity (y cualquier agente IA): errores a NO cometer en este proyecto

> Creada 2026-09-24 tras auditar los commits de sept 2026. Cada regla nace de un error real en este repo.
> Leer junto con `CLAUDE.md` (fuente de verdad) y `AI_AGENTS.md`. Aplica a Antigravity, Qwen, Gemini, GPT, Copilot y Claude.

## 0. Antes de tocar nada
1. `git fetch && git pull`. Leer `CLAUDE.md`.
2. **Producción = Supabase `hxsnyrutyyavvljxwgku`**. `.env.local` apunta a `vylkasmcveazzaspwgcr` (desarrollo). Confirmar el `project_id` antes de ejecutar SQL/migraciones.
3. Cerrar la tarea con la checklist de la sección 9.

## 1. Seguridad y secretos (el error más grave encontrado)
| ❌ Error real | ✅ Regla |
|---|---|
| 14 scripts en `scripts/` con la `SUPABASE_SERVICE_ROLE_KEY` de producción escrita en el código y **pusheados a GitHub** | NUNCA escribir llaves/tokens en código, SQL, skills ni docs. Usar `require('./_supabase-env')` (lee `.env.local`). Ver `scripts/_supabase-env.js` |
| Commitear `.xlsx` de calificaciones, `.ods`, `.xls`, JSON de exportes, `tmpcookies.txt`, logs | Datos de estudiantes y archivos temporales NO van al repo. `.gitignore` ya los cubre; si aparece uno en `git status`, no lo agregues |
| Scripts de inspección ad hoc (`inspect_*`, `test_*`, `check_*`, …) commiteados | Son desechables: están en `.gitignore`. Solo se versionan scripts reutilizables y sin secretos (ej. `evaluar_participacion.js`) |
| Una service_role key expuesta se considera comprometida | Avisar al usuario para **rotarla** en Supabase → Settings → API y actualizar Vercel + `.env.local`. Borrar el archivo no basta: queda en el historial de git |

## 2. RLS y base de datos
- **Nunca** una migración "habilitar RLS en todas las tablas" con bucle dinámico sobre `pg_tables`: activa RLS sin políticas en tablas futuras y la app devuelve 0 filas sin error. Primero consultar `pg_class.relrowsecurity`, luego actuar **tabla por tabla y explícito**.
- **Nunca** `DISABLE ROW LEVEL SECURITY` en `public` (lo hicieron las migraciones `20260727_sistema_*`; corregido en `20260922_enable_rls_all_tables.sql`). Tablas solo-servicio: RLS activada **sin políticas** + acceso con service role.
- Toda función `SECURITY DEFINER` nueva debe: `SET search_path = public`, validar `auth.uid()` internamente y llevar `REVOKE EXECUTE ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated;` (ver `20260924_harden_security_definer_functions.sql`). Por defecto Postgres da EXECUTE a PUBLIC → cualquiera la llama vía `/rest/v1/rpc/`.
- Siempre crear el archivo `supabase/migrations/YYYYMMDD_nombre.sql` **aunque** se aplique por MCP/SQL Editor, y listarlo en `CLAUDE.md`.
- `database.types.ts` está desactualizado (ver deuda en CLAUDE.md). No regenerarlo sin revisar.
- PostgREST **no evalúa expresiones** en el body (`'total + 1'` se manda como texto y falla). Leer el valor, incrementar en código o usar un RPC.

## 3. Cursos activos vs. finalizados (bug de `/dashboard/planificacion`)
- `cursos.estado` ∈ `activo | finalizado | archivado`. Toda vista "operativa" (planificación, pase de lista, modo clase, agenda, herramientas, tutorías) debe mostrar **solo cursos `activo`**.
- Al consultar **tablas hijas con join** (`horarios_clases → cursos(...)`, `bitacora_clase`, etc.), filtrar por el estado del curso **también en esa consulta**, no solo en la lista de cursos. El bug: se filtró `cursos` pero `horarios_clases` seguía trayendo clases de cursos del semestre anterior.
- `finalizarCursosVencidos()` solo corre al abrir `/dashboard`; no asumir que ya se ejecutó.
- Respetar `fecha_inicio`/`fecha_fin` del curso al pintar semanas.
- **No hardcodear IDs de cursos "activos"** en skills o docs: se vuelven obsoletos cada semestre. Consultar `cursos where estado='activo'`.

## 4. Lógica de negocio que NO se mezcla
- Asistencia a clase (`asistencia`) es **independiente** del cumplimiento de actividades/participación: registrar participación **nunca** modifica ni borra la asistencia.
- Ítems `calificaciones_items.fuente = 'en_curso'` NUNCA alimentan riesgo, citaciones ni funciones IA.
- Estudiantes `estado = 'retirado'`: excluirlos de listas de pase/participación y exportes; en Moodle CSV van como ausente.
- Exportar a Moodle: los correos ficticios (`sinregistro.*`, `@pendiente.local`) se omiten del CSV y `avisarOmitidosMoodle()` avisa al profesor. Nunca descartar datos en silencio.
- Participación: `UNIQUE(curso_id, estudiante_id, fecha)`; usar upsert.

## 5. React / Next.js
- `useEffect` que copia props → estado **pisa ediciones locales** cuando el RSC se refresca. Usar dependencias serializadas (`JSON.stringify(prop)`) o sincronizar solo claves ausentes.
- `getUser()` en servidor, nunca `getSession()`. Inserts con `profesor_id: user.id`, nunca desde formData.
- Formularios multi-paso: campos en `FormState` + `fd.set()` (ver CLAUDE.md).
- Textos visibles: `t('clave')` con `translations.js` (ES + EN); nada de `lang === 'en' ? … : …`.
- Nombres descriptivos (`scenario`, `isVisible`), no `s`, `i`, `val`, `tmp`.
- Navegación: solo `src/components/layout/nav-items.tsx`.

## 6. Despliegue / Vercel
- Plan **Hobby**: los crons corren **máximo 1 vez al día** (`*/30 * * * *` rompió el deploy, commit `0660459`). No crear crons/keep-alive sin pedirlo el usuario (el keep-alive se eliminó el 2026-09-24).
- No confiar en el header `x-vercel-cron` (falsificable); validar `Authorization: Bearer CRON_SECRET`.
- Cambiar una env var en Vercel **no** redeploya: `git commit --allow-empty -m "ci: redeploy ..."` + push.
- `npx tsc --noEmit` antes de cada commit. Cero errores.

## 7. Git
- **Prohibidos** los commits `chore: auto-commit — <lista de archivos>`: mensajes sin sentido y arrastran archivos sensibles. Formato `tipo: mensaje` descriptivo (`fix:`, `feat:`, `docs:`, `chore:`).
- `git add <archivos específicos>`; nunca `git add -A` / `git add .`.
- Nunca `--no-verify`, `--force` en main ni `reset --hard` sin orden explícita.
- Un commit = un cambio lógico (no mezclar planificación + Moodle CSV + skills en uno).
- Revisar `git status` y `git diff --cached` antes del commit: nada de logs, `.xlsx`, `.env`, cookies.

## 8. Documentación (Antigravity no la estaba actualizando)
Cada feature/fix debe terminar con, **en el mismo commit o el siguiente**:
1. `CLAUDE.md`: sección "Features recientes (fecha — sesión N)" + nueva migración en la lista + rutas nuevas + deuda técnica si la hay.
2. `CHANGELOG.md`: entrada con fecha, tipo y archivos clave.
3. `AI_AGENTS.md`: solo si cambia stack, rutas o reglas.
4. Skills (`.agents/skills/`, `.claude/skills/`): si cambia el flujo o el esquema que usan. Sin secretos ni IDs efímeros.
5. Si un documento queda obsoleto, marcarlo como tal (ver `docs/REFACTOR_EN_PROGRESO.md`), no dejarlo afirmando cosas falsas.

## 9. Checklist de cierre (copiar al final de cada tarea)
- [ ] `git pull` hecho al inicio; proyecto Supabase correcto verificado
- [ ] `npx tsc --noEmit` sin errores
- [ ] Filtros de curso activo aplicados en consultas con join
- [ ] Sin llaves/tokens/datos de estudiantes en el diff (`git diff --cached`)
- [ ] Migración con archivo `.sql` + RLS/`REVOKE`/`search_path` correctos
- [ ] `CLAUDE.md` + `CHANGELOG.md` actualizados
- [ ] Commit descriptivo (no `auto-commit`) y solo con archivos específicos
