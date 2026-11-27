import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

const problems = [];

const prismaCli = pkg.devDependencies?.prisma;
const prismaRuntime = pkg.dependencies?.["@prisma/client"];
console.log(
  `[astrum-db] prisma ${prismaCli} / @prisma/client ${prismaRuntime}`,
);
if (prismaCli !== prismaRuntime) {
  problems.push(`prisma ${prismaCli} is not @prisma/client ${prismaRuntime}`);
}

const targets = [];
for (const [name, entry] of Object.entries(pkg.exports ?? {})) {
  for (const field of ["types", "default"]) {
    if (!entry[field]) {
      problems.push(`exports["${name}"] carries no ${field}`);
      continue;
    }
    targets.push(entry[field]);
    if (!existsSync(join(packageRoot, entry[field]))) {
      problems.push(`exports["${name}"].${field} is missing: ${entry[field]}`);
    }
  }
}
console.log(`[astrum-db] checked ${targets.length} export targets`);
for (const target of targets)
  console.log(
    `  ${existsSync(join(packageRoot, target)) ? "ok  " : "miss"} ${target}`,
  );

const dist = join(packageRoot, "dist");
if (!existsSync(dist)) {
  problems.push("dist is missing, run pnpm build");
} else {
  const hashFile = join(dist, ".schema-hash");
  const schema = readFileSync(join(packageRoot, "prisma", "schema.prisma"));
  const expected = createHash("md5").update(schema).digest("hex");
  const actual = existsSync(hashFile)
    ? readFileSync(hashFile, "utf8").trim()
    : "";
  console.log(`[astrum-db] schema md5 ${expected} / dist ${actual || "none"}`);
  if (actual !== expected) {
    problems.push(
      "dist/.schema-hash does not match prisma/schema.prisma, run pnpm build",
    );
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`[astrum-db] ${problem}`);
  process.exit(1);
}

console.log("[astrum-db] build is current");
