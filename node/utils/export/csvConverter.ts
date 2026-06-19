import ExcelJS from 'exceljs'

import type { ColumnDef } from './columnMappings'
import {
  getColumnMapping,
  isMappedExportType,
  mapRowToFields,
} from './columnMappings'
import type { ExportType } from './constants'
import { buildExportFilename, UTF8_BOM } from './constants'

const CUSTOM_FIELDS_HEADERS = new Set(['custom fields', 'customfields'])

const getCellValue = (cell: ExcelJS.Cell) => {
  const { value } = cell

  if (value == null) {
    return null
  }

  if (typeof value === 'object' && 'result' in value) {
    return (value as ExcelJS.CellFormulaValue).result ?? null
  }

  if (typeof value === 'object' && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText
      .map((item) => item.text)
      .join('')
  }

  if (typeof value === 'object' && 'text' in value) {
    return (value as ExcelJS.CellHyperlinkValue).text
  }

  return value
}

export const escapeCsvField = (value: string) => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

export const serializeCellValue = (
  value: unknown,
  transform: ColumnDef['transform'] = 'default',
  header?: string
) => {
  if (value == null || value === '') {
    return ''
  }

  const normalizedHeader = header?.trim().toLowerCase().replace(/\s+/g, ' ')
  const isCustomField =
    transform === 'json' ||
    (normalizedHeader && CUSTOM_FIELDS_HEADERS.has(normalizedHeader))

  if (isCustomField) {
    if (typeof value === 'string') {
      return value
    }

    return JSON.stringify(value)
  }

  if (transform === 'array' || Array.isArray(value)) {
    if (Array.isArray(value)) {
      return value.map(String).join('|')
    }

    return String(value)
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

const buildCsvLine = (values: string[]) =>
  values.map(escapeCsvField).join(',')

const parseWorksheetRows = (worksheet: ExcelJS.Worksheet) => {
  const headers: string[] = []
  const rows: Array<Record<string, unknown>> = []

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = String(getCellValue(cell) ?? '')
      })

      return
    }

    const rowData: Record<string, unknown> = {}

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1]

      if (header) {
        rowData[header] = getCellValue(cell)
      }
    })

    rows.push(rowData)
  })

  return { headers: headers.filter(Boolean), rows }
}

const buildMappedCsv = (
  rows: Array<Record<string, unknown>>,
  exportType: ExportType
) => {
  const mapping = getColumnMapping(exportType)

  if (!mapping) {
    throw new Error(`Missing column mapping for export type: ${exportType}`)
  }

  const { columns, headerAliases } = mapping
  const csvLines = [buildCsvLine(columns.map((column) => column.header))]

  rows.forEach((rawRow) => {
    const mappedRow = mapRowToFields(rawRow, headerAliases)
    const values = columns.map((column) =>
      serializeCellValue(mappedRow[column.field], column.transform, column.header)
    )

    csvLines.push(buildCsvLine(values))
  })

  return csvLines.join('\n')
}

const buildPassthroughCsv = (
  headers: string[],
  rows: Array<Record<string, unknown>>
) => {
  const csvLines = [buildCsvLine(headers)]

  rows.forEach((row) => {
    const values = headers.map((header) =>
      serializeCellValue(row[header], 'default', header)
    )

    csvLines.push(buildCsvLine(values))
  })

  return csvLines.join('\n')
}

export const buildCsvContent = (
  headers: string[],
  rows: Array<Record<string, unknown>>,
  exportType: ExportType
) => {
  const csvContent = isMappedExportType(exportType)
    ? buildMappedCsv(rows, exportType)
    : buildPassthroughCsv(headers, rows)

  return `${UTF8_BOM}${csvContent}`
}

export const convertXlsxToCsv = async (
  xlsxBuffer: Buffer,
  exportType: ExportType
) => {
  const workbook = new ExcelJS.Workbook()

  await workbook.xlsx.load(xlsxBuffer)

  const worksheet = workbook.worksheets[0]

  if (!worksheet) {
    throw new Error('Export file contains no worksheets')
  }

  const { headers, rows } = parseWorksheetRows(worksheet)
  const csvContent = buildCsvContent(headers, rows, exportType)

  return {
    buffer: Buffer.from(csvContent, 'utf8'),
    filename: buildExportFilename(exportType),
  }
}

export const rowsToCsvBuffer = (
  headers: string[],
  rows: Array<Record<string, unknown>>,
  exportType: ExportType
) => Buffer.from(buildCsvContent(headers, rows, exportType), 'utf8')
