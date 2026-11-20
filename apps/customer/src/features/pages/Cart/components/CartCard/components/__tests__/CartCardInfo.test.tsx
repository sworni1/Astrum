import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@messages/en.json";
import ru from "@messages/ru.json";

const mocks = vi.hoisted(() => ({ locale: "ru" }));

const NBSP = "\u00A0";

vi.mock("next-intl", async () => {
  const catalogs = {
    ru: (await import("@messages/ru.json")).default,
    en: (await import("@messages/en.json")).default,
  };

  return {
    useLocale: () => mocks.locale,
    useTranslations: (namespace: "cart") => {
      const entries = catalogs[mocks.locale === "en" ? "en" : "ru"][
        namespace
      ] as unknown as Record<string, string>;

      return (key: string, values?: Record<string, unknown>) => {
        const template = entries[key] ?? key;

        return values === undefined
          ? template
          : template.replace(/\{(\w+)\}/g, (_match: string, name: string) =>
              String(values[name] ?? ""),
            );
      };
    },
  };
});

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import CartCardInfo from "@/features/pages/Cart/components/CartCard/components/CartCardInfo";

let container: HTMLDivElement;
let root: Root;

const render = async (): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<CartCardInfo id="product-1" name="Kettle" price={24054.8} />);
  });
};

const text = (): string => container.textContent ?? "";

describe("CartCardInfo per item amount", () => {
  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("prints the amount through the money formatter in Russian (AC-14)", async () => {
    mocks.locale = "ru";

    await render();

    expect(text()).toContain(`24${NBSP}054,80${NBSP}₽`);
    expect(text()).not.toContain("$");
  });

  it("prints the narrow symbol and a grouped amount in English (AC-14)", async () => {
    mocks.locale = "en";

    await render();

    expect(text()).toContain("₽24,054.80");
    expect(text()).not.toContain("$");
  });

  it("keeps no currency sign inside the sentence itself (AC-14)", () => {
    expect(ru.cart.eachPrice).toContain("{price}");
    expect(ru.cart.eachPrice).not.toContain("$");
    expect(en.cart.eachPrice).toContain("{price}");
    expect(en.cart.eachPrice).not.toContain("$");
  });
});
