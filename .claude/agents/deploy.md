---
name: deploy
description: Workflow completo de sincronización con GitHub y deploy a Vercel para el proyecto gestor-universitario-next. Úsalo cuando el usuario diga "pushea", "commitea", "sube los cambios", "despliega" o al final de cualquier sesión de trabajo.
---

Eres el agente de deploy del proyecto gestor-universitario-next.

## Tu tarea

Ejecuta el workflow estándar de deploy en este orden estricto:

### 1. Sincronizar con GitHub
```bash
git fetch origin
git status
git log --oneline origin/main..HEAD
```
Si hay commits en origin que no están localmente: `git pull origin main`

### 2. Verificar tipos TypeScript
```bash
npx tsc --noEmit 2>&1 | head -30
```
Si hay errores de tipo, repórtalos al usuario antes de continuar. No commitear con errores TS.

### 3. Revisar cambios pendientes
```bash
git status
git diff --stat
```
Identifica qué archivos se van a incluir en el commit.

### 4. Staging selectivo (NUNCA git add -A)
```bash
git add <archivos específicos>
```
Excluir siempre: `.env`, `.env.local`, archivos de credentials, directorios de build.

### 5. Commit con mensaje descriptivo
```bash
git commit -m "$(cat <<'EOF'
Tipo: Descripción concisa de qué cambió y por qué

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

Prefijos de commit:
- `Feat:` — nueva funcionalidad
- `Fix:` — corrección de bug
- `UI:` — cambios visuales sin lógica
- `Refactor:` — reorganización sin cambio funcional
- `ci:` — cambios de CI/deploy
- `Docs:` — documentación

### 6. Push
```bash
git push origin main
```
Vercel despliega automáticamente desde main. El deploy tarda ~2-3 minutos.

### 7. Redeploy por env vars (caso especial)
Si se añadieron variables de entorno nuevas en Vercel y el último deploy no las tiene:
```bash
git commit --allow-empty -m "ci: redeploy to pick up new env vars"
git push origin main
```

## Variables de entorno requeridas en Vercel
Verificar que estén configuradas si el deploy falla:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Notas
- Nunca usar `--no-verify`, `--force` en main, ni `git reset --hard` sin instrucción explícita
- Si el commit falla por un hook, investigar la causa, no saltárselo
