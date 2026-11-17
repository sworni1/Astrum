import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useGetCart, useGetOrders, useGetWishlist, useUser } = vi.hoisted(
  () => ({
    useGetCart: vi.fn(),
    useGetOrders: vi.fn(),
    useGetWishlist: vi.fn(),
    useUser: vi.fn(),
  }),
);

vi.mock("@/hooks/product/useCart/useGetCart", () => ({ useGetCart }));
vi.mock("@/hooks/order/useGetOrders", () => ({ useGetOrders }));
vi.mock("@/hooks/product/useWishlist/useGetWishlist", () => ({
  useGetWishlist,
}));
vi.mock("@/hooks/user/useUser", () => ({ useUser }));

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) =>
    (key: string): string =>
      `${namespace}.${key}`,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/common/helpers/showToast", () => ({ showToast: vi.fn() }));
vi.mock("@/features/layout/Navbar/Searchbar", () => ({ default: () => <span data-searchbar="" /> }));
vi.mock("@/components/LocaleSwitcher", () => ({
  default: () => <span data-locale="" />,
}));
vi.mock("@/components/ThemeSwitcher", () => ({
  default: () => <span data-themeswitcher="" />,
}));

import { showToast } from "@/common/helpers/showToast";
import Navbar from "@/features/layout/Navbar";

const SELLER_HREF = 'a[href="/seller/orders"]';
const POINT_HREF = 'a[href="/point"]';
const COURIER_HREF = 'a[href="/courier"]';

let container: HTMLDivElement;
let root: Root;

const render = async (
  isSeller: boolean | undefined,
  staffRoles: Array<"POINT_WORKER" | "COURIER"> = [],
): Promise<void> => {
  useGetCart.mockReturnValue({
    cart: [],
    cartIsLoading: false,
    cartError: null,
  });
  useGetWishlist.mockReturnValue({
    wishlist: [],
    wishlistIsLoading: false,
    wishlistError: null,
  });
  useGetOrders.mockReturnValue({
    page: {
      items: [],
      counts: { all: 0, delivered: 0, canceled: 0 },
      spent: [],
    },
    isLoading: false,
    isValidating: false,
    error: null,
  });
  useUser.mockReturnValue({
    profileData: isSeller === undefined ? undefined : { isSeller, staffRoles },
  });

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<Navbar />);
  });
};

const openMobileSheet = async (): Promise<void> => {
  const menu = container.querySelector('[class*="sm:hidden"] svg');

  if (!menu) {
    throw new Error("no menu icon in the mobile block");
  }

  await act(async () => {
    menu.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

/** The sheet renders through a portal, so its links sit outside the container. */
const sheetLinks = (selector = SELLER_HREF): HTMLAnchorElement[] =>
  Array.from(document.querySelectorAll<HTMLAnchorElement>(selector)).filter(
    (link) => !container.contains(link),
  );

describe("Sales item in the navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("shows the item to the owner of a business and links it to the panel (AC-3)", async () => {
    await render(true);

    const link = container.querySelector<HTMLAnchorElement>(SELLER_HREF);

    expect(link).not.toBeNull();
    expect(link?.getAttribute("aria-label")).toBe("nav.sales");
  });

  it("hides the item from an account without a business (AC-3)", async () => {
    await render(false);

    expect(container.querySelector(SELLER_HREF)).toBeNull();
    expect(document.querySelector(SELLER_HREF)).toBeNull();
  });

  it("hides the item while the profile is still unknown (AC-3)", async () => {
    await render(undefined);

    expect(container.querySelector(SELLER_HREF)).toBeNull();
  });

  it("repeats the item inside the mobile sheet for a seller (AC-3)", async () => {
    await render(true);

    await openMobileSheet();

    const links = sheetLinks();

    expect(links).toHaveLength(1);
    expect(links[0].textContent).toContain("nav.sales");
  });

  it("keeps the mobile sheet free of the item for an account without a business (AC-3)", async () => {
    await render(false);

    await openMobileSheet();

    expect(sheetLinks()).toHaveLength(0);
  });
});

describe("Point and courier items in the navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("shows the point item to a point worker and links it to /point (AC-12)", async () => {
    await render(false, ["POINT_WORKER"]);

    const link = container.querySelector<HTMLAnchorElement>(POINT_HREF);

    expect(link).not.toBeNull();
    expect(link?.getAttribute("aria-label")).toBe("nav.point");
    expect(container.querySelector(COURIER_HREF)).toBeNull();
  });

  it("shows the courier item to a courier and links it to /courier (AC-12)", async () => {
    await render(false, ["COURIER"]);

    const link = container.querySelector<HTMLAnchorElement>(COURIER_HREF);

    expect(link).not.toBeNull();
    expect(link?.getAttribute("aria-label")).toBe("nav.courier");
    expect(container.querySelector(POINT_HREF)).toBeNull();
  });

  it("keeps the point item before the courier item when both are held (AC-12)", async () => {
    await render(false, ["POINT_WORKER", "COURIER"]);

    const point = container.querySelector<HTMLAnchorElement>(POINT_HREF);
    const courier = container.querySelector<HTMLAnchorElement>(COURIER_HREF);

    if (!point || !courier) {
      throw new Error("both items should render");
    }

    expect(
      point.compareDocumentPosition(courier) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("hides both items from an account that holds no role (AC-12)", async () => {
    await render(false, []);

    expect(container.querySelector(POINT_HREF)).toBeNull();
    expect(container.querySelector(COURIER_HREF)).toBeNull();
  });

  it("repeats both items inside the mobile sheet (AC-12)", async () => {
    await render(false, ["POINT_WORKER", "COURIER"]);

    await openMobileSheet();

    expect(sheetLinks(POINT_HREF)).toHaveLength(1);
    expect(sheetLinks(POINT_HREF)[0]?.textContent).toContain("nav.point");
    expect(sheetLinks(COURIER_HREF)).toHaveLength(1);
    expect(sheetLinks(COURIER_HREF)[0]?.textContent).toContain("nav.courier");
  });

  it("keeps the mobile sheet free of both items without a role (AC-12)", async () => {
    await render(false, []);

    await openMobileSheet();

    expect(sheetLinks(POINT_HREF)).toHaveLength(0);
    expect(sheetLinks(COURIER_HREF)).toHaveLength(0);
  });
});


describe("A failed read in the navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  /** Every read answers, except the orders one, which failed once. */
  const renderWithFailedOrders = async (error: object): Promise<void> => {
    useGetCart.mockReturnValue({
      cart: [],
      cartIsLoading: false,
      cartError: null,
    });
    useGetWishlist.mockReturnValue({
      wishlist: [],
      wishlistIsLoading: false,
      wishlistError: null,
    });
    useGetOrders.mockReturnValue({
      page: undefined,
      isLoading: false,
      isValidating: false,
      error,
    });
    useUser.mockReturnValue({
      profileData: { isSeller: false, staffRoles: [] },
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<Navbar />);
    });
  };

  it("raises one toast for one failed read, not one per render (AC-13)", async () => {
    await renderWithFailedOrders({ message: "orders are down" });

    expect(showToast).toHaveBeenCalledTimes(1);

    await openMobileSheet();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      title: "nav.ordersFailed",
      type: "error",
    });
  });
});
