# 0023. Design tokens and the profile screen — rationale

## Context

Four reference mockups landed in `C:/Users/ADMIN/Downloads/` for the account area: the profile, the checkout, the order history and the seller sales panel. They were drawn on one palette, and that palette is not the one the storefront renders today.

The measured state of `apps/customer/src/app/index.css` on 2026-11-16, converted from the oklch values by `python scripts/oklch-contrast.py css apps/customer/src/app/index.css`:

| Token | Renders as | Mockup wants | Delta |
|---|---|---|---|
| `--background` | `#0a0a0a` | `#09090b` | one step |
| `--card`, `--popover` | `#171717` | `#0c0c0e` | 11 steps of luminance, the whole card stops reading as a card |
| `--primary` | `#e5e5e5` | `#fafafa` | the button reads grey next to `#fafafa` text |
| `--primary-foreground` | `#171717` | `#09090b` | — |
| `--secondary`, `--muted`, `--accent` | `#262626` | `#18181b` | hover fills are far too light on the new card |
| `--muted-foreground` | `#a1a1a1` | `#a1a1aa` | one channel |
| `--destructive` | `#ff6467` | `#7f1d1d` line, `#fca5a5` label | a fill where the mockup has a border and a text colour |
| `--border`, `--input` | `#ffffff` at 10 % | `#27272a` | translucent border picks up whatever sits behind it |
| `--ring` | `#737373` | `#52525b` | focus outline is louder than the mockup's |

There is no token for a delivered or a cancelled state, none for the card footer strip the mockups draw behind a form's action, and the two mockup radii of 12 and 16 are not on this file's ladder: with `--radius: 0.625rem`, `@theme inline` makes `rounded-sm` 6px, `rounded-md` 8px, `rounded-lg` 10px, `rounded-xl` 14px. The `/profile` screen is a flat list of forms under a `Separator` — no avatar, no name, no role, no grouping.

## Options

**Option 1 — copy the mockup into named tokens, redraw the screen from them.** Every value the four mockups repeat becomes a token once, the two off-ladder radii become named radii, and the profile screen is rebuilt out of its existing action components. Cost: one theme block rewritten, four screens redrawn later for free. Risk: a token renamed later breaks three specs at once.

**Option 2 — a scoped `.account` theme block on the four new screens.** The rest of the shop keeps shadcn neutral, the account area carries zinc. Cost: two palettes in one app, and every shared component (Card, Input, Button) needs a variant. Rejected: the owner reads a one step difference in a card background as a defect, so a home card and an order card that differ is exactly the defect he names.

**Option 3 — arbitrary values in class names (`bg-[#0c0c0e]`).** Cost: no token, no contrast check, and the next screen copies the hex from a component instead of from the theme. Rejected: it is the state the owner already banned.

## Decision

Option 1. The `.dark` block is rewritten to the mockup's zinc, five names are added (`--success`, `--destructive-soft`, `--destructive-line`, `--surface-raised`, and `--destructive` re-pointed at the line colour), two radii are added (`--radius-stat` 12px, `--radius-group` 16px), and `@theme inline` maps all of them. `:root` gets a light value for each new name so the settings picker cannot print an undefined colour.

The profile screen becomes a header plus five cards. The existing action components keep their files, props, dialogs and requests: `EditProfileForm` loses only its outer `space-y-8` wrapper, `SellOnAstrum` and `WorkOnAstrum` become the two role cards, `ChangePasswordForm` and `LogOutForm` become the two rows of one security card, and `DeleteAccountForm` becomes the removal card.

## Consequences

- The four redesigned screens of specs 0024 to 0026 print no colour of their own: they name `bg-card`, `border-border`, `text-muted-foreground`, `bg-surface-raised`, `text-destructive-soft`, `border-destructive-line`, `rounded-stat`, `rounded-group`.
- Five screens that nobody asked about (home, category, product, cart, wishlist) change appearance without a line of their own code, because they read the same tokens. That is why AC-9 exists: the change is checked there rather than assumed.
- `--destructive` moving from `#ff6467` to `#7f1d1d` darkens every destructive button in the shop. It is the mockup's colour, and a solid `#7f1d1d` fill under `#fca5a5` text keeps the 3:1 large-text and 4.5:1 body ratios; a solid `#ff6467` under white did not.
- The radius ladder stays derived, so a later change of `--radius` still moves every 8, 10 and 14 px corner. The two new radii are constants on purpose: a stat tile that grows with the base radius is not a stat tile any more.
- `src/components/ui/**` stays outside the standard and may keep its own inline colours; AC-3 greps `src` and excludes that folder for exactly this reason.

## Follow-ups

- The seller panel and the order history need `rounded-group` (16px) and `bg-surface-raised` for their group header. They use them from spec 0025 and 0026, not here.
- `#3f3f46` (the mockup's badge border, avatar border and outline button border) has no token. It prints as `border-secondary` today. If the owner wants the lighter border, it becomes `--border-strong` in a later spec rather than a hex in a component.

References: the four mockups under `C:/Users/ADMIN/Downloads/` (`Профиль-html/Main.dc.html`, `Оформление заказа-html/Checkout.dc.html`, `Мои заказы-html (1)/Main.dc.html`, `Продажи-html/Sales.dc.html`), and the measured token table above.
