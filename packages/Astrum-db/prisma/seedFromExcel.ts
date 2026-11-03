import { randomUUID } from "crypto";
import { readdirSync } from "fs";
import { join } from "path";
import XLSX from "xlsx";
import { prisma } from "../lib/prisma";

const PRODUCTS_PER_FILE = 500;
const CANDIDATES_PER_FILE = 2000;
const PRODUCT_BATCH = 100;
const URL_CONCURRENCY = 100;
const URL_TIMEOUT_MS = 2000;
const PLACEHOLDER_IMAGE = "https://placehold.co/400x300?text=No+Image";

const CATEGORY_MAP: Record<string, string> = {
  "Детские товары и игрушки": "Toys",
  "Инструмент и садовая техника": "Home",
  "Офис и канцелярия": "Office",
  "Компьютерная техника": "Electronics",
  "Крупная бытовая техника": "Home",
  "Мелкая бытовая техника": "Home",
  "Мобильные и связь": "Electronics",
  "Дом и ремонт": "Home",
  "ТВ и видеотехника": "Electronics",
  "Авто и мото": "Automotive",
};

const PROPERTY_EXACT: Record<string, string> = {
  Цвет: "Color",
  Размер: "Size",
  Гарантия: "Warranty",
  "Класс энергопотребления": "EnergyEfficiency",
  "Встроенная память": "StorageCapacity",
  "Емкость накопителя": "StorageCapacity",
  "Тип накопителя": "StorageCapacity",
  "Предустановленная ОС": "OperatingSystem",
  "Операционная система": "OperatingSystem",
  "Модель процессора": "Processor",
  "Серия процессора": "Processor",
  "Частота процессора": "Processor",
  "Объем видеопамяти": "GraphicsCard",
  "Графический процессор": "GraphicsCard",
  "Емкость аккумулятора": "BatteryLife",
  "Емкость батареи": "BatteryLife",
  "Напряжение батареи": "BatteryLife",
  "Тип аккумулятора": "BatteryLife",
  Тип: "Type",
  "Тип устройства": "Type",
  Устройство: "Type",
  Мощность: "Power",
  "Мощность (Вт)": "Power",
  "Потребляемая мощность": "Power",
  "Мощность подключения": "Power",
  "Максимальные обороты": "Power",
  Функции: "Features",
  "Функции и возможности": "Features",
  Дополнительно: "Features",
  Комплектация: "Features",
  Насадки: "Features",
  Управление: "Control",
  "Уровень шума": "NoiseLevel",
  "Источник питания": "PowerSource",
  Питание: "PowerSource",
  Объем: "Capacity",
  "Объем двигателя": "Capacity",
  "Емкость чаши": "Capacity",
  Установка: "Installation",
  "Тип монтажа": "Installation",
  "Количество скоростей": "Speed",
  "Скорость цепи": "Speed",
  "Частота смены кадров": "Speed",
  Конструкция: "Construction",
  "Оперативная память": "RAM",
  "Тип памяти": "RAM",
  "Частота памяти": "RAM",
  Коммуникации: "Connectivity",
  "Wi-Fi": "Connectivity",
  HDMI: "Connectivity",
  "LAN (RJ-45)": "Connectivity",
  Bluetooth: "Connectivity",
  "Порты подключения": "Connectivity",
  Назначение: "Type",
  "Принцип работы": "Type",
  Сезон: "Type",
};

const PROPERTY_KEYWORD: [string, string][] = [
  ["Материал", "Material"],
  ["Габариты", "Dimensions"],
  ["Размеры", "Dimensions"],
  ["Вес", "Weight"],
  ["Диагональ", "ScreenSize"],
  ["Дисплей", "Display"],
  ["Разрешение", "Display"],
  ["Покрытие экрана", "Display"],
  ["Видеокарт", "GraphicsCard"],
  ["процессор", "Processor"],
  ["USB", "Connectivity"],
  ["Thunderbolt", "Connectivity"],
  ["Мощность", "Power"],
];

function mapPropertyLabel(ruLabel: string): string | null {
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
  return isNaN(num) || num <= 0 ? null : num;
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

function parseHtmlProperties(html: string): { label: string; value: string }[] {
  if (!html) return [];
  const results: { label: string; value: string }[] = [];
  const seen = new Set<string>();

  const regex = /<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
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

interface ProductRecord {
  id: string;
  businessId: string;
  name: string;
  quantity: number;
  description: string | null;
  price: number;
  discount: number | null;
  stars: number;
  popularity: number;
  category: string;
  subcategory: string | null;
  currency: string;
  isDeleted: boolean;
  isOutOfStock: boolean;
  visibility: string;
  status: string;
  images: string[];
  previewImage: string;
  sales: number;
  views: number;
}

interface PropertyRecord {
  id: string;
  label: string;
  value: string;
  productId: string;
}

const BUSINESS_IDS = Array.from({ length: 20 }, (_, i) => `biz_excel_${i + 1}`);

function pickBusinessId(index: number): string {
  return BUSINESS_IDS[index % BUSINESS_IDS.length];
}

async function flushProducts(products: ProductRecord[]) {
  if (products.length === 0) return;
  await prisma.product.createMany({ data: products as any[] });
}

async function flushProperties(properties: PropertyRecord[]) {
  if (properties.length === 0) return;
  await prisma.productProperty.createMany({ data: properties as any[] });
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
      const sku = String(row["Артикул"] ?? "").trim();
      if (!sku) continue;

      const modSku = String(row["Артикул модификации"] ?? "").trim();

      if (!grouped.has(sku)) {
        grouped.set(sku, { base: null, firstColor: null });
      }

      const group = grouped.get(sku)!;
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
      if (!parsePrice(row["Цена"])) continue;
      if (!String(row["Имя товара"] ?? "").trim()) continue;
      const ruCat = String(row["Категория"] ?? "").trim();
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
      const price = parsePrice(row["Цена"])!;
      const name = String(row["Имя товара"]).trim();
      const category = CATEGORY_MAP[String(row["Категория"]).trim()];

      const aliveUrls = rawUrls.filter((u) => aliveSet.has(u));
      const imageUrls = aliveUrls.length > 0 ? aliveUrls : [PLACEHOLDER_IMAGE];

      const rawDesc = String(row["Описание"] ?? "");
      const stars = extractStars(rawDesc);
      const description = cleanDescription(rawDesc) || null;
      const quantity = Math.max(
        0,
        parseInt(String(row["Количество"] ?? "0"), 10) || 0,
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
        currency: "RUB",
        isDeleted: false,
        isOutOfStock: quantity === 0,
        visibility: "Public",
        status: "Published",
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

      const brand = String(row["Производитель"] ?? "").trim();
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
