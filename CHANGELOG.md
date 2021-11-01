# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `getUsers` query
- `saveUser` and `removeUser` mutations
- `withSession` directive
- `getOrganizationById` and `getCostCenterByOrganizationId` queries will now use the user's organization ID if no ID argument is provided

## [0.2.3] - 2021-10-29

### Fixed

- Allow organization names to be changed

## [0.2.2] - 2021-10-28

### Changed

- App sender from `vtex.b2b-organizations@0.x` to `vtex.b2b-orders-history@0.x`

## [0.2.1] - 2021-10-21

### Added

- Payment Term support

## [0.2.0] - 2021-10-04

### Added

- Orders history support

## [0.1.0] - 2021-09-24

### Added

- `getCostCenters` query

### Fixed

- handle spaces in masterdata search terms

## [0.0.3] - 2021-09-10

### Fixed

- Add `schema` argument to `updateCostCenter` masterdata call
- Utilize `where` argument for masterdata searches (instead of unsupported `keyword` argument)

## [0.0.2] - 2021-09-09

### Fixed

- Correct handling of masterdata document IDs in `createOrganization` and `createCostCenter` resolvers

## [0.0.1] - 2021-08-31

### Added

- Initial release
