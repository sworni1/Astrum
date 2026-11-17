# 0023. Design tokens and the profile screen — verify

Run from the repository root on the dev stack (`pnpm dev`, storefront on `:3000`). Each step names the criterion it proves.

## 1. The tokens carry the mockup values (AC-1)

```
grep -n "^\s*--\(background\|card\|popover\|border\|input\|muted-foreground\|ring\|foreground\|primary\|secondary\|muted\|accent\|success\|destructive\|surface-raised\)" apps/customer/src/app/index.css | sed -n '/\.dark/,$p'
```

Simpler and honest, read the block:

```
sed -n '/^\.dark {/,/^}/p' apps/customer/src/app/index.css
```

Expected: the block contains `--background: #09090b`, `--card: #0c0c0e`, `--popover: #0c0c0e`, `--border: #27272a`, `--input: #27272a`, `--muted-foreground: #a1a1aa`, `--ring: #52525b`, `--foreground: #fafafa`, `--primary: #fafafa`, `--primary-foreground: #09090b`, `--secondary: #18181b`, `--muted: #18181b`, `--accent: #18181b`, `--success: #4ade80`, `--destructive: #7f1d1d`, `--destructive-soft: #fca5a5`, `--destructive-line: #7f1d1d`, `--surface-raised: #101013`.

```
grep -c "oklch" apps/customer/src/app/index.css
```

Expected: the count falls to the `:root` block plus the chart and sidebar entries of `.dark`; no background, card, border, input, ring, primary or text value is an oklch literal any more.

```
sed -n '/^:root {/,/^}/p' apps/customer/src/app/index.css | grep -n "success\|destructive-soft\|destructive-line\|surface-raised"
```

Expected: four matches, so the light theme has a value for every new name.

## 2. `@theme inline` maps them and the radii exist (AC-2)

```
grep -n "radius-stat\|radius-group\|color-success\|color-destructive-soft\|color-destructive-line\|color-surface-raised" apps/customer/src/app/index.css
```

Expected: six matches inside `@theme inline`, with `--radius-stat: 12px` and `--radius-group: 16px` as literal pixel values.

In the browser on `/profile`, with the devtools element picker on the avatar header card and on a stat tile of `/orders` later:

```
getComputedStyle(document.querySelector("[data-profile-card]")).borderRadius
```

Expected: `14px` (the `rounded-xl` of the existing ladder). On a `rounded-stat` element: `12px`. On a `rounded-group` element: `16px`.

## 3. No hex outside the one exception (AC-3)

```
grep -rn "#[0-9a-fA-F]\{3,8\}\b" apps/customer/src --include=*.tsx --include=*.ts | grep -v "src/components/ui/"
```

Expected: one match, the avatar gradient in `apps/customer/src/features/pages/Profile/lib/styles.ts`.

## 4. The screen structure (AC-4, AC-5, AC-6, AC-7)

With a signed in customer account, open `http://localhost:3000/profile` at 1280 wide.

Expected, top to bottom: a 72px round avatar with the nickname's first letter, the nickname at 28px bold, the email in muted grey and a role badge next to it; the `Данные профиля` card with four fields, the last two grey and locked, and a footer strip holding `Дата рождения и пол не редактируются.` and the disabled `Обновить профиль` button; two role cards side by side; the `Безопасность` card with the password row and the logout row split by a line; the removal card with a red border and a red title.

Screenshot both widths:

```
http://localhost:3000/profile    (1280 × 900)
http://localhost:3000/profile    (390 × 844)
```

Expected at 390 wide: the role cards stack in one column, the card footers wrap their hint above the button, and nothing scrolls sideways.

```
getComputedStyle(document.querySelector("[data-profile-card]")).borderTopColor
```

Expected: `rgb(39, 39, 42)` — `#27272a`, the mockup's border.

## 5. Every action still works (AC-7)

- Change `Обновить профиль`: the confirmation dialog opens, `Подтвердить` patches `/users/me` and the toast reads updated. (AC-5)
- `Сменить пароль`: the dialog opens, a wrong old password answers the refusal toast, a correct pair answers the success toast. (AC-7)
- `Выйти`: the dialog opens and the confirm lands on the sign in screen with the `__auth` cookie cleared. (AC-7)
- `Удалить аккаунт`: the dialog opens and the confirm deletes the account only on a throwaway account. (AC-7)
- For an account with `isSeller === false`, `Открыть лавку` is present and links to `/seller/onboarding`; for a seller it is absent. (AC-6)

```
grep -n "sell-on-astrum\|work-on-astrum" -r apps/customer/src/features/pages/Profile
```

Expected: both test ids still exist, so the existing suites still find their sections.

## 6. The role badge (AC-8)

Set the account's `isSeller` to `true` in the database and reload.

```
docker exec astrum-db psql -U greedyghoster -d astrum-db -c 'update "User" set "isSeller" = true where email = $$<test email>$$;'
```

Expected: the badge changes from `Покупатель` to the seller label, in both locales (`?lang=ru` and `?lang=en` or the locale switcher).

```
grep -n "roleBuyer\|roleSeller\|roleStaff" apps/customer/messages/ru.json apps/customer/messages/en.json
```

Expected: the same three keys in both files.

## 7. No contrast regression on the five older screens (AC-9)

Open each at 1280 and 390, and read the body text against the surface it sits on with the devtools colour picker:

```
http://localhost:3000/
http://localhost:3000/categories/toys
http://localhost:3000/products/<product id>
http://localhost:3000/cart
http://localhost:3000/wishlist
```

Expected: `#fafafa` on `#09090b` (19.3:1) and `#a1a1aa` on `#09090b` (7.4:1) for the two text roles; no card blends into the page; no element is invisible because a border became the same colour as its fill.

```
python C:/Users/ADMIN/AppData/Local/hermes/skills/astrum-monorepo/scripts/oklch-contrast.py contrast "#a1a1aa" "#0c0c0e"
python C:/Users/ADMIN/AppData/Local/hermes/skills/astrum-monorepo/scripts/oklch-contrast.py contrast "#fca5a5" "#0c0c0e"
```

Expected: both above 4.5:1 for body copy.

## 8. Gates (AC-10)

```
pnpm --filter @astrum/customer lint
pnpm --filter @astrum/customer test
pnpm check-types
pnpm --filter @astrum/customer build
```

Expected: lint reports no error, every suite passes, `tsc --noEmit` is clean across the five packages, and the build writes the route manifest with `/profile` inside it.
