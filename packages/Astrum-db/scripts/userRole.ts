import "./loadEnv.js";
import { UserRole } from "../generated/prisma/enums.js";
import { prisma } from "../lib/index.js";

const KNOWN_ROLES = Object.values(UserRole);

class Refusal extends Error {}

const parseRole = (value: string | undefined): UserRole => {
  if (!value || !KNOWN_ROLES.includes(value as UserRole)) {
    throw new Refusal(
      `Unknown role ${value ?? "(missing)"}. Known roles: ${KNOWN_ROLES.join(", ")}.`,
    );
  }

  return value as UserRole;
};

const readUser = async (email: string) =>
  prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      roles: true,
      business: { select: { id: true } },
      pointWorker: { select: { pickupPointId: true } },
      courier: { select: { id: true } },
    },
  });

const requireUser = async (email: string) => {
  const user = await readUser(email);

  if (!user) {
    throw new Refusal(`No account uses the address ${email}.`);
  }

  return user;
};

type UserRow = Awaited<ReturnType<typeof requireUser>>;

const print = (user: UserRow): void => {
  console.log(`email: ${user.email}`);
  console.log(`roles: ${user.roles.length > 0 ? user.roles.join(", ") : "(none)"}`);
  console.log(
    `derived: seller=${user.business !== null} pointWorker=${user.pointWorker !== null} courier=${user.courier !== null}`,
  );
};

const grant = async (userId: string, role: UserRole): Promise<void> => {
  await prisma.user.updateMany({
    where: { id: userId, NOT: { roles: { has: role } } },
    data: { roles: { push: role } },
  });
};

const replace = async (userId: string, role: UserRole): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: { roles: [role] },
  });
};

const USAGE =
  "Usage: pnpm db:user-role <email> [--add <role> | --set <role>]";

const main = async (): Promise<void> => {
  const [email, flag, value] = process.argv.slice(2);

  if (!email) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  try {
    const user = await requireUser(email);

    if (flag === "--add") {
      await grant(user.id, parseRole(value));
    } else if (flag === "--set") {
      await replace(user.id, parseRole(value));
    } else if (flag !== undefined) {
      throw new Refusal(`Unknown option ${flag}.\n${USAGE}`);
    }

    print(flag === undefined ? user : await requireUser(email));
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
