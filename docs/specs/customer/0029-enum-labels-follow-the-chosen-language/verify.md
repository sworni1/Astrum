# 0029. Enum labels follow the chosen language — verify steps

Every step is written so a broken build prints something the reader can see. Run them in order against a running stack.

## Setup

```bash
cd /e/Astrum/Astrum
pnpm dev                       # Postgres, Redis, RabbitMQ, Mailpit, then the four services
PSQL="docker exec astrum-db psql -U $(docker exec astrum-db printenv POSTGRES_USER) -d $(docker exec astrum-db printenv POSTGRES_DB)"
```

The storefront answers on `http://localhost:3000`, the gateway on `http://localhost:3580`. Both catalogue paths are public since spec 0028, so no session is needed for any step below.

## 1. Both catalogs carry one key per enum member (AC-1, AC-10)

```bash
cd /e/Astrum/Astrum/apps/customer && node -e "
const en=require('./messages/en.json'), ru=require('./messages/ru.json');
for (const g of ['category','property'])
  console.log(g, 'en', Object.keys(en.enums[g]).length, 'ru', Object.keys(ru.enums[g]).length);
"
```

Expected exactly:

```
category en 10 ru 10
property en 27 ru 27
```

A missing `enums` section throws `TypeError: Cannot convert undefined or null to object`, which is the failure this step exists to show.

## 2. The coverage suite fails when a key is removed (AC-10)

This block mutates the Russian catalog and restores it in the same run, so the tree is clean afterwards.

```bash
cd /e/Astrum/Astrum
node -e "
const fs=require('fs'), f='apps/customer/messages/ru.json';
const d=JSON.parse(fs.readFileSync(f,'utf8'));
console.log('removed', d.enums.property.RAM);
delete d.enums.property.RAM;
fs.writeFileSync(f, JSON.stringify(d,null,2)+'\n');
"
pnpm --filter @astrum/customer test -- localizeHelper 2>&1 | tail -12
git checkout -- apps/customer/messages/ru.json
pnpm --filter @astrum/customer test -- localizeHelper 2>&1 | tail -12
```

The first run must print `removed RAM` and a failing assertion naming `RAM`. The second, after the restore, must print the suite passing. A first run that passes means the coverage test does not cover the property group, which is the defect this step catches.

The same block proves the schema direction, which is the one that has already drifted. This adds a member to the schema enum and restores the file from its own backup:

```bash
cd /e/Astrum/Astrum
node -e "
const fs=require('fs'), f='packages/Astrum-db/prisma/schema.prisma';
fs.writeFileSync(f+'.bak', fs.readFileSync(f));
const t=fs.readFileSync(f,'utf8').replace(/enum PropertyLabel \{\r?\n  Color/, 'enum PropertyLabel {\n  Subwoofer\n  Color');
fs.writeFileSync(f, t);
console.log('added Subwoofer to the schema enum');
"
pnpm --filter @astrum/customer test -- localizeHelper 2>&1 | tail -8
mv packages/Astrum-db/prisma/schema.prisma.bak packages/Astrum-db/prisma/schema.prisma
pnpm --filter @astrum/customer test -- localizeHelper 2>&1 | tail -8
```

The first run must print `added Subwoofer to the schema enum` and fail naming `Subwoofer`; the second must pass. A green first run means the suite compares only the client mirror to the catalogs, which is the gap this step exists to catch.

## 3. No English enum literal survives outside the enum file (AC-9)

```bash
cd /e/Astrum/Astrum
grep -rnE '"(Electronics|Fashion|Home|Food|Beauty|Books|Sports|Toys|Automotive|Office|Color|Size|Material|Brand|Weight|Dimensions|Warranty|EnergyEfficiency|StorageCapacity|OperatingSystem|Processor|GraphicsCard|ScreenSize|BatteryLife|Type|Power|Features|Control|NoiseLevel|PowerSource|Display|Capacity|Installation|Speed|Construction|RAM|Connectivity)"' apps/customer/src --include=*.ts --include=*.tsx | grep -v 'common/types/product.types.ts' | grep -v __tests__
```

Expected: no output. Any surviving line names a screen still hardcoding a label, which is what this step exists to find.

## 4. The strip shows ten translated tiles (AC-4, AC-5)

In a browser with the Russian language chosen, open `http://localhost:3000/categories`, the only screen that renders the strip:

- Count the links under the category section: ten.
- Their texts, in order: `Электроника, Мода, Дом, Еда, Красота, Книги, Спорт, Игрушки, Авто, Офис`.
- Open the two search menus (the desktop field and the mobile sheet): the category select lists the same ten texts plus the `Все` choice, which is the text `nav.allCategories` carries.

A nine item list, or a list holding `Office`, fails this step.

