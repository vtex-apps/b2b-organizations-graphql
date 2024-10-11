# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Add TopBarSettings type in B2B settings and updated saveB2BSettings to use the new topBar field in UISettings

## [0.60.0] - 2024-10-09

### Added
- Add new store user token validation directive to some APIs

## [0.59.0] - 2024-10-08

### Added
- Add permission createQuote to organization

## [0.58.0] - 2024-10-07

### Added
- Add new admin token validation directive to getOrganizationsWithoutSalesManager

## [0.57.1] - 2024-09-30

### Fixed
- Change GetOrganizationRequests API cache control scope to private

## [0.57.0] - 2024-09-12

### Added
- Add new admin token validation directive to some APIs

## [0.56.2] - 2024-09-10

### Fixed

- Remove error log when file not found for marketing's tags.

## [0.56.1] - 2024-09-10

### Added
- Add logging for store token validation

## [0.56.0] - 2024-09-09

### Added

Adds a new `getAccount` query to retrieve account information. It includes fields such as `id`, `name`, `accountName`, `tradingName`, and `isActive`. This query is implemented in both the GraphQL schema and the LMClient class.

## [0.55.0] - 2024-08-22

### Added
- Add paymentTerms field to cost center input on mutations

## [0.54.0] - 2024-08-12

### Added

- Add new `getSellersPaginated` query to allow pagination on sellers query

## [0.53.0] - 2024-08-06

### Fixed

- Add paymentTerms field on create cost center mutation

## [0.52.0] - 2024-08-05

### Added

- New admin user token validation directive

## [0.51.2] - 2024-07-30

### Fixed

- Provide app token on calls to storefront-permissions app

## [0.51.1] - 2024-07-22

### Added

- Audit metrics for some graphql APIs
- Improve access directives

## [0.51.0] - 2024-06-04

### Fixed

- Removed 0.50.0 version changes which contained a bug

## [0.50.0] - 2024-06-03

### Added

- `Trade Name` to be searchable (Admin)
- `Trade Name` to the Organization listing page (Admin)
- `Trade Name` to the Organization Requests listing page (Admin)
- Event listener to update schemas once new app version is released

## [0.49.6] - 2024-06-03

### Fixed

- Fix check access directive by allowing appkey tokens for authentication

## [0.49.5] - 2024-05-29

### Changed

- Improve logging and metrics for checkUserAccess and checkAdminAccess directives

## [0.49.4] - 2024-05-07

### Added

- Add metric to check access directives

## [0.49.3] - 2024-04-24

### Fixed

- Provide correct tokens to clients

## [0.49.2] - 2024-04-18

### Fix

- Use b2b-organizations app name on checkUserPermission to correctly get the user permissions

## [0.49.1] - 2024-03-28

### Fix

- Fix getCostCenterById query when the cost center is not found

## [0.49.0] - 2024-03-20

### Added

- Add new removeUserWithEmail graphql API for bulk import use case

## [0.48.5] - 2024-02-29

### Fixed

- Skip auth token validation when the x-vtex-caller is b2b-checkout-settings

## [0.48.4] - 2024-02-28

### Fixed

- Policies config rollback for graphql operations. Enable configuration.

## [0.48.3] - 2024-02-27

### Fixed

- add a check condition for the caller, to allow requests from storefront-permissions in the flow create session.

## [0.48.2] - 2024-02-21

### Fixed

- Add analytics client to properly send metrics to redshift

## [0.48.1] - 2024-02-07

### Fixed

- Add retries to `sendMetric` to avoid connection errors

## [0.48.0] - 2024-01-19

### Added

- Allow `paymentTerms`, `collections` and `sellers` to be provided by name only on `createOrganizationAndCostCenterWithAdminUser`

## [0.47.1] - 2023-12-18

### Fixed

- Validate if the session token is not undefined to set as headers to call storefront-permissions

## [0.47.0] - 2023-12-14

### Added

- Add token validation in graphql operations and token to call storefront-permission

## [0.46.0] - 2023-11-28

### Added

- Add new createUserWithEmail graphql API for bulk import use case

## [0.45.0] - 2023-11-28

### Added

- allow creation of cost center with an user provided id

## [0.44.1] - 2023-11-09

### Fixed

- Remove get permissions from access audit metrics

## [0.44.0] - 2023-11-06

### Added

- add an authentication metric to check if the access is authenticated

## [0.43.2] - 2023-11-03

### Fixed

- Fix costCenterId null in the response when using 'createOrganization' mutation

## [0.43.1] - 2023-10-27

### Fixed

- use cost center ID created on approve organization request

## [0.43.0] - 2023-10-20

### Added

- fallback to check an admin token on the header

## [0.42.0] - 2023-10-13

### Added

- add new mutation to create organization and cost center specifying the id

## [0.41.0] - 2023-10-09

### Fixed

- Fix to impersonate user with the role `sales`

## [0.40.0] - 2023-09-29

### Added

- Add change organization status metrics(approved or declined)

## [0.39.0] - 2023-09-25

### Added

- Add metrics to maintain buyer organization users

## [0.38.0] - 2023-09-25

### Added

- Add metrics on updating organization data

## [0.37.0] - 2023-09-19

### Added

- Added event trigger on delete a user

## [0.36.1] - 2023-09-19

