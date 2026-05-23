#!/usr/bin/env node
/**
 * Hook: UserPromptSubmit
 * Si el mensaje contiene keywords de error, prepend el REFACTOR_EN_PROGRESO.md
 * como contexto para que Claude correlacione antes de diagnosticar.
 */

const fs = require('fs')
const path = require('path')

let input = ''
process.stdin.on('data', d => { input += d })
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input)
    const prompt = (data.prompt || '').toLowerCase()

    const errorKeywords = [
      'error', 'falla', 'bug', 'problema', 'no funciona', 'roto', 'rompió',
      'broken', 'crash', 'fallo', 'issue', 'warning', 'not exported',
      'no aparece', 'desapareció', 'dejó de', 'no carga', 'no muestra',
    ]

    const isAboutError = errorKeywords.some(kw => prompt.includes(kw))
    if (!isAboutError) return

    const refactorLog = path.join(process.cwd(), 'docs', 'REFACTOR_EN_PROGRESO.md')
    if (!fs.existsSync(refactorLog)) return

    const content = fs.readFileSync(refactorLog, 'utf8')
    // Solo prepend el bloque de cambios aplicados (no todo el archivo)
    const match = content.match(/## Cambios aplicados[\s\S]+?(?=## Cambios pendientes|$)/)
    const section = match ? match[0] : content

    process.stdout.write(
      `[REFACTOR EN PROGRESO — verificar correlación antes de diagnosticar]\n\n${section}\n`
    )
  } catch {
    // Silent fail — nunca bloquear al usuario
  }
})