## 5. The category page prints the translated name (AC-6)

Open `http://localhost:3000/categories/electronics` and `http://localhost:3000/categories/office`. The heading reads `Электроника` and `Офис`. Open `http://localhost:3000/categories/nonsense`: the heading reads `Результаты`, the copy it carries today.

## 6. An empty category prints its own copy (AC-7)

Open `http://localhost:3000/categories/fashion`. The page prints `В этой категории пока нет товаров` and does not print `Больше товаров нет`. Scroll a stocked category to its end: that page still prints `Больше товаров нет`, which is the copy that keeps its meaning.

## 7. Property labels print translated, values stay as stored (AC-8)

Find a product that carries properties of at least two labels:

```bash
$PSQL -c "SELECT p.id, pp.label, pp.value FROM \"ProductProperty\" pp JOIN \"Product\" p ON p.id = pp.\"productId\" WHERE p.status='Published' AND pp.label IN ('Material','Color') LIMIT 6;"
```

Open `http://localhost:3000/products/<id>` in the Russian language and expand the specifications block. The label column reads `Материал` and `Цвет`, and the value column prints the stored string exactly as the query printed it (a value like `пластик` stays `пластик`). A value column showing a translated word means the build went past this spec and translated data.

## 8. The gateway resolves the slug from the enum (AC-11)

```bash
cd /e/Astrum/Astrum
curl -s "http://localhost:3580/api/products/categories/office" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('office items', (j.products??j.data??[]).length, 'nextCursor', j.nextCursor??null)})"
curl -s "http://localhost:3580/api/products/categories/electronics" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('electronics items', (j.products??j.data??[]).length, 'nextCursor', j.nextCursor??null)})"
grep -rn "productCategoryMap" apps/api-astrum/src
```

`office` answers the same page size as `electronics` with its own cursor, and the grep prints nothing, which is the proof the hand written table is gone. If the grep still prints the file, the deletion step of the build did not run.

## 9. The language switch repaints everything without a reload (AC-12)

With the categories page open in English, use the language switch in the navbar and choose Russian. Without reloading by hand:

- the strip turns to the ten Russian names and `Офис` is among them;
- open `/categories/electronics`: the heading is Russian;
- open one product: the property labels are Russian and the values are unchanged;
- switch back to English and every one of those reads English again.

A screen that keeps English after the switch fails this step, and the cause is a component holding the label outside the `enums` namespace or a label computed once at module load.

## 10. Gates

```bash
cd /e/Astrum/Astrum
pnpm --filter @astrum/customer lint
pnpm --filter @astrum/customer test
pnpm check-types
```

Expected: lint with zero errors, the customer suite green with its case count grown by the new coverage suite, and `check-types` green across every workspace.

## Observed on the running stack, 2026-11-19 (build self check, `/develop`)

The dev stack was already up (customer 3000, gateway 3580, the four containers healthy). Observed in a Chromium harness, Russian via the `NEXT_LOCALE=ru` cookie:

- `/categories` at 1440x900: heading `Покупки по категориям`, ten tiles in schema order, texts `Электроника, Мода, Дом, Еда, Красота, Книги, Спорт, Игрушки, Авто, Офис`, each href still the English slug (`/categories/office` last), grid `300px x 4` columns. Steps 4, 1.
- `/categories` at 390x844: ten tiles in one 358px column, ten rows, `scrollWidth` 390 with no horizontal overflow. Step 4.
- Both search menus list `Все` plus the same ten Russian names: the mobile sheet inside its dialog (11 visible options) and the desktop navbar select (11 visible options). Choosing `Офис` in the mobile sheet and pressing `Найти` landed on the Office page. Step 4.
- `/categories/office`: heading `Офис`, 16 cards. `/categories/office?search_query=ручка`: heading still `Офис`. Step 5.
- `/categories/fashion`: heading `Мода`, zero cards, prints `В этой категории пока нет товаров` and not `Больше товаров нет`. Step 6.
- `/products/00721e7d-7736-443b-bba3-3f9256cc88d8`: expanded `Характеристики` prints `Тип — чехол`, `Материал — материатый`, `Габариты — 95x102x150`, so the labels follow the catalog and the values stay as stored. Step 7.
- Switching back to English repaints the strip and the heading in English with the same ten tiles. Step 9, second half.

**Not observed:** the switcher repainting the page without a manual reload (step 9, first half). The Radix select behind the switcher refused synthetic pointer sequences (three attempts, `window` marker kept, no cookie write), so the locale was set through the same cookie the server action writes and the page reloaded by hand. The repaint itself is proven; the no reload path is not.

`/check verify` owns this walk; the gateway steps 2, 3 and 8 were run at build time and their output is in the build report.

