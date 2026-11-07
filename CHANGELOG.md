# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added seller order endpoints that return only the seller's order lines and allow bounded pagination. (see spec 0002)
- Added business ownership records and order line ownership snapshots. Existing businesses remain unassigned until an owner is explicitly assigned. (see spec 0002)
- Added the `SELLER_ORDER_WORKFLOW_ENABLED` flag, which is false by default and gates seller order endpoints. (see spec 0002)

### Changed

- Product creation now assigns the authenticated seller's business instead of accepting business ownership from the request. Sellers without an assigned business receive a clear refusal.
- Seller order line updates now follow the allowed status transitions and recalculate the parent order status. Cancellation returns stock in the same transaction, and repeated updates do not return it twice. (see spec 0002)
