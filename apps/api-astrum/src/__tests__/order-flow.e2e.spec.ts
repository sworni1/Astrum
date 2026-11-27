import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";

const describeWithDatabase =
  process.env.ORDER_DB_TESTS === "1" ? describe : describe.skip;

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3580";

type AuthSession = { token: string; expiresIn: string };

type ProductJson = {
  id: string;
  quantity: number;
  price: number;
  currency: string;
};

type ShippingMethodsJson = {
  methods: Array<{ id: string; currency: string; isPickup: boolean }>;
};

type OrderLineJson = {
  productId: string;
  quantity: number;
  price: number;
  status: string;
};

type OrderJson = {
  id: string;
  status: string;
  totalPrice: number;
  deliveryPrice: number;
  grandTotal: number;
  orderItems: OrderLineJson[];
};

type OrderListJson = {
  items: Array<{ id: string; grandTotal: number }>;
  total: number;
};

const asJson = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

const postJson = async (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> =>
  await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describeWithDatabase("Order flow through the running gateway", () => {
  const stamp = `${Date.now()}`;
  const email = `e2e-order-${stamp}@example.com`;
  const password = "E2ePassword123";
  const businessId = `e2e-business-${stamp}`;
  const shippingName = `E2E delivery ${stamp}`;

  let userId = "";
  let productId = "";
  let shippingMethodId = "";

  beforeAll(async () => {
    const health = await fetch(`${BASE_URL}/health`).catch(() => null);

    if (!health?.ok) {
      throw new Error(
        `Start the gateway and auth services before this suite: ${BASE_URL}/health is not reachable`,
      );
    }

    await prisma.business.create({
      data: { id: businessId, name: `E2E shop ${stamp}` },
    });

    const product = await prisma.product.create({
      data: {
        businessId,
        name: `E2E drill ${stamp}`,
        quantity: 5,
        price: 19.99,
        currency: "RUB",
        category: "Home",
        previewImage: "http://cdn/e2e-order.png",
        images: [],
        visibility: "Public",
        status: "Published",
      },
    });

    productId = product.id;

    const shipping = await prisma.shippingMethod.create({
      data: {
        name: shippingName,
        price: 299,
        currency: "RUB",
        isActive: true,
        isPickup: false,
      },
    });

    shippingMethodId = shipping.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.orderItem.deleteMany({ where: { userId } });
      await prisma.order.deleteMany({ where: { userId } });
      await prisma.cartItem.deleteMany({ where: { userId } });
      await prisma.emailToken.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }

    if (productId) {
      await prisma.product.deleteMany({ where: { id: productId } });
    }

    if (businessId) {
      await prisma.business.deleteMany({ where: { id: businessId } });
    }

    if (shippingMethodId) {
      await prisma.shippingMethod.deleteMany({
        where: { id: shippingMethodId },
      });
    }

    await prisma.$disconnect();
  });

  it("проходит регистрацию, подтверждение, корзину и заказ через шлюз", async () => {
    const register = await postJson("/api/auth/register", {
      email,
      password,
      gender: "Male",
      dateOfBirth: "2000-01-01T00:00:00.000Z",
    });

    expect(register.status).toBe(200);

    const registration = await asJson<AuthSession>(register);

    expect(typeof registration.token).toBe("string");

    const pending = await prisma.user.findUniqueOrThrow({ where: { email } });

    expect(pending.status).toBe("PENDING");

    userId = pending.id;

    const rawToken = randomUUID();

    await prisma.emailToken.create({
      data: {
        userId,
        email,
        tokenHash: createHash("sha256").update(rawToken).digest("hex"),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const confirm = await fetch(
      `${BASE_URL}/api/auth/confirm?token=${encodeURIComponent(rawToken)}`,
      { redirect: "manual" },
    );

    expect(confirm.status).toBe(302);
    expect(confirm.headers.get("location") ?? "").toContain("status=ok");

    const active = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    expect(active.status).toBe("ACTIVE");

    const signin = await postJson("/api/auth/signin", { email, password });

    expect(signin.status).toBe(200);

    const session = await asJson<AuthSession>(signin);
    const cookie = `__auth=${session.token}`;

    const productResponse = await fetch(
      `${BASE_URL}/api/products/${productId}`,
      {
        headers: { Cookie: cookie },
      },
    );

    expect(productResponse.status).toBe(200);

    const product = await asJson<ProductJson>(productResponse);

    expect(product.id).toBe(productId);
    expect(product.quantity).toBe(5);

    const cartResponse = await fetch(`${BASE_URL}/api/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ productId }),
    });

    expect(cartResponse.status).toBe(200);
    expect((await asJson<{ quantity: number }>(cartResponse)).quantity).toBe(1);

    const shippingResponse = await fetch(`${BASE_URL}/api/shipping-methods`, {
      headers: { Cookie: cookie },
    });

    expect(shippingResponse.status).toBe(200);

    const shipping = await asJson<ShippingMethodsJson>(shippingResponse);
    const method = shipping.methods.find(
      (entry) => entry.id === shippingMethodId,
    );

    expect(method?.isPickup).toBe(false);
    expect(method?.currency).toBe("RUB");

    const orderResponse = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "Idempotency-Key": `e2e-order-${stamp}`,
      },
      body: JSON.stringify({
        deliveryAddress: "Ленина 1",
        deliveryDate: "2026-12-01T12:00:00.000Z",
        shippingMethodId,
        paymentMethod: "CASH",
        orderItems: [{ productId, quantity: 1 }],
      }),
    });

    expect(orderResponse.status).toBe(201);

    const order = await asJson<OrderJson>(orderResponse);
    const [line] = order.orderItems;

    expect(order.status).toBe("CONFIRMED");
    expect(order.totalPrice).toBe(19.99);
    expect(order.deliveryPrice).toBe(299);
    expect(order.grandTotal).toBe(318.99);
    expect(order.orderItems).toHaveLength(1);
    expect(line?.productId).toBe(productId);
    expect(line?.quantity).toBe(1);
    expect(line?.price).toBe(19.99);

    const listResponse = await fetch(`${BASE_URL}/api/orders`, {
      headers: { Cookie: cookie },
    });

    expect(listResponse.status).toBe(200);

    const list = await asJson<OrderListJson>(listResponse);

    expect(list.items.some((item) => item.id === order.id)).toBe(true);

    const detailResponse = await fetch(`${BASE_URL}/api/orders/${order.id}`, {
      headers: { Cookie: cookie },
    });

    expect(detailResponse.status).toBe(200);
    expect((await asJson<OrderJson>(detailResponse)).grandTotal).toBe(318.99);

    const stored = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });

    expect(stored.quantity).toBe(4);

    const emptyCart = await fetch(`${BASE_URL}/api/cart`, {
      headers: { Cookie: cookie },
    });

    expect(emptyCart.status).toBe(200);
    expect(await asJson<unknown[]>(emptyCart)).toEqual([]);
  }, 60_000);
});
