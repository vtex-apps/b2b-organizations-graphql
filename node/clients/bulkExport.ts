/* eslint-disable @typescript-eslint/no-explicit-any */
import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient, UserInputError } from '@vtex/api'
import FormData from 'form-data'

import type { ExportType } from '../utils/export/constants'

const BULK_EXPORT_BASE_URL = 'http://b2b-bulk-import.vtexcommercestable.com.br'

const normalizeDownloadUrl = (linkToFile: string) => {
  const url = linkToFile.startsWith('http')
    ? linkToFile
    : `${BULK_EXPORT_BASE_URL}${linkToFile.startsWith('/') ? '' : '/'}${linkToFile}`

  return url.replace(
    /^https:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*\.vtexcommercestable\.com\.br)/i,
    'http://$1'
  )
}

export interface BulkExportStatusResponse {
  exportId: string
  status: number
  progressPercentage?: number
  percentage?: number | string
  exportedRows?: number
  totalRows?: number
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRetryableNetworkError = (error: any) => {
  const message = String(error?.message ?? '')
  const code = String(error?.code ?? '')

  return (
    message.includes('socket disconnected') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ESOCKETTIMEDOUT') ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT'
  )
}

export default class BulkExportClient extends ExternalClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(BULK_EXPORT_BASE_URL, ctx, {
      ...options,
      headers: {
        VtexIdclientAutCookie: getAuthToken(ctx),
        ...options?.headers,
      },
      timeout: 120000,
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
    const path = `/api/b2b/export/${encodeURIComponent(exportId)}?an=${encodeURIComponent(
      this.context.account
    )}`

    let lastError: any

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await this.http.get<BulkExportStatusResponse>(path, {
          metric: 'bulk-export-status',
        })

        return response
      } catch (err) {
        lastError = err

        if (attempt < 3 && isRetryableNetworkError(err)) {
          await sleep(1000 * attempt)
          continue
        }

        break
      }
    }

    throw new UserInputError(
      getReadableErrorMessage(
        lastError,
        'Unable to retrieve export status. Please try again.'
      )
    )
  }

  public downloadFile = async (linkToFile: string): Promise<Buffer> => {
    const url = normalizeDownloadUrl(linkToFile)
    const isAbsoluteUrl = /^https?:\/\//i.test(url)

    try {
      const data = await this.http.get<ArrayBuffer>(url, {
        baseURL: isAbsoluteUrl ? '' : undefined,
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
