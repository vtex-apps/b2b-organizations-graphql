# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.19.5] - 2022-07-19

### Fixed

- Fixed on update the user data, and it disappeared from the list

## [0.19.4] - 2022-07-08

### Fixed

- Allow emails associated with declined requests to request new organization

## [0.19.3] - 2022-06-28

### Added

- Add error messages improvement

## [0.19.2] - 2022-06-23

### Fixed

- Allow `tradeName` and `phoneNumber` fields to be emptied when organization or cost center are updated

## [0.19.1] - 2022-06-17

### Fixed

- Add optional `tradeName` argument to `updateOrganization` mutation

### Added

- Github Action to trigger manual tests by dispatch

## [0.19.0] - 2022-06-09

### Added

- Support for organization `tradeName` field and cost center `phoneNumber` field (both optional)

## [0.18.0] - 2022-06-03

### Added

- Added the query to get the organizations without a sales manager

## [0.17.1] - 2022-05-31

### Added

- Added handling to the addUser mutation by showing the correct message when the user already exists.

## [0.17.0] - 2022-05-23

### Added

- Added the pagination to getUsers query

## [0.16.2] - 2022-05-12

### Added

- Cancellation request route to support `vtex.b2b-orders-history`
- Checkout client
- Permission check in `order` route

### Changed

- Use admin OMS API to get order details, to ensure we have the user's email

## [0.16.1] - 2022-04-25

### Added

- Added duplicate check for create organization request

## [0.16.0] - 2022-04-15

### Added

- the structure of the components has been improved;
- Added 2 mutations in order to follow the mutations from storefront permissions (updateUser and addUser);

### Fixed

- Remove a couple of conditionals nested;
- Remove unnecessary variables, some changes to inline returns;

## [0.15.0] - 2022-04-08

### Added

- add subfield `email` of the `b2bCustomerAdmin` field to check duplicate requests by email

## [0.14.0] - 2022-04-04

### Added

Added 2 mutations to handle the cost center addresses

- updateCostCenterAddress
- createCostCenterAddress
  see schema/schema.graphql for more details

## [0.13.0] - 2022-03-31

### Added

- Optional `businessDocument` field for cost centers

## [0.12.0] - 2022-03-25

### Changed

- Adjust `getPaymentTerms` query so that it now returns all enabled payment methods, not just promissories

### Fixed

- In the `orders` route handler, request the user's permissions for `vtex.b2b-orders-history` instead of `vtex.b2b-organizations`

## [0.11.0] - 2022-03-24

### Fixed

- In `impersonateUser` resolver, if `clId` is provided but `userId` is not, check CL document to see if userId exists there and then update storefront-permissions' user record
- Similarly, when editing a user, if `userId` is null, check CL document to see if userId exists there and then sync it with storefront-permissions

### Changed

- Use storefront-permissions' GraphQL interface directly instead of sending requests through `vtex.graphql-server`

## [0.10.0] - 2022-03-08

### Added

- `impersonateUser` mutation
- Permission checks related to sales roles

### Changed

- Increase timeout

### Fixed

- `checkConfig` promise bug that prevented MD schema from being created

## [0.9.2] - 2022-01-26

### Fixed

- Correctly handle spaces when searching masterdata
- Use CL id instead of user id in `saveUser` and `removeUser` operations

## [0.9.1] - 2022-01-06

### Added

- SonarCloud PR integration

## [0.9.0] - 2021-12-23

### Added

- Organization admins will be notified via email if an organization's status changes

### Fixed

- App no longer stores data in AppSettings, to allow app to function without being explicitly installed

## [0.8.1] - 2021-12-17

### Fixed

- Enable immediate indexing for MD schemas

### Deprecated

- `costCenters` property in organization schema (expect this to be an empty array)

## [0.8.0] - 2021-12-10

### Added

- Support for enabling/disabling specific payment terms per cost center

## [0.7.0] - 2021-12-06

### Added

- When an organization request is approved, the user specified as the organization admin is now created and/or the appropriate permissions and organization / cost center are assigned to them.

### Fixed

- Improved email templates for organization creation / approval / denial
- Format of creation date MD schema fields to allow for proper date sorting
- Properly return ID of created MD document in GraphQL mutations that create documents
- Use returned value `DocumentId` from MD creation operations instead of `Id` to eliminate unnecessary `replace()` functions

## [0.6.0] - 2021-11-29

### Added

- Permissions check to `getUsers` query and `saveUser`, `removeUser` mutations

### Changed

- `getCostCenterByIdStorefront` query ID argument is now optional, will use user's cost center ID as default

### Fixed

- Made storefront queries private

## [0.5.0] - 2021-11-09

### Added

- Send email to Sales Admins and Customer Admin on organization and request updates.

## [0.4.0] - 2021-11-04

### Added

- `/b2b/oms/user/checkout/` route to return `paymentTerms` and Cost Center addresses

## [0.3.2] - 2021-11-03

### Changed

- Create separate queries for storefront users that check user's permissions

## [0.3.1] - 2021-11-02

### Fixed

- Initialize `B2BUser` query field resolvers
- Don't set `sessionToken` header in `GraphQLServer` client if token is null

## [0.3.0] - 2021-11-01

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
