import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import en from "@messages/en.json";
import ru from "@messages/ru.json";
import { describe, expect, it } from "vitest";
import {
  categoryFromSlug,
  categoryLabelKey,
  categorySlug,
  isPropertyLabel,
  propertyLabelKey,
} from "@/common/helpers/localizeHelper";
import { ProductCategory, PropertyLabel } from "@/common/types/product.types";

const SCHEMA_PATH = resolve(
  process.cwd(),
  "../../packages/Astrum-db/prisma/schema.prisma",
);

const readSchema = (): string => {
  try {
    return readFileSync(SCHEMA_PATH, "utf8");
  } catch {
    throw new Error(`schema not found at ${SCHEMA_PATH}`);
  }
};

const schemaMembers = (schema: string, name: string): string[] => {
  const block = schema.match(new RegExp(`enum ${name} \\{([^}]*)\\}`));

  if (!block) {
    throw new Error(`enum ${name} not found in ${SCHEMA_PATH}`);
  }

  return block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//"));
};

type EnumCatalog = Record<string, string>;

const catalogEnums = (catalog: typeof en) =>
  catalog.enums as { category: EnumCatalog; property: EnumCatalog };

const schema = readSchema();
const schemaCategories = schemaMembers(schema, "ProductCategory");
const schemaLabels = schemaMembers(schema, "PropertyLabel");
const clientCategories = Object.values(ProductCategory);
const clientLabels = Object.values(PropertyLabel);
const enEnums = catalogEnums(en);
const ruEnums = catalogEnums(ru);

describe("enum coverage", () => {
  it("mirrors every schema member in the client enums, in schema order", () => {
    expect(clientCategories).toEqual(schemaCategories);
    expect(clientLabels).toEqual(schemaLabels);
  });

  it("carries exactly one catalog key per schema member, in both languages", () => {
    expect(Object.keys(enEnums.category)).toEqual(schemaCategories);
    expect(Object.keys(ruEnums.category)).toEqual(schemaCategories);
    expect(Object.keys(enEnums.property)).toEqual(schemaLabels);
    expect(Object.keys(ruEnums.property)).toEqual(schemaLabels);
  });

  it("gives every catalog key a non empty string in both languages", () => {
    for (const enums of [enEnums, ruEnums]) {
      for (const [key, value] of [
        ...Object.entries(enums.category),
        ...Object.entries(enums.property),
      ]) {
        expect(typeof value, key).toBe("string");
        expect(value.trim(), key).not.toBe("");
      }
    }
  });
});

describe("localizeHelper", () => {
  it("names a category through its catalog key", () => {
    for (const category of schemaCategories as ProductCategory[]) {
      expect(categoryLabelKey(category)).toBe(`category.${category}`);
    }
  });

  it("names a property label through its catalog key", () => {
    for (const label of schemaLabels as PropertyLabel[]) {
      expect(propertyLabelKey(label)).toBe(`property.${label}`);
    }
  });

  it("reads a category slug as the lower case member name", () => {
    expect(categorySlug(ProductCategory.Office)).toBe("office");
    expect(categorySlug(ProductCategory.Automotive)).toBe("automotive");
  });

  it("resolves a slug back to its member, whatever the case", () => {
    expect(categoryFromSlug("office")).toBe(ProductCategory.Office);
    expect(categoryFromSlug("Office")).toBe(ProductCategory.Office);
    expect(categoryFromSlug("electronics")).toBe(ProductCategory.Electronics);
    expect(categoryFromSlug("nonsense")).toBeNull();
    expect(categoryFromSlug("")).toBeNull();
  });

  it("recognises every mirrored property label", () => {
    for (const label of schemaLabels) {
      expect(isPropertyLabel(label)).toBe(true);
    }
  });

  it("refuses a label the mirror does not know, so the row prints the payload value (AC-8)", () => {
    expect(isPropertyLabel("NonExistingLabel")).toBe(false);
    expect(isPropertyLabel("Office")).toBe(false);
    expect(isPropertyLabel("")).toBe(false);
  });
});
