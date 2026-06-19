# B2B Organizations GraphQL

GraphQL backend for [B2B Organizations](https://github.com/vtex-apps/b2b-organizations).

## Bulk export

This app exposes a GraphQL layer on top of the `b2b-bulk-import` export service. It starts async exports, polls job status, converts completed XLSX files to UTF-8 CSV (with BOM), and serves downloads through a private HTTP route.

The frontend should orchestrate the flow only; it does not transform export data.

### Architecture

```
Admin UI
  → createExport (GraphQL)
  → b2b-bulk-import (XLSX generation)
  → exportStatus polling (GraphQL)
  → GET /_v/private/b2b/export/:exportId (CSV download)
```

Conversion from XLSX to CSV happens **lazily on the first download request**, not during status polling. This avoids GraphQL timeouts on large exports.

---

## GraphQL API

Both operations require admin authentication via `@validateAdminUserAccess` with the default permission **`B2B_ORGANIZATIONS_VIEW`** (`buyer_organization_view` in License Manager). They do **not** require `B2B_ORGANIZATIONS_EDIT`.

Use the VTEX Admin GraphQL endpoint (private):

```
POST /_v/private/graphql/v1?workspace={workspace}&domain=admin&locale=en-US
```

Authenticated requests must include a valid `VtexIdclientAutCookie` for an admin user on the target account.

### Mutation: `createExport`

Starts an export job for the entire account (no filters or partial exports).

```graphql
mutation CreateExport($exportType: ExportType!) {
  createExport(exportType: $exportType) {
    exportId
  }
}
```

**`ExportType` values:**

| Value | Description |
| --- | --- |
| `organizations` | All buyer organizations |
| `cost_centers` | All cost centers |
| `members` | All B2B users / members |
| `addresses` | All cost center addresses |

On success, the app stores export metadata in VBase (`exportType`, `totalRows` when available) keyed by `exportId`. The actual CSV file is **not** created until download.

### Query: `exportStatus`

Poll export progress until `status` is `COMPLETED` or `FAILED`.

```graphql
query ExportStatus($exportId: String!) {
  exportStatus(exportId: $exportId) {
    exportId
    status
    progressPercentage
    exportedRows
    linkToFile
    lastUpdate
    startDate
  }
}
```

**`ExportStatus` values:**

| Status | Meaning |
| --- | --- |
| `IN_PROGRESS` | Export still running in `b2b-bulk-import` |
| `COMPLETED` | XLSX ready; `linkToFile` points to this app's download route |
| `FAILED` | Export failed |

**Progress notes:**

- `progressPercentage` may be `null` when progress cannot be calculated reliably (prefer showing an indeterminate state over `0%` when rows are already being exported).
- When `b2b-bulk-import` returns `progressPercentage: 0` but `exportedRows > 0`, the backend may compute progress from `exportedRows / totalRows` when `totalRows` was stored at `createExport`.
- Keep polling while `status === IN_PROGRESS` even if `progressPercentage === 100`; the bulk service can report 100% before the job is fully finalized.
- `linkToFile` is only set when `status === COMPLETED`.

**Example completed response:**

```json
{
  "exportId": "88649d8d-f065-4400-8901-79ee64c87604",
  "status": "COMPLETED",
  "progressPercentage": 100,
  "exportedRows": 6997,
  "linkToFile": "https://{workspace}--{account}.myvtex.com/_v/private/b2b/export/88649d8d-f065-4400-8901-79ee64c87604"
}
```

---

## HTTP route: CSV download

| Method | Path | Auth |
| --- | --- | --- |
| `GET` | `/_v/private/b2b/export/:exportId` | Admin token + `buyer_organization_view` |

The route is registered as `public: true` in `service.json` (reachable at the URL), but the handler rejects unauthenticated or unauthorized requests with `403 Access denied`.

**First download for an export:**

1. Fetches status from `b2b-bulk-import`
2. Downloads the XLSX from the presigned URL returned by bulk-import
3. Converts to CSV (UTF-8 with BOM)
4. Saves a copy in VBase
5. Streams the CSV to the client

**Subsequent downloads** within the retention window serve the cached CSV from VBase without re-converting.

**Browser usage:** open `linkToFile` from `exportStatus` while logged into VTEX Admin (the session cookie is sent automatically). For scripts, pass `VtexIdclientAutCookie` explicitly.

Unlike the GraphQL operations, this route does **not** accept App Key / API token authentication—only admin user tokens.

---

## CSV output

### File format

- Encoding: **UTF-8 with BOM** (Excel-friendly on Windows)
- Filename pattern: `b2b-export-{exportType}-{YYYY-MM-DD}.csv`
- Array fields: joined with `|`
- Custom fields: serialized as JSON where applicable

### Columns by export type

**`organizations`** — normalized column set:

| Column | Notes |
| --- | --- |
| Id | |
| Name | |
| Trade Name | |
| Collections | pipe-separated |
| Price Tables | pipe-separated |
| Payment Terms | pipe-separated |
| Sales Channel | |
| Sellers | pipe-separated |
| Status | |
| Created | |
| Custom Fields | JSON |

**`cost_centers`** — normalized column set:

| Column | Notes |
| --- | --- |
| Organization Id | |
| Cost Center Id | |
| Name | |
| Payment Terms | pipe-separated |
| Phone Number | |
| Business Document | |
| State Registration | |
| Sellers | pipe-separated |
| Custom Fields | JSON |

**`members`** and **`addresses`** — **passthrough**: CSV headers match the XLSX produced by `b2b-bulk-import` without column remapping in this app. Refer to the bulk-import service or download a sample export to see exact headers for your account.

---

## VBase storage

Bucket: `b2b_exports`

| Key | Content | When written |
| --- | --- | --- |
| `{exportId}` | JSON metadata (`exportType`, `totalRows`, `lastStatusSnapshot`, etc.) | `createExport`; snapshot updated during polling (throttled) |
| `{exportId}.csv` | Converted CSV file | First successful download |

**CSV retention:** the cached CSV expires **5 minutes** after it is saved (`EXPORT_CSV_VBASE_TTL_SECONDS = 300`). After expiration, a new download triggers conversion again if the source XLSX is still available from bulk-import.

JSON metadata is not automatically purged by this TTL.

There is no automatic cleanup job for old export metadata.

---

## Authentication summary

| Endpoint | Permission | Token sources |
| --- | --- | --- |
| `createExport` | `buyer_organization_view` | Admin cookie (context or header), App Key |
| `exportStatus` | `buyer_organization_view` | Admin cookie (context or header), App Key |
| `GET /_v/private/b2b/export/:exportId` | `buyer_organization_view` | Admin user token only |

Validation uses VTEX Identity (`audience: admin`, matching account) and License Manager role checks.

---

## Recommended client flow

1. Call `createExport(exportType)` and store `exportId`.
2. Poll `exportStatus(exportId)` every few seconds until `status` is terminal.
3. When `status === COMPLETED`, download via `linkToFile` (or build the URL with `exportId`).
4. Treat `progressPercentage: null` as “in progress” rather than 0%.
5. On `FAILED`, surface an error and allow the user to start a new export.

---

## External dependency

Export job execution and XLSX generation are handled by:

```
https://b2b-bulk-import.vtexcommercestable.com.br/api/b2b/export
```

This app proxies create/status requests and converts the completed file for download. Export failures originating in bulk-import are surfaced through `exportStatus` (`FAILED`) or as user-facing errors on create/download.
