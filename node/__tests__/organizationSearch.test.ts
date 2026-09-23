import { appendOrganizationSearchToWhere } from '../utils/organizationSearch'

describe('appendOrganizationSearchToWhere', () => {
  it('matches name and trade name when no custom field is selected', () => {
    const where: string[] = []

    appendOrganizationSearchToWhere(where, { search: 'acme' })

    expect(where).toEqual(['(name="*acme*" OR tradeName="*acme*")'])
  })

  it('filters by custom field name and value when customFieldName is set', () => {
    const where: string[] = []

    appendOrganizationSearchToWhere(where, {
      search: '0001053532',
      customFieldName: 'sapeccid',
    })

    expect(where).toEqual([
      'customFields.name=sapeccid',
      'customFields.value=0001053532',
    ])
  })

  it('does nothing when search is empty', () => {
    const where: string[] = ['status=active']

    appendOrganizationSearchToWhere(where, {
      search: '',
      customFieldName: 'sapeccid',
    })

    expect(where).toEqual(['status=active'])
  })
})
