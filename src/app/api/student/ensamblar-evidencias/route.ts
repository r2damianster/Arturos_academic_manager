import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'
import { NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

interface Seccion {
  tipo: 'grupal' | 'individual'
  nombre: string
  archivos: string[] // claves de archivo en FormData: "f0", "f1", etc.
}

interface Stats {
  asistencia: number | null
  indiceFormativo: number | null
  observacionProceso: string | null
  compromisos: number
  citadoTutoria: boolean
  tutoriasAsistidas: number
  tutoriasFaltadas: number
}

interface Manifest {
  estudiante: string
  curso: string
  profesor: string
  fecha: string
  secciones: Seccion[]
  stats?: Stats
}

async function imageToJpeg(bytes: ArrayBuffer, _mimeType: string): Promise<Buffer> {
  const { default: sharp } = await import('sharp')
  return sharp(Buffer.from(bytes)).jpeg({ quality: 90 }).toBuffer()
}

async function embedImagePage(doc: PDFDocument, bytes: ArrayBuffer, mimeType: string) {
  const type = mimeType.toLowerCase()
  let imgBytes: ArrayBuffer | Buffer = bytes

  if (type === 'image/jpeg' || type === 'image/jpg') {
    const img = await doc.embedJpg(bytes)
    const page = doc.addPage(PageSizes.A4)
    const { width, height } = page.getSize()
    const dims = img.scaleToFit(width - 60, height - 80)
    page.drawImage(img, {
      x: (width - dims.width) / 2,
      y: (height - dims.height) / 2 + 20,
      width: dims.width, height: dims.height,
    })
  } else if (type === 'image/png') {
    const img = await doc.embedPng(bytes)
    const page = doc.addPage(PageSizes.A4)
    const { width, height } = page.getSize()
    const dims = img.scaleToFit(width - 60, height - 80)
    page.drawImage(img, {
      x: (width - dims.width) / 2,
      y: (height - dims.height) / 2 + 20,
      width: dims.width, height: dims.height,
    })
  } else {
    // WebP, HEIC, BMP, TIFF → convertir a JPEG con sharp
    imgBytes = await imageToJpeg(bytes, mimeType)
    const img = await doc.embedJpg(imgBytes)
    const page = doc.addPage(PageSizes.A4)
    const { width, height } = page.getSize()
    const dims = img.scaleToFit(width - 60, height - 80)
    page.drawImage(img, {
      x: (width - dims.width) / 2,
      y: (height - dims.height) / 2 + 20,
      width: dims.width, height: dims.height,
    })
  }
}

function addDividerPage(doc: PDFDocument, titulo: string, subtitulo: string, font: Awaited<ReturnType<PDFDocument['embedFont']>>, fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>) {
  const page = doc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.05, 0.08, 0.12) })
  page.drawText(subtitulo.toUpperCase(), {
    x: 60, y: height / 2 + 30,
    size: 11, font, color: rgb(0.4, 0.55, 0.9),
  })
  page.drawText(titulo, {
    x: 60, y: height / 2,
    size: 26, font: fontBold, color: rgb(0.95, 0.95, 0.98),
  })
  page.drawLine({
    start: { x: 60, y: height / 2 - 18 },
    end:   { x: width - 60, y: height / 2 - 18 },
    thickness: 1, color: rgb(0.25, 0.35, 0.65),
  })
}

