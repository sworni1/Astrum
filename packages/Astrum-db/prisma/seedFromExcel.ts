import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import XLSX from "xlsx";
import {
  Currency,
  type Prisma,
  ProductCategory,
  ProductStatus,
  ProductVisibility,
  PropertyLabel,
} from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

const PRODUCTS_PER_FILE = 500;
const CANDIDATES_PER_FILE = 2000;
const PRODUCT_BATCH = 100;
const URL_CONCURRENCY = 100;
const URL_TIMEOUT_MS = 2000;
const PLACEHOLDER_IMAGE = "https://placehold.co/400x300?text=No+Image";

const CATEGORY_MAP: Record<string, ProductCategory> = {
  "Детские товары и игрушки": ProductCategory.Toys,
  "Инструмент и садовая техника": ProductCategory.Home,
  "Офис и канцелярия": ProductCategory.Office,
  "Компьютерная техника": ProductCategory.Electronics,
  "Крупная бытовая техника": ProductCategory.Home,
  "Мелкая бытовая техника": ProductCategory.Home,
  "Мобильные и связь": ProductCategory.Electronics,
  "Дом и ремонт": ProductCategory.Home,
  "ТВ и видеотехника": ProductCategory.Electronics,
  "Авто и мото": ProductCategory.Automotive,
};

const PROPERTY_EXACT: Record<string, PropertyLabel> = {
  Цвет: PropertyLabel.Color,
  Размер: PropertyLabel.Size,
  Гарантия: PropertyLabel.Warranty,
  "Класс энергопотребления": PropertyLabel.EnergyEfficiency,
  "Встроенная память": PropertyLabel.StorageCapacity,
  "Емкость накопителя": PropertyLabel.StorageCapacity,
  "Тип накопителя": PropertyLabel.StorageCapacity,
  "Предустановленная ОС": PropertyLabel.OperatingSystem,
  "Операционная система": PropertyLabel.OperatingSystem,
  "Модель процессора": PropertyLabel.Processor,
  "Серия процессора": PropertyLabel.Processor,
  "Частота процессора": PropertyLabel.Processor,
  "Объем видеопамяти": PropertyLabel.GraphicsCard,
  "Графический процессор": PropertyLabel.GraphicsCard,
  "Емкость аккумулятора": PropertyLabel.BatteryLife,
  "Емкость батареи": PropertyLabel.BatteryLife,
  "Напряжение батареи": PropertyLabel.BatteryLife,
  "Тип аккумулятора": PropertyLabel.BatteryLife,
  Тип: PropertyLabel.Type,
  "Тип устройства": PropertyLabel.Type,
  Устройство: PropertyLabel.Type,
  Мощность: PropertyLabel.Power,
  "Мощность (Вт)": PropertyLabel.Power,
  "Потребляемая мощность": PropertyLabel.Power,
  "Мощность подключения": PropertyLabel.Power,
  "Максимальные обороты": PropertyLabel.Power,
  Функции: PropertyLabel.Features,
  "Функции и возможности": PropertyLabel.Features,
  Дополнительно: PropertyLabel.Features,
  Комплектация: PropertyLabel.Features,
  Насадки: PropertyLabel.Features,
  Управление: PropertyLabel.Control,
  "Уровень шума": PropertyLabel.NoiseLevel,
  "Источник питания": PropertyLabel.PowerSource,
  Питание: PropertyLabel.PowerSource,
  Объем: PropertyLabel.Capacity,
  "Объем двигателя": PropertyLabel.Capacity,
  "Емкость чаши": PropertyLabel.Capacity,
  Установка: PropertyLabel.Installation,
  "Тип монтажа": PropertyLabel.Installation,
  "Количество скоростей": PropertyLabel.Speed,
  "Скорость цепи": PropertyLabel.Speed,
  "Частота смены кадров": PropertyLabel.Speed,
  Конструкция: PropertyLabel.Construction,
  "Оперативная память": PropertyLabel.RAM,
  "Тип памяти": PropertyLabel.RAM,
  "Частота памяти": PropertyLabel.RAM,
  Коммуникации: PropertyLabel.Connectivity,
  "Wi-Fi": PropertyLabel.Connectivity,
  HDMI: PropertyLabel.Connectivity,
  "LAN (RJ-45)": PropertyLabel.Connectivity,
  Bluetooth: PropertyLabel.Connectivity,
  "Порты подключения": PropertyLabel.Connectivity,
  Назначение: PropertyLabel.Type,
  "Принцип работы": PropertyLabel.Type,
  Сезон: PropertyLabel.Type,
};

