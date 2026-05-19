import { NextRequest, NextResponse } from 'next/server'
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
} from 'docx'

function parsearGuia(texto: string): Paragraph[] {
  const paragraphs: Paragraph[] = []
  const lineas = texto.split('\n')

  // Encabezados que se renderizan como Heading
  const esEncabezado = (linea: string) => {
    const l = linea.trim()
    if (!l) return false
    // línea en MAYÚSCULAS con colon al final o sola (ej: "COMPETENCIA TÉCNICA Y/O HABILIDAD BLANDA:")
    return /^[A-ZÁÉÍÓÚÑ\s\-–:0-9/]+$/.test(l) && l.length > 3
  }

  const esTituloDoc = (linea: string) => {
    const l = linea.trim()
    return l.startsWith('GUÍA DE ESTUDIO') || l.startsWith('GUÍA DE APRENDIZAJE')
  }

  for (const linea of lineas) {
    const l = linea.trim()

    if (!l) {
      paragraphs.push(new Paragraph({ spacing: { after: 80 } }))
      continue
    }

    if (esTituloDoc(l)) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: l, bold: true, size: 32, color: '1a56db' })],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200, before: 100 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '1a56db', space: 4 },
          },
        })
      )
      continue
    }

    if (esEncabezado(l)) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: l, bold: true, size: 24, color: '374151' })],
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 120, before: 240 },
        })
      )
      continue
    }

    // Ítems de lista (comienzan con - o •)
    if (/^[-•*]\s/.test(l)) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: l.replace(/^[-•*]\s/, ''), size: 20 })],
          bullet: { level: 0 },
          spacing: { after: 60 },
          indent: { left: convertInchesToTwip(0.25) },
        })
      )
      continue
    }

    // Líneas con formato "Término: definición"
    const colonMatch = l.match(/^([^:]{2,40}):(.+)$/)
    if (colonMatch && !/https?:\/\//.test(l)) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: colonMatch[1] + ': ', bold: true, size: 20 }),
            new TextRun({ text: colonMatch[2].trim(), size: 20 }),
          ],
          spacing: { after: 80 },
        })
      )
      continue
    }

    // Párrafo normal
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: l, size: 20 })],
        spacing: { after: 100 },
        alignment: AlignmentType.JUSTIFIED,
      })
    )
  }

  return paragraphs
}

export async function POST(req: NextRequest) {
  try {
    const { guia, titulo } = await req.json() as { guia: string; titulo: string }

    if (!guia) {
      return NextResponse.json({ error: 'Contenido vacío' }, { status: 400 })
    }

    const paragraphs = parsearGuia(guia)

    const doc = new Document({
      creator: 'Gestor Universitario',
      title: titulo ?? 'Guía de Estudio',
      description: 'Generada automáticamente',
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1.2),
                right: convertInchesToTwip(1.2),
              },
            },
          },
          children: paragraphs,
        },
      ],
    })

    const buffer = Buffer.from(await Packer.toBuffer(doc))

    const nombreArchivo = (titulo ?? 'guia-estudio')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${nombreArchivo}.docx"`,
      },
    })
  } catch (err) {
    console.error('Error generando docx:', err)
    return NextResponse.json({ error: 'Error interno generando el documento' }, { status: 500 })
  }
}
