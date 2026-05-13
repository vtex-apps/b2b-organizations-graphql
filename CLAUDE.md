# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a VTEX IO app (`vtex.b2b-organizations-graphql`) built with the `node` and `graphql` builders. It manages B2B Organizations and Cost Centers via a GraphQL API backed by VTEX MasterData v2.

## Commands

All commands from the repo root unless noted.

```bash
# Lint (root)
yarn lint

# Format
yarn format

# Tests (runs inside node/)
yarn test

# Run a single test file
cd node && yarn test resolvers/Mutations/Organizations.test.ts

# Lint node layer only
cd node && yarn lint
```

To deploy/link the app you need the VTEX CLI:
```bash
vtex link     # link app to a workspace
vtex publish  # publish (triggered automatically via postreleasy script)
```

## Architecture

### Builders
- **`node/`** — Node.js service layer (TypeScript, `@vtex/api` 6.x). Contains all business logic.
- **`graphql/`** — GraphQL schema (`schema.graphql`) and directives (`directives.graphql`). The `graphql` builder exposes these.

### Node layer structure

```
node/
  index.ts          # Service entrypoint — wires clients, resolvers, routes
  service.json      # Runtime config (memory, replicas, HTTP routes)
  clients/          # IOClients wrapping external APIs (MasterData, OMS, Payments, etc.)
  resolvers/
    Queries/        # One file per domain: Organizations, CostCenters, Users, Settings, MarketingTags
    Mutations/      # Same domains
    Routes/         # Non-GraphQL HTTP handlers (orders, checkout)
    repository/     # CostCenterRepository — MasterData access abstraction for cost centers
    config.ts       # checkConfig helper (app settings)
    directives.ts   # GraphQL schema directives
    fieldResolvers.ts # Field-level resolvers for B2BOrganization / B2BUser types
    message.ts      # Email notification helpers
  mdSchema.ts       # MasterData entity definitions (data entities, fields, schema versions)
  constants.ts      # Shared enums and constants
  typings/          # TypeScript type definitions
  utils/            # GraphQLError helper, metrics, org/cost-center constants
```

### Data storage
All persistent data lives in **VTEX MasterData v2** entities defined in `node/mdSchema.ts`:
- `organization_requests` — pending org requests
- `organizations` — approved organizations
- `cost_centers` — cost centers linked to orgs

### Permissions
Authorization is delegated to `vtex.storefront-permissions`. Mutations/queries use GraphQL directives (defined in `graphql/directives.graphql`) to enforce role checks. The `checkConfig` helper in `node/resolvers/config.ts` validates app settings before executing resolvers.

### External clients (`node/clients/`)
Each file wraps a VTEX internal or external API:
- `LMClient` — License Manager (role management)
- `storefrontPermissions` — role/permission resolution
- `vtexId` / `IdentityClient` — authentication
- `checkout`, `oms`, `orders` — commerce APIs
- `catalog`, `sellers` — product/seller data
- `audit`, `analytics` — event tracking
- `email` (MailClient) — transactional email via templates

### Tests
Tests use Jest + ts-jest and live alongside the source files (`*.test.ts`). Current test coverage is in `node/resolvers/Mutations/Organizations.test.ts` and `node/resolvers/Mutations/Users.test.ts`.

### CI
- PR quality gate: runs Danger, node lint, and Cypress E2E (via `vtex-apps/usqa` reusable workflow).
- E2E config in `cy-runner.yml`; tests triggered manually or on labeled PRs.