### Fixed

- Use Orders endpoint instead of OMS to obtain order information

## [0.36.0] - 2023-08-11

### Added

- Added metrics for impersonate user
-

## [0.35.3] - 2023-08-09

### Fixed

- Load impersonated user email when using OOTB impersonation

## [0.35.2] - 2023-08-01

### Fixed

- Fixed error when fetching a user's role slug

## [0.35.1] - 2023-08-01

### Fixed

- Fix auth problem when fetching orders history

## [0.35.0] - 2023-07-24

### Added

- Added the custom fields to the graphql query

## [0.34.0] - 2023-07-21

### Fixed

- Add `/_v/private` prefix to service routes to allow session token to be forwarded to resolver

## [0.33.4] - 2023-07-19

### Fixed

- Fixed messages errors on impersonate

### Security

- Added flag for not uploading log on Cabueta execution

### Security

- Fix Cabueta config

### Security

- Added security scan on pipeline

## [0.33.3] - 2023-06-22

### Fixed

- Fix auth problem when fetching orders history

## [0.33.2] - 2023-06-09

### Fixed

- Setup unit tests and fix lint errors

## [0.33.1] - 2023-05-31

### Fixed

- Bug fixed on creating the organization with marketing tags and sellers

## [0.33.0] - 2023-05-31

### Feature

- Added marketing tags to the cost center payload
- Added sellers by cost center (scope)

### Fixed

- Fixed adding multiple cost centers from an organization request
- Fixed users when there are multiple cost centers

## [0.32.1] - 2023-05-11

### Fixed

- Not able to add User

## [0.32.0] - 2023-04-24

### Fixed

- Hotfix to force housekeeper to update the app

## [0.31.3] - 2023-04-21

### Fixed

- Fixed impersonation user

## [0.31.2] - 2023-04-17

### Fixed

- Security issue fixed

### Removed

- [ENGINEERS-1247] - Disable cypress tests in PR level

## [0.31.1] - 2023-04-05

### Added

- Added two new boolean values in order to prevent user from changing state and business field in the cost center

## [0.31.0] - 2023-03-31

### Added

- Added the businessDocument as search field

## [0.30.4] - 2023-03-29

### Fixed

- Fixed createOrganization schema to accept customFields

## [0.30.3] - 2023-03-20

### Fixed

- Fixed VtexIdclientAutCookie when send the headers properly

## [0.30.2] - 2023-03-17

### Changed

- Run schedule job only on saturday

### Fixed

- Bug fix on checking app and api keys

## [0.30.1] - 2023-03-01

### Fixed

- Bug fixed on save user (last name data)

## [0.30.0] - 2023-02-21

### Added

- Added the email transactional to the organization request and the options for disabling/enabling them.

## [0.29.1] - 2023-02-20

### Fixed

- Fixed the adminToken when get the users queries

## [0.29.0] - 2023-02-14

### Added

- Added custom fields for organizations and cost centers

## [0.28.0] - 2023-02-08

### Added

- added sellers to orgs
- added ui modal options to settings
- added sellers to organization request

## [0.27.0] - 2023-02-08

### Added

- Added the apiToken apiKey validation

## [0.26.1] - 2023-02-03

### Added

- `ListOrders` policy

## [0.26.0] - 2023-02-02

### Added

- Added the field to add multiple cost centers to an organization request
- Added the paymentTerms, sales channel and price tables do the organization request to add when the organization is created
- Added the notifyUser flag throughout the organization mutations which implies that the user will be notified when the organization is created or updated by email

## [0.25.1] - 2023-01-24

### Fixed

- Removing JWT dependency

## [0.25.0] - 2023-01-16

### Added

- Allow users to set auto approval for new organization with a new setting fields

## [0.24.0] - 2022-10-25

### Changed

- Cypress improvements

### Added

- Added the state registration number to cost center schema

## [0.23.3] - 2022-10-17

### Changed

- Split bindings testcase into two files

### Changed

- Change app settings to store settings in VBase

## [0.23.2] - 2022-10-14

### Added

- Added the salesChannel field to Organization type

## [0.23.1] - 2022-10-07

### Fixed

- Updated graphql schema and added and fix a bug when the query is called

## [0.23.0] - 2022-10-06

### Added

- Added marketing tags to the b2b scope

### Updated

- Update GitHub reusable workflow to version 2

## [0.22.2] - 2022-09-21

### Fixed

- Fixed the default accessibility for binding selection setting

## [0.22.1] - 2022-09-19

### Fixed

- Added permission to save the app settings

## [0.22.0] - 2022-09-16

### Added

- Added sales channels binding selection setting

## [0.21.0] - 2022-09-15

### Added

- Added a check verification if the organization is active

## [0.20.1] - 2022-09-15

### Fixed

- Bug fixed on impersonation user

## [0.20.0] - 2022-09-09

### Added

- Added a graphql query to fetch all organizations from a user by email parameter

## [0.19.8] - 2022-08-31

### Added

- Added the cookie header to storefront permissions requests passing the authentication token.

## [0.19.7] - 2022-08-23

### Fixed

- If a cost center address is missing an `addressId`, one will be automatically generated and saved when querying a cost center by ID

## [0.19.6] - 2022-08-08

### Changed

- App Review: Added logging, fixed security issues and code cleanup

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