const PROPERTY_KEYWORD: [string, PropertyLabel][] = [
  ["Материал", PropertyLabel.Material],
  ["Габариты", PropertyLabel.Dimensions],
  ["Размеры", PropertyLabel.Dimensions],
  ["Вес", PropertyLabel.Weight],
  ["Диагональ", PropertyLabel.ScreenSize],
  ["Дисплей", PropertyLabel.Display],
  ["Разрешение", PropertyLabel.Display],
  ["Покрытие экрана", PropertyLabel.Display],
  ["Видеокарт", PropertyLabel.GraphicsCard],
  ["процессор", PropertyLabel.Processor],
  ["USB", PropertyLabel.Connectivity],
  ["Thunderbolt", PropertyLabel.Connectivity],
  ["Мощность", PropertyLabel.Power],
];

function mapPropertyLabel(ruLabel: string): PropertyLabel | null {
  const exact = PROPERTY_EXACT[ruLabel];
  if (exact) return exact;

  for (const [keyword, label] of PROPERTY_KEYWORD) {
    if (ruLabel.includes(keyword)) return label;
  }

  return null;
}

function parsePrice(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const cleaned = String(raw).replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) || num <= 0 ? null : num;
}

function extractStars(desc: string): number {
  const match = desc.match(/property=['"]v:value['"]>(\d+(?:\.\d+)?)<\/span>/i);
  if (match) return Math.min(5, Math.max(0, parseFloat(match[1])));
  return 0;
}

function cleanDescription(desc: string): string {
  if (!desc) return "";
  let cleaned = desc.replace(/<div\s+rel="v:rating"[\s\S]*?<\/div>/gi, "");
  cleaned = cleaned.replace(/<[^>]+>/g, "");
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return cleaned.trim();
}

function parseHtmlProperties(
  html: string,
): { label: PropertyLabel; value: string }[] {
  if (!html) return [];
  const results: { label: PropertyLabel; value: string }[] = [];
  const seen = new Set<string>();

  const regex = /<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/gi;
  let match: RegExpExecArray | null;
  while (true) {
    match = regex.exec(html);
    if (match === null) break;

    const ruLabel = match[1].trim();
    const value = match[2].trim();
    if (!ruLabel || !value) continue;

    const enumLabel = mapPropertyLabel(ruLabel);
    if (!enumLabel) continue;
    if (seen.has(enumLabel)) continue;
    seen.add(enumLabel);

    results.push({ label: enumLabel, value });
  }

  return results;
}

function extractImageUrls(raw: unknown): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/\s+/)
    .filter((url) => url.startsWith("http"))
    .slice(0, 10);
}

async function isUrlAlive(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), URL_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function checkUrlsBatch(urls: string[]): Promise<Set<string>> {
  const alive = new Set<string>();
  for (let i = 0; i < urls.length; i += URL_CONCURRENCY) {
    const batch = urls.slice(i, i + URL_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (url) => ({ url, ok: await isUrlAlive(url) })),
    );
    for (const r of results) {
      if (r.ok) alive.add(r.url);
    }
    if (i % 500 === 0 && i > 0) {
      process.stdout.write(
        `\r  Checking URLs: ${i}/${urls.length} (alive: ${alive.size})`,
      );
    }
  }
  return alive;
}

interface ExcelRow {
  Категория: string;
  "Подкатегория 2"?: string;
  "Подкатегория 3"?: string;
  Артикул: string | number;
  "Артикул модификации"?: string | number;
  "Имя товара": string;
  Цена: string | number;
  "Цена старая"?: string | number;
  Количество: string | number;
  Описание?: string;
  Производитель?: string;
  "Ссылки на фото (через пробел)"?: string;
  "Характеристики (HTML/Table)"?: string;
  "Опция:Цвет"?: string;
  [key: string]: unknown;
}

