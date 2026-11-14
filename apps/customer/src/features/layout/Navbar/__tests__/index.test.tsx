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

import Navbar from "@/features/layout/Navbar";

const SELLER_HREF = 'a[href="/seller/orders"]';

let container: HTMLDivElement;
let root: Root;

const render = async (isSeller: boolean | undefined): Promise<void> => {
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
    orders: [],
    isLoading: false,
    error: null,
  });
  useUser.mockReturnValue({
    profileData: isSeller === undefined ? undefined : { isSeller },
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
const sheetLinks = (): HTMLAnchorElement[] =>
  Array.from(document.querySelectorAll<HTMLAnchorElement>(SELLER_HREF)).filter(
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
