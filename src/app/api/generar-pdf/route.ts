import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// A4: 595.28 x 841.89 pt
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 72
const TEXT_W = PAGE_W - MARGIN * 2

type LineKind = 'title' | 'heading' | 'bullet' | 'field' | 'body' | 'blank'

interface ParsedLine {
  kind: LineKind
  text: string
  label?: string // para 'field': la parte antes del ':'
}

function parsearLineas(texto: string): ParsedLine[] {
  const result: ParsedLine[] = []
  for (const raw of texto.split('\n')) {
    const l = raw.trim()
    if (!l) { result.push({ kind: 'blank', text: '' }); continue }
    if (l.startsWith('GUÍA DE ESTUDIO') || l.startsWith('GUÍA DE APRENDIZAJE')) {
      result.push({ kind: 'title', text: l }); continue
    }
    if (/^[A-ZÁÉÍÓÚÑ\s\-–:0-9/]+$/.test(l) && l.length > 3) {
      result.push({ kind: 'heading', text: l }); continue
    }
    if (/^[-•*]\s/.test(l)) {
      result.push({ kind: 'bullet', text: l.replace(/^[-•*]\s/, '') }); continue
    }
    const colonMatch = l.match(/^([^:]{2,40}):(.+)$/)
    if (colonMatch && !/https?:\/\//.test(l)) {
      result.push({ kind: 'field', text: colonMatch[2].trim(), label: colonMatch[1] }); continue
    }
    result.push({ kind: 'body', text: l })
  }
  return result
}

function wrapText(text: string, font: Awaited<ReturnType<PDFDocument['embedFont']>>, size: number, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const probe = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(probe, size) <= maxW) {
      current = probe
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

export async function POST(req: NextRequest) {
  try {
    const { guia, titulo } = await req.json() as { guia: string; titulo: string }
    if (!guia) return NextResponse.json({ error: 'Contenido vacío' }, { status: 400 })

    const pdfDoc = await PDFDocument.create()
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const COLOR_TITLE = rgb(0.1, 0.337, 0.855)  // #1a56db
    const COLOR_HEAD  = rgb(0.216, 0.255, 0.318) // #374151
    const COLOR_BODY  = rgb(0.13, 0.13, 0.13)
    const COLOR_LABEL = rgb(0.1, 0.337, 0.855)

    const parsed = parsearLineas(guia)

    let page = pdfDoc.addPage([PAGE_W, PAGE_H])
    let y = PAGE_H - MARGIN

    function ensureSpace(needed: number) {
      if (y - needed < MARGIN) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H])
        y = PAGE_H - MARGIN
      }
    }

    function drawWrapped(
      text: string,
      font: typeof fontReg,
      size: number,
      color: ReturnType<typeof rgb>,
      indent = 0,
      spaceBefore = 0,
      spaceAfter = 0,
    ) {
      const lineH = size * 1.45
      const maxW = TEXT_W - indent
      const lines = wrapText(text, font, size, maxW)
      y -= spaceBefore
      for (const line of lines) {
        ensureSpace(lineH)
        page.drawText(line, { x: MARGIN + indent, y, size, font, color })
        y -= lineH
      }
      y -= spaceAfter
    }

    for (const pl of parsed) {
      switch (pl.kind) {
        case 'blank':
          y -= 6
          break

        case 'title':
          ensureSpace(28)
          drawWrapped(pl.text, fontBold, 16, COLOR_TITLE, 0, 0, 6)
          // underline
          page.drawLine({
            start: { x: MARGIN, y: y + 2 },
            end: { x: PAGE_W - MARGIN, y: y + 2 },
            thickness: 1.5,
            color: COLOR_TITLE,
          })
          y -= 8
          break

        case 'heading':
          drawWrapped(pl.text, fontBold, 11, COLOR_HEAD, 0, 16, 4)
          break

        case 'bullet': {
          const lineH = 10 * 1.45
          const bulletX = MARGIN + 12
          const textX = MARGIN + 22
          const maxW = TEXT_W - 22
          const lines = wrapText(pl.text, fontReg, 10, maxW)
          ensureSpace(lineH * lines.length)
          page.drawText('•', { x: bulletX, y, size: 10, font: fontReg, color: COLOR_BODY })
          for (let i = 0; i < lines.length; i++) {
            page.drawText(lines[i], { x: textX, y, size: 10, font: fontReg, color: COLOR_BODY })
            y -= lineH
          }
          y -= 2
          break
        }

        case 'field': {
          const label = (pl.label ?? '') + ': '
          const labelW = fontBold.widthOfTextAtSize(label, 10)
          ensureSpace(16)
          page.drawText(label, { x: MARGIN, y, size: 10, font: fontBold, color: COLOR_LABEL })
          const remainder = TEXT_W - labelW
          const valueLines = wrapText(pl.text, fontReg, 10, remainder)
          page.drawText(valueLines[0], { x: MARGIN + labelW, y, size: 10, font: fontReg, color: COLOR_BODY })
          y -= 10 * 1.45
          for (let i = 1; i < valueLines.length; i++) {
            ensureSpace(15)
            page.drawText(valueLines[i], { x: MARGIN, y, size: 10, font: fontReg, color: COLOR_BODY })
            y -= 10 * 1.45
          }
          y -= 3
          break
        }

        case 'body':
          drawWrapped(pl.text, fontReg, 10, COLOR_BODY, 0, 0, 4)
          break
      }
    }

    const pdfBytes = await pdfDoc.save()
    const nombreArchivo = (titulo ?? 'guia-estudio')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombreArchivo}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Error generando PDF:', err)
    return NextResponse.json({ error: 'Error interno generando el PDF' }, { status: 500 })
  }
}