export async function POST(req: Request) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'No se pudo leer los archivos' }, { status: 400 })
  }

  const manifestStr = formData.get('manifest') as string | null
  if (!manifestStr) return NextResponse.json({ error: 'Falta manifest' }, { status: 400 })

  let manifest: Manifest
  try {
    manifest = JSON.parse(manifestStr)
  } catch {
    return NextResponse.json({ error: 'Manifest inválido' }, { status: 400 })
  }

  const pdfDoc = await PDFDocument.create()
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // ── Portada ───────────────────────────────────────────────────────────────
  const cover = pdfDoc.addPage(PageSizes.A4)
  const { width: cw, height: ch } = cover.getSize()
  cover.drawRectangle({ x: 0, y: 0, width: cw, height: ch, color: rgb(0.04, 0.07, 0.11) })
  cover.drawRectangle({ x: 0, y: ch - 8, width: cw, height: 8, color: rgb(0.27, 0.45, 0.9) })
  cover.drawText('EVIDENCIAS DE APRENDIZAJE', {
    x: 60, y: ch - 120, size: 22, font: fontBold, color: rgb(0.93, 0.93, 0.98),
  })
  cover.drawLine({ start: { x: 60, y: ch - 138 }, end: { x: cw - 60, y: ch - 138 }, thickness: 1, color: rgb(0.27, 0.45, 0.9) })
  const meta = [
    { label: 'Estudiante', value: manifest.estudiante },
    { label: 'Asignatura', value: manifest.curso },
    { label: 'Docente',    value: manifest.profesor },
    { label: 'Fecha',      value: manifest.fecha },
  ]
  meta.forEach(({ label, value }, i) => {
    const y = ch - 175 - i * 28
    cover.drawText(`${label}:`, { x: 60, y, size: 10, font, color: rgb(0.5, 0.6, 0.8) })
    cover.drawText(value, { x: 145, y, size: 10, font: fontBold, color: rgb(0.95, 0.95, 0.98) })
  })
  // Índice de secciones
  cover.drawText('Contenido:', { x: 60, y: ch - 310, size: 10, font: fontBold, color: rgb(0.7, 0.75, 0.85) })
  const grupales   = manifest.secciones.filter(s => s.tipo === 'grupal')
  const individuales = manifest.secciones.filter(s => s.tipo === 'individual')
  let indexY = ch - 335
  if (grupales.length > 0) {
    cover.drawText('Actividades Grupales', { x: 60, y: indexY, size: 9, font: fontBold, color: rgb(0.4, 0.65, 0.9) })
    indexY -= 18
    grupales.forEach(s => {
      cover.drawText(`  • ${s.nombre}  (${s.archivos.length} archivo${s.archivos.length !== 1 ? 's' : ''})`, { x: 60, y: indexY, size: 9, font, color: rgb(0.75, 0.78, 0.85) })
      indexY -= 16
    })
    indexY -= 6
  }
  if (individuales.length > 0) {
    cover.drawText('Actividades Individuales', { x: 60, y: indexY, size: 9, font: fontBold, color: rgb(0.4, 0.8, 0.55) })
    indexY -= 18
    individuales.forEach(s => {
      cover.drawText(`  • ${s.nombre}  (${s.archivos.length} archivo${s.archivos.length !== 1 ? 's' : ''})`, { x: 60, y: indexY, size: 9, font, color: rgb(0.75, 0.78, 0.85) })
      indexY -= 16
    })
  }

  // ── Seguimiento del proceso (datos del docente, disimulados para el estudiante) ─
  if (manifest.stats) {
    const st = manifest.stats
    indexY -= 20
    cover.drawLine({ start: { x: 60, y: indexY }, end: { x: cw - 60, y: indexY }, thickness: 0.5, color: rgb(0.15, 0.2, 0.32) })
    indexY -= 14
    cover.drawText('SEGUIMIENTO DEL PROCESO', { x: 60, y: indexY, size: 7.5, font, color: rgb(0.32, 0.42, 0.62) })
    indexY -= 17

    // Registro de presencia con barra
    if (st.asistencia !== null) {
      cover.drawText('Registro de presencia:', { x: 60, y: indexY, size: 9, font, color: rgb(0.55, 0.6, 0.7) })
      const bx = 196, by = indexY - 2, bw = 128, bh = 9
      cover.drawRectangle({ x: bx, y: by, width: bw, height: bh, color: rgb(0.08, 0.11, 0.18) })
      const fill = Math.max(0, Math.min(1, st.asistencia / 100))
      const fillCol = st.asistencia >= 80 ? rgb(0.14, 0.68, 0.4) : st.asistencia >= 60 ? rgb(0.85, 0.64, 0.12) : rgb(0.75, 0.2, 0.2)
      if (fill > 0) cover.drawRectangle({ x: bx, y: by, width: bw * fill, height: bh, color: fillCol })
      cover.drawText(`${st.asistencia}%`, { x: bx + bw + 6, y: indexY, size: 9, font: fontBold, color: rgb(0.82, 0.84, 0.92) })
      indexY -= 13
      cover.drawText('* Cifra estimada — puede diferir del registro oficial de la institucion.', { x: 60, y: indexY, size: 7, font, color: rgb(0.3, 0.34, 0.5) })
      indexY -= 18
    }

    // Barra disimulada de participacion (5 cuadros = nivel promedio 1-5)
    if (st.indiceFormativo !== null) {
      cover.drawText('Cohesion del proceso:', { x: 60, y: indexY, size: 9, font, color: rgb(0.55, 0.6, 0.7) })
      const sqBase = 184, sqY = indexY - 2, sqSz = 10, sqGap = 3
      for (let i = 0; i < 5; i++) {
        const cx = sqBase + i * (sqSz + sqGap)
        cover.drawRectangle({ x: cx, y: sqY, width: sqSz, height: sqSz, color: rgb(0.08, 0.11, 0.18) })
        if (i + 1 <= st.indiceFormativo) {
          cover.drawRectangle({ x: cx, y: sqY, width: sqSz, height: sqSz, color: rgb(0.27, 0.45, 0.9) })
        } else if (i < st.indiceFormativo) {
          const frac = st.indiceFormativo - i
          cover.drawRectangle({ x: cx, y: sqY, width: sqSz * frac, height: sqSz, color: rgb(0.27, 0.45, 0.9) })
        }
      }
      indexY -= 20
    }

    // Observacion de proceso (frase codificada desde nota promedio)
    if (st.observacionProceso) {
      const maxW = cw - 120
      const words = st.observacionProceso.split(' ')
      const lines: string[] = []
      let cur = ''
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w
        if (font.widthOfTextAtSize(test, 8.5) > maxW && cur) { lines.push(cur); cur = w } else { cur = test }
      }
      if (cur) lines.push(cur)
      const boxH = lines.length * 13 + 12
      cover.drawRectangle({ x: 56, y: indexY - boxH + 4, width: cw - 112, height: boxH, color: rgb(0.06, 0.1, 0.16) })
      cover.drawRectangle({ x: 56, y: indexY - boxH + 4, width: 3, height: boxH, color: rgb(0.27, 0.45, 0.9) })
      indexY -= 8
      for (const line of lines) {
        cover.drawText(line, { x: 66, y: indexY, size: 8.5, font, color: rgb(0.74, 0.78, 0.85) })
        indexY -= 13
      }
      indexY -= 8
    }

    // Compromisos formativos activos (= trabajos pendientes/en progreso)
    if (st.compromisos > 0) {
      cover.drawText('Compromisos formativos activos:', { x: 60, y: indexY, size: 9, font, color: rgb(0.55, 0.6, 0.7) })
      cover.drawText(String(st.compromisos), { x: 238, y: indexY, size: 9, font: fontBold, color: rgb(0.92, 0.76, 0.28) })
      indexY -= 16
    }

    // Espacios de acompanamiento (= tutorias)
    if (st.citadoTutoria || st.tutoriasAsistidas > 0 || st.tutoriasFaltadas > 0) {
      cover.drawText('Espacios de acompanamiento:', { x: 60, y: indexY, size: 9, font, color: rgb(0.55, 0.6, 0.7) })
      indexY -= 13
      if (st.citadoTutoria) {
        cover.drawText('  Tiene un espacio de acompanamiento pendiente', { x: 60, y: indexY, size: 8, font, color: rgb(0.38, 0.62, 0.9) })
        indexY -= 12
      }
      if (st.tutoriasAsistidas > 0) {
        cover.drawText(`  Asistencias registradas: ${st.tutoriasAsistidas}`, { x: 60, y: indexY, size: 8, font, color: rgb(0.28, 0.68, 0.42) })
        indexY -= 12
      }
      if (st.tutoriasFaltadas > 0) {
        cover.drawText(`  Inasistencias registradas: ${st.tutoriasFaltadas}`, { x: 60, y: indexY, size: 8, font, color: rgb(0.78, 0.3, 0.28) })
        indexY -= 12
      }
    }
  }

  // ── Secciones ─────────────────────────────────────────────────────────────
  for (const seccion of manifest.secciones) {
    const tipoLabel = seccion.tipo === 'grupal' ? 'Actividades Grupales' : 'Actividades Individuales'
    addDividerPage(pdfDoc, seccion.nombre, tipoLabel, font, fontBold)

    for (const fileKey of seccion.archivos) {
      const file = formData.get(fileKey) as File | null
      if (!file) continue
      const bytes = await file.arrayBuffer()

      try {
        if (file.type === 'application/pdf') {
          const src = await PDFDocument.load(bytes)
          const copied = await pdfDoc.copyPages(src, src.getPageIndices())
          copied.forEach(p => pdfDoc.addPage(p))
        } else {
          await embedImagePage(pdfDoc, bytes, file.type)
        }
      } catch (e) {
        console.error(`Error procesando ${file.name}:`, e)
      }
    }
  }

  // ── Footer en páginas de contenido (todo excepto portada y divisores) ─────
  const allPages = pdfDoc.getPages()
  const footerTxt = `${manifest.profesor} — ${manifest.curso} — ${manifest.fecha}`
  let contentPageNum = 0
  // Identificar páginas de divisor (background oscuro) vs contenido — simplificación:
  // Las divisores son las primeras de cada sección. Usamos el total para estimar.
  // Más simple: añadir footer a todas excepto portada (índice 0)
  for (let i = 1; i < allPages.length; i++) {
    const p = allPages[i]
    const { width: pw } = p.getSize()
    contentPageNum++
    p.drawText(footerTxt, { x: 40, y: 18, size: 7, font, color: rgb(0.45, 0.48, 0.55) })
    p.drawText(String(contentPageNum), { x: pw - 40, y: 18, size: 7, font, color: rgb(0.45, 0.48, 0.55) })
  }

  const pdfBytes = await pdfDoc.save()
  // Strip diacritics and non-ASCII so Content-Disposition header stays valid (RFC 5987)
  const safeNombre = manifest.estudiante.split(' ')[0].toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_-]/g, '_')
  const safeFecha = manifest.fecha.replace(/[/\\:]/g, '-')
  const nombreArchivo = `evidencias_${safeNombre}_${safeFecha}.pdf`

  return new Response(pdfBytes.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Content-Length': String(pdfBytes.byteLength),
    },
  })
}