type ProductRecord = Prisma.ProductCreateManyInput;
type PropertyRecord = Prisma.ProductPropertyCreateManyInput;

const BUSINESS_IDS = Array.from({ length: 20 }, (_, i) => `biz_excel_${i + 1}`);

function pickBusinessId(index: number): string {
  return BUSINESS_IDS[index % BUSINESS_IDS.length];
}

async function flushProducts(products: ProductRecord[]) {
  if (products.length === 0) return;
  await prisma.product.createMany({ data: products });
}

async function flushProperties(properties: PropertyRecord[]) {
  if (properties.length === 0) return;
  await prisma.productProperty.createMany({ data: properties });
}

async function main() {
  const dir = join(import.meta.dirname, "..", "Бесплатная база товаров 2018");
  const files = readdirSync(dir).filter((f) => f.endsWith(".xlsx"));

  console.log(`Found ${files.length} Excel files`);
  console.log("Clearing existing products and properties...");

  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "ProductProperty", "Impression", "Product" CASCADE',
  );

  let totalInserted = 0;
  let totalProperties = 0;
  const totalSkipped = 0;
  let globalIndex = 0;

  for (const file of files) {
    console.log(`\nProcessing: ${file}`);
    const wb = XLSX.readFile(join(dir, file));
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(
      wb.Sheets[wb.SheetNames[0]],
    );
    console.log(`  Total rows: ${rows.length}`);

    const grouped = new Map<
      string,
      { base: ExcelRow | null; firstColor: string | null }
    >();

    for (const row of rows) {
      const sku = String(row.Артикул ?? "").trim();
      if (!sku) continue;

      const modSku = String(row["Артикул модификации"] ?? "").trim();

      if (!grouped.has(sku)) {
        grouped.set(sku, { base: null, firstColor: null });
      }

      const group = grouped.get(sku);
      if (!group) continue;
      if (!modSku) {
        group.base = row;
      } else if (!group.firstColor) {
        const color = row["Опция:Цвет"];
        if (color && String(color).trim()) {
          group.firstColor = String(color).trim();
        }
      }
    }

    rows.length = 0;

    interface PendingProduct {
      group: { base: ExcelRow; firstColor: string | null };
      rawUrls: string[];
    }

    const allCandidates: PendingProduct[] = [];
    const allUrls: string[] = [];

    const shuffledEntries = [...grouped.values()].sort(
      () => Math.random() - 0.5,
    );

    for (const group of shuffledEntries) {
      if (allCandidates.length >= CANDIDATES_PER_FILE) break;
      const row = group.base;
      if (!row) continue;
      if (!parsePrice(row.Цена)) continue;
      if (!String(row["Имя товара"] ?? "").trim()) continue;
      const ruCat = String(row.Категория ?? "").trim();
      if (!CATEGORY_MAP[ruCat]) continue;

      const rawUrls = extractImageUrls(row["Ссылки на фото (через пробел)"]);
      allUrls.push(...rawUrls);
      allCandidates.push({
        group: group as { base: ExcelRow; firstColor: string | null },
        rawUrls,
      });
    }

    console.log(
      `  Candidates: ${allCandidates.length}/${shuffledEntries.length}, URLs to check: ${allUrls.length}`,
    );
    const aliveSet = await checkUrlsBatch(allUrls);
    console.log(`\n  Alive URLs: ${aliveSet.size}/${allUrls.length}`);

    const withImages: PendingProduct[] = [];
    const withoutImages: PendingProduct[] = [];

    for (const candidate of allCandidates) {
      const hasAlive = candidate.rawUrls.some((u) => aliveSet.has(u));
      if (hasAlive) {
        withImages.push(candidate);
      } else {
        withoutImages.push(candidate);
      }
    }

    const selected = [
      ...withImages.slice(0, PRODUCTS_PER_FILE),
      ...withoutImages.slice(
        0,
        Math.max(0, PRODUCTS_PER_FILE - withImages.length),
      ),
    ];
    console.log(
      `  Selected: ${selected.length} (${Math.min(withImages.length, PRODUCTS_PER_FILE)} with images, ${selected.length - Math.min(withImages.length, PRODUCTS_PER_FILE)} placeholder)`,
    );

    let productBatch: ProductRecord[] = [];
    let propertyBatch: PropertyRecord[] = [];
    let fileInserted = 0;

    for (const { group, rawUrls } of selected) {
      const row = group.base;
      const price = parsePrice(row.Цена);
      if (price === null) continue;
      const name = String(row["Имя товара"]).trim();
      const category = CATEGORY_MAP[String(row.Категория).trim()];

      const aliveUrls = rawUrls.filter((u) => aliveSet.has(u));
      const imageUrls = aliveUrls.length > 0 ? aliveUrls : [PLACEHOLDER_IMAGE];

      const rawDesc = String(row.Описание ?? "");
      const stars = extractStars(rawDesc);
      const description = cleanDescription(rawDesc) || null;
      const quantity = Math.max(
        0,
        parseInt(String(row.Количество ?? "0"), 10) || 0,
      );

      const oldPrice = parsePrice(row["Цена старая"]);
      let discount: number | null = null;
      if (oldPrice && oldPrice > price) {
        discount = Math.round(((oldPrice - price) / oldPrice) * 100) / 100;
      }

      const sub2 = row["Подкатегория 2"]
        ? String(row["Подкатегория 2"]).trim()
        : null;
      const sub3 = row["Подкатегория 3"]
        ? String(row["Подкатегория 3"]).trim()
        : null;
      const subcategory = sub3 || sub2 || null;

      const productId = randomUUID();

      productBatch.push({
        id: productId,
        businessId: pickBusinessId(globalIndex),
        name,
        quantity,
        description,
        price,
        discount,
        stars,
        popularity: Math.round(stars * quantity * 0.5 * 100) / 100,
        category,
        subcategory,
        currency: Currency.RUB,
        isDeleted: false,
        isOutOfStock: quantity === 0,
        visibility: ProductVisibility.Public,
        status: ProductStatus.Published,
        images: imageUrls,
        previewImage: imageUrls[0],
        sales: 0,
        views: 0,
      });
      globalIndex++;

      const htmlProps = parseHtmlProperties(
        row["Характеристики (HTML/Table)"] as string,
      );
      const seenLabels = new Set(htmlProps.map((p) => p.label));

      for (const prop of htmlProps) {
        propertyBatch.push({
          id: randomUUID(),
          label: prop.label,
          value: prop.value,
          productId,
        });
      }

      const brand = String(row.Производитель ?? "").trim();
      if (brand && !seenLabels.has("Brand")) {
        propertyBatch.push({
          id: randomUUID(),
          label: "Brand",
          value: brand,
          productId,
        });
      }

      if (group.firstColor && !seenLabels.has("Color")) {
        propertyBatch.push({
          id: randomUUID(),
          label: "Color",
          value: group.firstColor,
          productId,
        });
      }

      if (productBatch.length >= PRODUCT_BATCH) {
        await flushProducts(productBatch);
        await flushProperties(propertyBatch);
        fileInserted += productBatch.length;
        totalProperties += propertyBatch.length;
        productBatch = [];
        propertyBatch = [];
      }
    }

    if (productBatch.length > 0) {
      await flushProducts(productBatch);
      await flushProperties(propertyBatch);
      fileInserted += productBatch.length;
      totalProperties += propertyBatch.length;
      productBatch = [];
      propertyBatch = [];
    }

    grouped.clear();
    totalInserted += fileInserted;
    console.log(
      `  Inserted: ${fileInserted} products (total: ${totalInserted})`,
    );
  }

  console.log("\n=== SEED COMPLETE ===");
  console.log(`Products: ${totalInserted}`);
  console.log(`Properties: ${totalProperties}`);
  console.log(`Skipped: ${totalSkipped}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
