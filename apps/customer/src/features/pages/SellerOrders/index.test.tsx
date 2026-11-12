import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getData, patchItem } = vi.hoisted(() => ({
  getData: vi.fn(),
  patchItem: vi.fn(),
}));

vi.mock("@/hooks/useFetcher", () => ({
  useFetcher: () => ({
    fetcher: {},
    getData,
    deleteItem: vi.fn(),
    patchItem,
    postItem: vi.fn(),
    putItem: vi.fn(),
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
  useFormatter: () => ({
    dateTime: () => "2026-11-08",
    number: (value: number) => String(value),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    unoptimized,
  }: {
    alt: string;
    src: string;
    unoptimized?: boolean;
  }) => (
    <span
      data-alt={alt}
      data-src={src}
      data-unoptimized={String(unoptimized ?? false)}
    />
  ),
}));

import SellerOrders from ".";

let container: HTMLDivElement;
let root: Root;

const profile = {
  email: "seller@example.com",
  nickName: "seller",
  gender: "MALE",
  dateOfBirth: "2000-01-01T00:00:00.000Z",
  status: "ACTIVE",
  isSeller: true,
};

const orderLine = {
  id: "line-1",
  productId: "product-1",
  name: "Kettle",
  previewImage: "",
  quantity: 2,
  price: 9.99,
  currency: "RUB",
  status: "PENDING",
};

const page = {
  orders: [
    {
      id: "order-12345678",
      createdAt: "2026-11-08T10:00:00.000Z",
      orderItems: [orderLine],
    },
  ],
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
};

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const renderPage = async (): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <SellerOrders />
      </SWRConfig>,
    );
  });
  await flush();
};

const withProfile =
  (currentProfile: unknown) =>
  (url: string): unknown =>
    url === "/users/me" ? Promise.resolve(currentProfile) : undefined;

const listResolves = (
  answer: unknown,
  currentProfile: unknown = profile,
): void => {
  const profileAnswer = withProfile(currentProfile);
  getData.mockImplementation(
    (url: string) => profileAnswer(url) ?? Promise.resolve(answer),
  );
};

const listRejects = (
  answer: unknown,
  currentProfile: unknown = profile,
): void => {
  const profileAnswer = withProfile(currentProfile);
  getData.mockImplementation(
    (url: string) => profileAnswer(url) ?? Promise.reject(answer),
  );
};

const refuseWith = (status: number, code: string): void => {
  listRejects({ isAxiosError: true, response: { status, data: { code } } });
};

type Deferred = {
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
};

const deferred = (): Deferred => {
  let resolve: (value: unknown) => void = () => undefined;
  const promise = new Promise<unknown>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
};

const routes = (
  answers: Record<string, unknown>,
  currentProfile: unknown = profile,
): void => {
  getData.mockImplementation((url: string) => {
    if (url === "/users/me") {
      return Promise.resolve(currentProfile);
    }

    if (!(url in answers)) {
      return Promise.reject(new Error(`unexpected ${url}`));
    }

    return Promise.resolve(answers[url]);
  });
};

const button = (label: string): HTMLButtonElement => {
  const found = Array.from(container.querySelectorAll("button")).find(
    (node) => node.textContent === label,
  );

  if (!found) {
    throw new Error(`no button named ${label}`);
  }

  return found;
};

const buttonInDom = (label: string): HTMLButtonElement => {
  const found = Array.from(document.querySelectorAll("button")).find(
    (node) => node.textContent === label,
  );

  if (!found) {
    throw new Error(`no button named ${label} in the document`);
  }

  return found;
};

const text = (): string => container.textContent ?? "";

