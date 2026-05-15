#!/bin/bash
# Auto-commit: runs on every Stop hook. Exits fast if no changes.
REPO="/c/Users/User/Documents/Desarrollo Web/gestor-universitario-next"
cd "$REPO" 2>/dev/null || exit 0

# Fast exit: no tracked changes AND no new files in safe dirs
UNTRACKED=$(git ls-files --others --exclude-standard src/ supabase/ public/ .claude/ 2>/dev/null)
if git diff --quiet && git diff --cached --quiet && [ -z "$UNTRACKED" ]; then
  exit 0
fi

# Stage tracked modifications/deletions
git add -u 2>/dev/null

# Stage new files in code dirs only (safe: .env is in root, not src/ etc.)
git add src/ supabase/ public/ .claude/ 2>/dev/null

# Safety: unstage any .env* if somehow staged
git reset HEAD -- .env* "*.local" 2>/dev/null || true

# Nothing staged after all?
if git diff --cached --quiet; then
  exit 0
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
git commit -m "chore: auto-commit $TIMESTAMP

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>" 2>/dev/null

git push origin main 2>/dev/null || true
