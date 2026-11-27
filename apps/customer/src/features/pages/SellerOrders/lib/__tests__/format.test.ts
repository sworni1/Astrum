import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { browserTimeZone } from "@/features/pages/SellerOrders/lib/format";

const SRC_DIR = join(process.cwd(), "src");
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const TIME_ZONE_WINDOW = 400;
const NEWLINE = String.fromCharCode(10);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    const isSource =
      SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension)) &&
      !entry.name.includes(".test.");

    return isSource ? [path] : [];
  });

const CALENDAR_DAY_FILES = [
  "features/pages/Profile/actions/EditProfileForm/index.tsx",
];

const isCalendarDayField = (file: string): boolean =>
  CALENDAR_DAY_FILES.some((exempt) =>
    file.split(String.fromCharCode(92)).join("/").endsWith(exempt),
  );

const callsWithoutZone = (): string[] =>
  sourceFiles(SRC_DIR).flatMap((file) => {
    if (isCalendarDayField(file)) {
      return [];
    }

    const content = readFileSync(file, "utf8");
    const found: string[] = [];
    let index = content.indexOf("format.dateTime(");

    while (index !== -1) {
      const call = content.slice(index, index + TIME_ZONE_WINDOW);

      if (!call.includes("timeZone")) {
        const line = content.slice(0, index).split(NEWLINE).length;

        found.push(`${relative(SRC_DIR, file)}:${line}`);
      }

      index = content.indexOf("format.dateTime(", index + 1);
    }

    return found;
  });

describe("browserTimeZone", () => {
  it("returns the zone the browser reports, so the data pin cannot shift it (AC-9)", () => {
    expect(browserTimeZone()).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });

  it("is passed at every formatter call site, because the request config pins UTC (AC-9)", () => {
    expect(callsWithoutZone()).toEqual([]);
  });
});