describe("SellerOrders page states", () => {
  beforeEach(() => {
    getData.mockReset();
    patchItem.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("shows the skeleton on the first load (AC-11)", async () => {
    listResolves(new Promise(() => undefined));

    await renderPage();

    expect(
      container.querySelector('[aria-label="states.loadingLabel"]'),
    ).not.toBeNull();
  });

  it("shows the empty state when the shop has no lines (AC-11)", async () => {
    listResolves({ orders: [], page: 1, limit: 20, total: 0, totalPages: 0 });

    await renderPage();

    expect(text()).toContain("states.emptyTitle");
    expect(text()).not.toContain("pagination.pageOf");
  });

  it("shows the not a seller screen on 403 SELLER_NOT_ASSIGNED (AC-11)", async () => {
    refuseWith(403, "SELLER_NOT_ASSIGNED");

    await renderPage();

    expect(text()).toContain("states.notSellerTitle");
  });

  it("shows the failure screen with a retry on 500 (AC-11)", async () => {
    refuseWith(500, "INTERNAL_SERVER_ERROR");

    await renderPage();

    expect(text()).toContain("states.failureTitle");
    expect(text()).toContain("retry");
  });

  it("renders the group, the page label and a notice for a PENDING account (AC-4, AC-5, AC-11)", async () => {
    listResolves(page, { ...profile, status: "PENDING" });

    await renderPage();

    expect(text()).toContain("orderNumber");
    expect(text()).toContain("Kettle");
    expect(text()).toContain("pagination.pageOf");
    expect(text()).toContain("states.pendingTitle");
  });

  it("keeps the shown page under a loading strip while the next page loads (AC-5)", async () => {
    const second = deferred();
    const firstPage = {
      orders: [
        {
          id: "order-page-1",
          createdAt: "2026-11-08T10:00:00.000Z",
          orderItems: [orderLine],
        },
      ],
      page: 1,
      limit: 20,
      total: 21,
      totalPages: 2,
    };
    const secondPage = {
      orders: [
        {
          id: "order-page-2",
          createdAt: "2026-11-08T11:00:00.000Z",
          orderItems: [{ ...orderLine, id: "line-2", name: "Whistle" }],
        },
      ],
      page: 2,
      limit: 20,
      total: 21,
      totalPages: 2,
    };

    routes({
      "/seller/orders?page=1&limit=20": firstPage,
      "/seller/orders?page=2&limit=20": second.promise,
    });

    await renderPage();

    expect(text()).toContain("Kettle");
    expect(button("pagination.next").disabled).toBe(false);

    await act(async () => {
      button("pagination.next").click();
    });
    await flush();

    expect(text()).toContain("Kettle");
    expect(text()).toContain('"page":1');
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    await act(async () => {
      second.resolve(secondPage);
    });
    await flush();

    expect(text()).toContain("Whistle");
    expect(text()).not.toContain("Kettle");
    expect(text()).toContain('"page":2');
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("sends an external thumbnail past the optimizer and keeps a local one on it (AC-4)", async () => {
    routes({
      "/seller/orders?page=1&limit=20": {
        orders: [
          {
            id: "order-1",
            createdAt: "2026-11-08T10:00:00.000Z",
            orderItems: [
              {
                ...orderLine,
                id: "line-remote",
                previewImage: "https://placehold.co/600x400",
              },
              {
                ...orderLine,
                id: "line-local",
                name: "Mug",
                previewImage: "/images/mug.png",
              },
            ],
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });

    await renderPage();

    const thumbs = Array.from(container.querySelectorAll("[data-src]"));

    expect(thumbs.map((node) => node.getAttribute("data-src"))).toEqual([
      "https://placehold.co/600x400",
      "/images/mug.png",
    ]);
    expect(thumbs.map((node) => node.getAttribute("data-unoptimized"))).toEqual(
      ["true", "false"],
    );
  });

  it("asks before cancelling and writes nothing while the dialog is open (AC-7)", async () => {
    routes({ "/seller/orders?page=1&limit=20": page });

    await renderPage();

    await act(async () => button("actions.cancel").click());
    await flush();

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain('"product":"Kettle"');
    expect(patchItem).not.toHaveBeenCalled();

    await act(async () => buttonInDom("dialog.keep").click());
    await flush();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(patchItem).not.toHaveBeenCalled();
    expect(text()).toContain("pending");
  });

  it("sends the cancel only from the dialog confirm (AC-7)", async () => {
    routes({ "/seller/orders?page=1&limit=20": page });
    patchItem.mockResolvedValue({ ...orderLine, status: "CANCELLED" });

    await renderPage();

    await act(async () => button("actions.cancel").click());
    await flush();
    await act(async () => buttonInDom("dialog.confirm").click());
    await flush();

    expect(patchItem).toHaveBeenCalledWith("/order-items/line-1/status", {
      arg: { status: "CANCELLED" },
    });
  });

  it("keeps one change in flight and takes no second click (AC-8)", async () => {
    const answer = deferred();
    routes({ "/seller/orders?page=1&limit=20": page });
    patchItem.mockReturnValue(answer.promise);

    await renderPage();

    const confirm = button("actions.confirm");

    await act(async () => confirm.click());
    await flush();

    expect(patchItem).toHaveBeenCalledTimes(1);
    expect(confirm.disabled).toBe(true);
    expect(confirm.getAttribute("aria-busy")).toBe("true");

    await act(async () => confirm.click());
    await flush();

    expect(patchItem).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer.resolve({ ...orderLine, status: "CONFIRMED" });
    });
    await flush();

    expect(patchItem).toHaveBeenCalledTimes(1);
  });

  it("applies the answered line and revalidates what another person changed (AC-9)", async () => {
    const answered = { ...orderLine, status: "CONFIRMED" };
    const withAnotherLine = {
      ...page,
      orders: [
        {
          ...page.orders[0],
          orderItems: [
            answered,
            {
              ...orderLine,
              id: "line-2",
              productId: "product-2",
              name: "Whistle",
              status: "SHIPPED",
            },
          ],
        },
      ],
    };
    let reads = 0;

    getData.mockImplementation((url: string) => {
      if (url === "/users/me") {
        return Promise.resolve(profile);
      }

      reads += 1;
      return Promise.resolve(reads === 1 ? page : withAnotherLine);
    });
    patchItem.mockResolvedValue(answered);

    await renderPage();

    expect(text()).toContain("pending");
    expect(text()).not.toContain("Whistle");

    await act(async () => button("actions.confirm").click());
    await flush();
    await flush();

    expect(text()).toContain("confirmed");
    expect(text()).toContain("Whistle");
  });
});
