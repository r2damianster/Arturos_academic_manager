import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'
import { NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

interface Seccion {
  tipo: 'grupal' | 'individual'
  nombre: string
  archivos: string[] // claves de archivo en FormData: "f0", "f1", etc.
}

interface Manifest {
  estudiante: string
  curso: string
  profesor: string
  fecha: string
  secciones: Seccion[]
}

async function imageToJpeg(bytes: ArrayBuffer, mimeType: string): Promise<Buffer> {
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
  const nombreArchivo = `evidencias_${manifest.estudiante.split(' ')[0].toLowerCase()}_${manifest.fecha}.pdf`

  return new Response(pdfBytes.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Content-Length': String(pdfBytes.byteLength),
    },
  })
}
