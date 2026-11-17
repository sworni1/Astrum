# 0023. Design tokens and the profile screen

**Date**: 2026-11-16
**Status**: In Progress

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

The storefront dark theme is shadcn `neutral`: `--card` prints `#171717`, `--border` about `#222222`, `--ring` `#737373`. The four reference mockups are zinc: page `#09090b`, card `#0c0c0e`, border and input `#27272a`, muted `#a1a1aa`, focus outline `#52525b`, text and primary `#fafafa`, primary foreground `#09090b`. This decision pins that palette into the `.dark` block of `apps/customer/src/app/index.css`, adds the three semantic colours the mockups need and two radii that are not on the derived ladder, and redraws `/profile` as the mockup draws it: an avatar header with the role badge, one card per concern, and the account removal card in the destructive line colour. Every existing profile action keeps working, and no `.tsx` file may carry a hex value any more (one gradient excepted).

## Requirements

**User stories**:

- As a customer, I want the whole shop on one palette, so that a card on `/profile` looks like a card on `/orders`.
- As a customer, I want `/profile` to tell me at a glance who I am, what I may do here, and how my account is secured, instead of one flat list of forms.
- As a customer, I want my birthday and gender to be visibly not editable, so that I stop looking for a way to change them.
- As the shop, I want the mockup values to live in named tokens, so that the next screen is a copy of a class name and not a copy of a hex.

**Acceptance criteria** (the contract):

- **AC-1**: The `.dark` block at the bottom of `apps/customer/src/app/index.css` (the oklch block, not the HSL template near the top) carries exactly these values: `--background: #09090b`, `--card: #0c0c0e`, `--popover: #0c0c0e`, `--border: #27272a`, `--input: #27272a`, `--muted-foreground: #a1a1aa`, `--ring: #52525b`, `--foreground: #fafafa`, `--card-foreground: #fafafa`, `--popover-foreground: #fafafa`, `--primary: #fafafa`, `--primary-foreground: #09090b`, and the derived fills `--secondary`, `--muted`, `--accent` at `#18181b` with their foregrounds at `#fafafa`. The same block gains `--success: #4ade80`, `--destructive-soft: #fca5a5`, `--destructive-line: #7f1d1d`, `--destructive: #7f1d1d` and `--surface-raised: #101013`. `:root` keeps a light value for each of the five new names, so no token is undefined when the theme is `light`. `grep -n "oklch" apps/customer/src/app/index.css` still matches the `:root` block and the chart and sidebar entries of `.dark`, and matches no background, card, border, input, ring, primary or text value.
- **AC-2**: `@theme inline` maps every new name to a utility: `--color-success`, `--color-destructive-soft`, `--color-destructive-line`, `--color-surface-raised` as `var(--…)`, and `--radius-stat: 12px` plus `--radius-group: 16px` as literal values, because those two are constants and not theme dependent. The derived ladder is untouched (`--radius: 0.625rem`, so `rounded-sm` 6px, `rounded-md` 8px, `rounded-lg` 10px, `rounded-xl` 14px, `rounded-2xl` 18px, `rounded-3xl` 22px). A mockup radius of 8, 10 and 14 is therefore `rounded-md`, `rounded-lg`, `rounded-xl`; 12 is `rounded-stat` and 16 is `rounded-group`. Proof: `grep -n "radius-stat\|radius-group\|color-success\|color-destructive-soft\|color-destructive-line\|color-surface-raised" apps/customer/src/app/index.css` matches six declarations, and the rendered `border-radius` of a `.rounded-stat` element is `12px` in the browser.
- **AC-3**: No component carries a hex value: `grep -rn "#[0-9a-fA-F]\{3,8\}\b" apps/customer/src --include=*.tsx --include=*.ts` matches nothing outside `apps/customer/src/components/ui/**` (vendored shadcn, outside the standard) and one exception, `apps/customer/src/features/pages/Profile/lib/styles.ts`, which holds the avatar gradient `linear-gradient(135deg, #3f3f46, #18181b)` as the single raw colour in the profile feature because a gradient is not a token.
- **AC-4**: `/profile` renders the mockup's structure at 1280 and at 390 wide: a page wrapper `max-w-[880px]` with `py-14 px-6 pb-[72px]` and `gap-7` between its blocks; a header row of a `72px` avatar circle (`rounded-full`, the gradient of AC-3, `border border-[#3f3f46]` printed as `border-secondary`… see Feature design for the exact class), the nickname at `text-[28px] font-bold tracking-[-.02em]`, the email at `text-sm text-muted-foreground` and a role badge; then the profile data card, the two role cards in a `grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]`, the security card and the account removal card.
- **AC-5**: The profile data card prints its own header (`text-[18px] font-semibold tracking-[-.01em]` title, `mt-1.5 text-sm text-muted-foreground` text), its body in `p-6 gap-5`, and a footer strip (`px-6 py-4`, `border-t border-border`, `bg-surface-raised`) that holds the hint and the submit button. The nickname and the email stay editable through the existing `EditProfileForm`; the date of birth and the gender inputs are `readOnly` and `disabled`, print the muted foreground on `bg-secondary`, and the footer hint says they are not editable. The submit button is disabled until the form changes, as it is today.
- **AC-6**: The two role cards each carry a `44px` icon tile (`rounded-lg`, `bg-secondary`, `border border-border`), a title, a text, and one action in a footer strip: `SellOnAstrum` keeps its `data-testid="sell-on-astrum"` and its `/seller/onboarding` link and renders only for an account with `isSeller === false`; `WorkOnAstrum` keeps `data-testid="work-on-astrum"`, its `/staff/onboarding` link, its held roles and its point line.
- **AC-7**: The security card holds two rows separated by a `1px` line: `Пароль` with the existing change password dialog behind an outline button, and `Выход` with the existing log out dialog behind an outline button. The account removal card is `border border-destructive-line` with a `text-destructive-soft` title and one button styled as the mockup's destructive one (`bg-destructive-line/20 border border-destructive-line text-destructive-soft`, hover `bg-destructive-line/40`), keeping the existing delete dialog. No action that worked before is removed and no new request is added.
- **AC-8**: The role badge prints one of three labels from `profile` messages: `Покупатель` for an account with no seller flag and no staff role, the seller label when `isSeller` is true, and the staff label when `staffRoles` is not empty. Both `messages/ru.json` and `messages/en.json` carry the keys, and no Cyrillic appears in a `.tsx` file.
- **AC-9**: The five screens that already exist render with no contrast regression under the new palette at 390 and 1280 wide: home, category, product, cart and wishlist. Each is screenshotted in the browser on the dev stack and read against the background it sits on; no text falls below a 4.5:1 ratio for body copy or 3:1 for a large heading, measured with the devtools colour picker.
- **AC-10**: Nothing that already passed breaks: `pnpm --filter @astrum/customer lint`, `pnpm --filter @astrum/customer test`, `pnpm check-types` and `pnpm --filter @astrum/customer build` are green, with the real output quoted in the report.

