import ExcelJS from 'exceljs'

import {
  COST_CENTER_COLUMNS,
  ORGANIZATION_COLUMNS,
} from './columnMappings'
import { UTF8_BOM } from './constants'
import {
  buildCsvContent,
  convertXlsxToCsv,
  escapeCsvField,
  rowsToCsvBuffer,
  serializeCellValue,
} from './csvConverter'

const createWorkbookBuffer = async (
  headers: string[],
  rows: unknown[][]
) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Export')

  worksheet.addRow(headers)
  rows.forEach((row) => worksheet.addRow(row))

  const buffer = await workbook.xlsx.writeBuffer()

  return Buffer.from(buffer)
}

describe('csvConverter', () => {
  describe('escapeCsvField', () => {
    it('escapes commas and quotes', () => {
      expect(escapeCsvField('hello, world')).toBe('"hello, world"')
      expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
    })

    it('returns plain values unchanged', () => {
      expect(escapeCsvField('simple')).toBe('simple')
    })
  })

  describe('serializeCellValue', () => {
    it('joins arrays with pipe', () => {
      expect(serializeCellValue(['a', 'b'], 'array')).toBe('a|b')
    })

    it('stringifies custom fields as JSON', () => {
      expect(
        serializeCellValue([{ name: 'field', value: '1' }], 'json')
      ).toBe('[{"name":"field","value":"1"}]')
    })
  })

  describe('buildCsvContent', () => {
    it('includes UTF-8 BOM', () => {
      const content = buildCsvContent(['Name'], [{ Name: 'Acme' }], 'members')

      expect(content.startsWith(UTF8_BOM)).toBe(true)
    })

    it('normalizes organizations columns even when xlsx omits fields', () => {
      const content = buildCsvContent(
        ['Id', 'Name', 'Trade Name', 'Collections'],
        [
          {
            Collections: ['col-a', 'col-b'],
            Id: 'org-1',
            Name: 'Acme',
            'Trade Name': 'Acme LLC',
          },
        ],
        'organizations'
      )

      ORGANIZATION_COLUMNS.forEach((column) => {
        expect(content).toContain(column.header)
      })

      expect(content).toContain('col-a|col-b')
      expect(content).toContain('Created')
      expect(content).toContain('Custom Fields')
    })

    it('normalizes cost_centers columns including missing xlsx fields', () => {
      const content = buildCsvContent(
        ['Organization Id', 'Cost Center Id', 'Name'],
        [
          {
            'Cost Center Id': 'cc-1',
            Name: 'HQ',
            'Organization Id': 'org-1',
          },
        ],
        'cost_centers'
      )

      COST_CENTER_COLUMNS.forEach((column) => {
        expect(content).toContain(column.header)
      })

      expect(content).toContain('State Registration')
      expect(content).toContain('Sellers')
      expect(content).toContain('Custom Fields')
    })

    it('keeps members headers as passthrough', () => {
      const content = buildCsvContent(
        ['Email', 'Role'],
        [{ Email: 'user@example.com', Role: 'buyer' }],
        'members'
      )

      expect(content).toContain('Email,Role')
      expect(content).not.toContain('Custom Fields')
    })

    it('keeps addresses headers as passthrough', () => {
      const content = buildCsvContent(
        ['Street', 'City'],
        [{ Street: 'Main', City: 'SP' }],
        'addresses'
      )

      expect(content).toContain('Street,City')
    })
  })

  describe('convertXlsxToCsv', () => {
    it('converts xlsx buffer to csv with BOM', async () => {
      const xlsxBuffer = await createWorkbookBuffer(
        ['Id', 'Name', 'Collections'],
        [['org-1', 'Acme', 'col-a|col-b']]
      )

      const { buffer, filename } = await convertXlsxToCsv(
        xlsxBuffer,
        'organizations'
      )
      const content = buffer.toString('utf8')

      expect(filename).toMatch(/^b2b-export-organizations-\d{4}-\d{2}-\d{2}\.csv$/)
      expect(content.startsWith(UTF8_BOM)).toBe(true)
      expect(content).toContain('Acme')
    })
  })

  describe('rowsToCsvBuffer', () => {
    it('returns a buffer with escaped csv values', () => {
      const buffer = rowsToCsvBuffer(
        ['Name'],
        [{ Name: 'Company, Inc.' }],
        'members'
      )
      const content = buffer.toString('utf8')

      expect(content).toContain('"Company, Inc."')
    })
  })
})
