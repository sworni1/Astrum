# Scope: Astrum storefront

The browser side of the shop: the auth screens and the pages a signed in customer walks through. Backend services keep their own scopes.

**Build approach:** Tracer Bullet (every feature works end to end through the storefront and the gateway).
**Workflow:** Beta (after `/develop`: `/check verify`, then `/test`). A feature can carry its own tag to raise or lower that.

_These are recommendations to keep the build orderly, not requirements. Skip anything that does not fit. You decide when a feature is `done`._

## At a glance

| #   | Feature                                    | Phase    | Status   |
| --- | ------------------------------------------ | -------- | -------- |
| A   | Sign in and register screens               | Existing | existing |
| B   | Home and categories                        | Existing | existing |
| C   | Product page                               | Existing | existing |
| D   | Cart and wishlist                          | Existing | existing |
| E   | Orders                                     | Existing | existing |
| F   | Profile and profile editing                | Existing | existing |
| 1   | Registration form: age rule and date entry | Slice 1  | done     |

## Already built

### A. Sign in and register screens · existing

Email and password sign in, registration with email, nickname, date of birth and gender. Session lives in the `__auth` cookie. code in `apps/customer/src/features/auth/`

### B. Home and categories · existing

Landing page and the category listing with pagination. code in `apps/customer/src/features/pages/Home/`, `apps/customer/src/features/pages/Categories/`

### C. Product page · existing

One product with add to cart. code in `apps/customer/src/features/pages/ProductOverview/`

### D. Cart and wishlist · existing

Cart lines and the wishlist list. code in `apps/customer/src/features/pages/Cart/`, `apps/customer/src/features/pages/WishList/`

### E. Orders · existing

Order history for the signed in customer. code in `apps/customer/src/features/pages/Orders/`

### F. Profile and profile editing · existing

Profile page with an edit form for the stored fields. code in `apps/customer/src/features/pages/Profile/`

## Slice 1: Registration form

### 1. Registration form: age rule and date entry · done

The register screen accepts a birthday and a gender, but the date field has no minimum age rule, the calendar needs a lot of clicking to reach an older year, the picker stays open after a choice, and the date cannot be typed at all. Gender selection has the same staying open problem.
**Done when:** a birthday can be typed as `DD.MM.YYYY` or picked from the calendar; a date younger than 14 years is refused with a message under the field; the calendar jumps to any month and year through dropdowns and lands on a usable month when opened; both the calendar and the gender list close right after a choice.
- [x] Build it: `/develop registration form age rule and date entry`
- [x] Verify it: `/check verify registration form age rule and date entry`
- [x] Test it: `/test registration form age rule and date entry`
  code in `apps/customer/src/features/auth/Register/`, rule in `apps/customer/src/common/zodSchemes/auth.scheme.ts`

## Legend

- **Next step** = the first unticked box.
- **Status**: `planned` → `in-progress` → `done`, plus `existing` (built before this scope) and `dropped`.
- A row tagged `needs a decision` runs `/architect` first; the tag drops once its spec is captured.
- **Workflow tag** beside a heading (for example `· GA`) overrides the project default for that feature.