## Decision

**Chosen option**: Option 1: copy the mockup values into named tokens, then redraw the screen from those tokens.

The palette is zinc, not neutral, and the five names the mockups need beyond shadcn's set (`--success`, `--destructive-soft`, `--destructive-line`, `--surface-raised`) become theme tokens so that a later screen never writes a hex. The two mockup radii that are not on this file's ladder (12 and 16) become `--radius-stat` and `--radius-group`. The profile screen is rebuilt as a header plus five cards out of the existing action components: their props, dialogs and requests do not change, only the shell around them does.

**Assumed:** (a) the light theme needs values for the five new names, chosen here as `--success: #16a34a`, `--destructive-soft: #b91c1c`, `--destructive-line: #dc2626`, `--destructive: #dc2626`, `--surface-raised: #f4f4f5`, because a theme that is reachable through the settings picker must not print an undefined colour; (b) `--destructive` is set to the mockup's line colour `#7f1d1d` in the dark theme, so a `variant="destructive"` button reads as the mockup's red; (c) `#3f3f46` (badge border, avatar border, outline button border) is not a token of its own and prints as `border-secondary` (`#18181b`) unless the design names it later, except in the avatar gradient of AC-3 which the owner named as the one raw-colour exception.

**Implementation skills**: none consulted. The storefront follows `apps/customer/AGENTS.md` (S1 to S5).

## Feature design

**Token table** (`apps/customer/src/app/index.css`, `.dark`):

