import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const schema = readFileSync(join(packageRoot, "prisma", "schema.prisma"));
const hash = createHash("md5").update(schema).digest("hex");
const dist = join(packageRoot, "dist");

mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, ".schema-hash"), `${hash}\n`);

console.log(`[astrum-db] schema md5 ${hash}`);
