import type { PickupPoint } from "../generated/prisma/client";
import { prisma } from "../lib/index";

const MIN_ADDRESS_LENGTH = 5;

class Refusal extends Error {}

type Command = "add" | "list" | "on" | "off";

const USAGE = [
  'Usage: pnpm db:pickup-point add "<name>" "<address>"',
  "       pnpm db:pickup-point list",
  '       pnpm db:pickup-point on "<name>"',
  '       pnpm db:pickup-point off "<name>"',
].join("\n");

const readName = (value: string | undefined): string => {
  const name = value?.trim() ?? "";

  if (name.length === 0) {
    throw new Refusal("A point needs a name.");
  }

  return name;
};

const readAddress = (value: string | undefined): string => {
  const address = value?.trim() ?? "";

  if (address.length < MIN_ADDRESS_LENGTH) {
    throw new Refusal(
      `An address needs at least ${MIN_ADDRESS_LENGTH} characters.`,
    );
  }

  return address;
};

const describe = (point: PickupPoint): string =>
  `${point.id}  ${point.name}  ${point.address}  ${point.isActive ? "on" : "off"}`;

const addPoint = async (nameInput?: string, addressInput?: string) => {
  const name = readName(nameInput);
  const address = readAddress(addressInput);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.pickupPoint.findUnique({
      where: { name },
      select: { id: true },
    });

    if (existing) {
      throw new Refusal(
        `A pickup point named "${name}" already exists (${existing.id}). Switch it on instead of adding it again.`,
      );
    }

    return tx.pickupPoint.create({ data: { name, address } });
  });
};

const switchPoint = async (nameInput: string | undefined, isActive: boolean) => {
  const name = readName(nameInput);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.pickupPoint.findUnique({
      where: { name },
      select: { id: true },
    });

    if (!existing) {
      throw new Refusal(`No pickup point is named "${name}".`);
    }

    return tx.pickupPoint.update({
      where: { name },
      data: { isActive },
    });
  });
};

const run = async (command: Command, args: string[]): Promise<string> => {
  if (command === "list") {
    const points = await prisma.pickupPoint.findMany({
      orderBy: { name: "asc" },
    });

    return points.length === 0
      ? "No pickup points yet."
      : points.map(describe).join("\n");
  }

  if (command === "add") {
    return describe(await addPoint(args[0], args[1]));
  }

  return describe(await switchPoint(args[0], command === "on"));
};

const isCommand = (value: string | undefined): value is Command =>
  value === "add" || value === "list" || value === "on" || value === "off";

const main = async (): Promise<void> => {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (!isCommand(command)) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  try {
    console.log(await run(command, args));
  } catch (error) {
    if (error instanceof Refusal) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

await main();
