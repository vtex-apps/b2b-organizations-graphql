export const appendOrganizationSearchToWhere = (
  whereArray: string[],
  {
    search,
    customFieldName,
  }: {
    search?: string
    customFieldName?: string
  }
) => {
  if (!search) {
    return
  }

  if (customFieldName) {
    whereArray.push(`customFields.name=${customFieldName}`)
    whereArray.push(`customFields.value=${search}`)
  } else {
    whereArray.push(`(name="*${search}*" OR tradeName="*${search}*")`)
  }
}
