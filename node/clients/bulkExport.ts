/* eslint-disable @typescript-eslint/no-explicit-any */
import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient, UserInputError } from '@vtex/api'
import FormData from 'form-data'

import type { ExportType } from '../utils/export/constants'

const BULK_EXPORT_BASE_URL = 'http://b2b-bulk-import.vtexcommercestable.com.br'

export interface BulkExportStatusResponse {
  exportId: string
  status: number
  progressPercentage?: number
  exportedRows?: number
  linkToFile?: string
  lastUpdate?: string
  startDate?: string
}

export interface CreateExportResponse {
  exportId: string
}

const getAuthToken = (ctx: IOContext) =>
  (ctx as IOContext & { adminUserAuthToken?: string }).adminUserAuthToken ??
  ctx.authToken

const getReadableErrorMessage = (error: any, fallback: string) => {
  const data = error?.response?.data

  if (typeof data === 'string' && data.trim()) {
    return data
  }

  if (typeof data?.message === 'string' && data.message.trim()) {
    return data.message
  }

  if (typeof data?.error === 'string' && data.error.trim()) {
    return data.error
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message
  }

  return fallback
}

export default class BulkExportClient extends ExternalClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(BULK_EXPORT_BASE_URL, ctx, {
      ...options,
      headers: {
        VtexIdclientAutCookie: getAuthToken(ctx),
        ...options?.headers,
      },
      timeout: 60000,
    })
  }

  public createExport = async (
    exportType: ExportType
  ): Promise<CreateExportResponse> => {
    const formData = new FormData()

    formData.append('exportType', exportType)

    try {
      return await this.http.post<CreateExportResponse>(
        `/api/b2b/export?an=${encodeURIComponent(this.context.account)}`,
        formData,
        {
          headers: formData.getHeaders(),
          metric: 'bulk-export-create',
        }
      )
    } catch (error) {
      throw new UserInputError(
        getReadableErrorMessage(error, 'Unable to start export. Please try again.')
      )
    }
  }

  public getExportStatus = async (
    exportId: string
  ): Promise<BulkExportStatusResponse> => {
    try {
      return await this.http.get<BulkExportStatusResponse>(
        `/api/b2b/export/${encodeURIComponent(exportId)}?an=${encodeURIComponent(
          this.context.account
        )}`,
        {
          metric: 'bulk-export-status',
        }
      )
    } catch (error) {
      throw new UserInputError(
        getReadableErrorMessage(
          error,
          'Unable to retrieve export status. Please try again.'
        )
      )
    }
  }

  public downloadFile = async (linkToFile: string): Promise<Buffer> => {
    const url = linkToFile.startsWith('http')
      ? linkToFile
      : `${BULK_EXPORT_BASE_URL}${linkToFile.startsWith('/') ? '' : '/'}${linkToFile}`

    try {
      const data = await this.http.get<ArrayBuffer>(url, {
        metric: 'bulk-export-download',
        responseType: 'arraybuffer',
      })

      return Buffer.from(data)
    } catch (error) {
      throw new UserInputError(
        getReadableErrorMessage(
          error,
          'Unable to download export file. Please try again.'
        )
      )
    }
  }
}