| Token | Value | Where the mockup uses it |
|---|---|---|
| `--background` | `#09090b` | page background |
| `--card`, `--popover` | `#0c0c0e` | card and sheet surface |
| `--foreground`, `--card-foreground` | `#fafafa` | body text, card title |
| `--muted-foreground` | `#a1a1aa` | card text, hints, field labels under a value |
| `--border`, `--input` | `#27272a` | card border, input border, separator |
| `--ring` | `#52525b` | focus outline (2px, offset 1px) |
| `--primary` / `--primary-foreground` | `#fafafa` / `#09090b` | primary button fill and label |
| `--secondary`, `--muted`, `--accent` | `#18181b` | icon tile, readonly field, hover fill |
| `--success` | `#4ade80` | delivered badge text and dot |
| `--destructive-soft` | `#fca5a5` | destructive button label, removal card title |
| `--destructive-line` | `#7f1d1d` | destructive button border, removal card border |
| `--surface-raised` | `#101013` | card footer strip |

**Radii**: `--radius-stat: 12px` (stat tile, thumbnail), `--radius-group: 16px` (order group) in `@theme inline`. The mockup's 8 (`rounded-md`), 10 (`rounded-lg`), 14 (`rounded-xl`) and 999 (`rounded-full`) come from the existing ladder and are not redefined.

**Profile layout** (1280 / 390):

| Block | Class | Detail |
|---|---|---|
| wrapper | `mx-auto w-full max-w-[880px] py-14 px-6 pb-[72px]` | outer padding 24px, bottom 72px |
| stack | `flex flex-col gap-7` | 28px between blocks |
| header | `flex items-center gap-5` | avatar 72px + name block |
| avatar | `h-[72px] w-[72px] rounded-full border border-border text-[28px] font-semibold` | gradient from `lib/styles.ts` |
| name | `text-[28px] font-bold tracking-[-.02em]` | one line, `h1` |
| badge | `inline-flex h-6 items-center rounded-full border border-border px-2.5 text-xs font-medium text-muted-foreground` | role label |
| card | `rounded-xl border border-border bg-card` | 14px radius, no shadow |
| card header | `px-6 pt-6` | title 18px/600, text 14px muted `mt-1.5` |
| card body | `flex flex-col gap-5 p-6` | 20px gap |
| card footer | `flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-raised px-6 py-4` | hint left, action right |
| field | `flex flex-col gap-2` | label 14px/500, control 40px |
| input | `h-10 rounded-md border border-input bg-background px-3 text-sm` + `focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring` | readonly: `bg-secondary text-muted-foreground cursor-not-allowed` |
| role grid | `grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]` | one column under 320+40 |
| icon tile | `h-11 w-11 rounded-lg border border-border bg-secondary flex items-center justify-center` | 44px |
| row | `flex flex-wrap items-center justify-between gap-4 py-4` | security rows |
| action (primary) | `h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-secondary disabled:opacity-40` | |
| action (outline) | `h-10 rounded-md border border-border px-4 text-sm font-medium hover:bg-secondary` | |
| action (destructive) | `h-10 rounded-md border border-destructive-line bg-destructive-line/20 px-4 text-sm font-medium text-destructive-soft hover:bg-destructive-line/40` | |

**Component shape** (S1, S2): `src/features/pages/Profile/index.tsx` composes, and holds no markup of its own beyond the wrapper and the stack. New files: `components/ProfileHeader.tsx` (avatar, name, email, badge), `components/ProfileCard.tsx` (the card shell with `title`, `text`, `footer`, `children`), `components/ProfileField.tsx` (label + control + hint), `lib/styles.ts` (every class constant of the table above plus the gradient), `lib/roleBadge.ts` (a pure function from `isSeller`/`staffRoles` to a message key, with a test). The five existing action components keep their files and their props; only their outer markup becomes `ProfileCard`.

## Build plan

1. Tokens: rewrite the `.dark` block and extend `:root` and `@theme inline`, then prove the six new declarations and the hex-free tree (AC-1, AC-2, AC-3).
2. Profile shell: `lib/styles.ts`, `lib/roleBadge.ts` with its test, `components/ProfileCard.tsx`, `components/ProfileField.tsx`, `components/ProfileHeader.tsx`, and the new `index.tsx` (AC-4, AC-8).
3. Profile actions: `EditProfileForm` body and footer, `SellOnAstrum` and `WorkOnAstrum` as role cards, the security card built out of `ChangePasswordForm` and `LogOutForm`, `DeleteAccountForm` in the destructive card (AC-5, AC-6, AC-7).
4. Messages: the badge and card keys in `messages/ru.json` and `messages/en.json` (AC-8).
5. Gates, then the walk of `verify.md` against the running stack, including the five screens of AC-9 (AC-9, AC-10).
