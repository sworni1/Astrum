import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: {
    profileData: undefined as
      | { isSeller: boolean; status: "ACTIVE" | "PENDING" }
      | undefined,
    profileIsLoading: false,
    profileIsError: false,
    mutateProfile: vi.fn(),
  },
  becomeSeller: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("../../../common/helpers/showToast", () => ({
  showToast: mocks.toast,
}));

vi.mock("../../../hooks/user", () => ({ useUser: () => mocks.user }));

vi.mock("../../../hooks/seller", () => ({
  useBecomeSeller: () => ({
    becomeSeller: mocks.becomeSeller,
    isSubmitting: false,
  }),
}));

import SellerOnboarding from "./index";

let container: HTMLDivElement;
let root: Root;

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
    root.render(<SellerOnboarding />);
  });
  await flush();
};

const text = (): string => container.textContent ?? "";

const queryButton = (label: string): HTMLButtonElement | undefined =>
  Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(label),
  );

const typeName = async (value: string): Promise<void> => {
  const input = container.querySelector("input") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;

  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await flush();
};

const submitForm = async (): Promise<void> => {
  const form = container.querySelector("form") as HTMLFormElement;

  await act(async () => {
    form.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await flush();
  await flush();
};

describe("SellerOnboarding", () => {
  beforeEach(() => {
    mocks.user.profileData = undefined;
    mocks.user.profileIsLoading = false;
    mocks.user.profileIsError = false;
    mocks.user.mutateProfile.mockReset();
    mocks.user.mutateProfile.mockResolvedValue(undefined);
    mocks.becomeSeller.mockReset();
    mocks.toast.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("shows one loading state while the profile loads (AC-3)", async () => {
    mocks.user.profileIsLoading = true;
    await renderPage();

    expect(container.querySelectorAll("[aria-label]")).toHaveLength(1);
    expect(container.querySelector("form")).toBeNull();
  });

  it("shows the failure screen and retries the profile (AC-3, AC-10)", async () => {
    mocks.user.profileIsError = true;
    await renderPage();

    expect(text()).toContain("seller.onboarding.failureTitle");

    const retry = queryButton("seller.onboarding.retry");
    await act(async () => retry?.click());

    expect(mocks.user.mutateProfile).toHaveBeenCalledTimes(1);
  });

  it("shows the form for an active account that does not sell (AC-3, AC-4)", async () => {
    mocks.user.profileData = { isSeller: false, status: "ACTIVE" };
    await renderPage();

    expect(container.querySelector("form")).not.toBeNull();
    expect(text()).toContain("seller.onboarding.nameLabel");
    expect(text()).toContain("seller.onboarding.nameHint");
    expect(text()).not.toContain("seller.onboarding.pendingNotice");
  });

  it("disables the submit of a PENDING account and explains why (AC-3)", async () => {
    mocks.user.profileData = { isSeller: false, status: "PENDING" };
    await renderPage();

    expect(text()).toContain("seller.onboarding.pendingNotice");
    expect(queryButton("seller.onboarding.submit")?.disabled).toBe(true);
  });

  it("shows the already sells state with the panel link (AC-3)", async () => {
    mocks.user.profileData = { isSeller: true, status: "ACTIVE" };
    await renderPage();

    const link = container.querySelector("a[href='/seller/orders']");

    expect(text()).toContain("seller.onboarding.alreadyTitle");
    expect(link?.textContent).toBe("seller.onboarding.alreadyAction");
  });

  it("shows the already sells state for a seller whose address is PENDING (AC-3)", async () => {
    mocks.user.profileData = { isSeller: true, status: "PENDING" };
    await renderPage();

    expect(text()).toContain("seller.onboarding.alreadyTitle");
    expect(text()).not.toContain("seller.onboarding.pendingNotice");
    expect(container.querySelector("form")).toBeNull();
  });

  it("shows the success card after the call, over the already sells state (AC-3, AC-9)", async () => {
    mocks.user.profileData = { isSeller: false, status: "ACTIVE" };
    mocks.becomeSeller.mockImplementation(async () => {
      mocks.user.profileData = { isSeller: true, status: "ACTIVE" };
      return { isSeller: true, businessName: "My Shop" };
    });
    await renderPage();

    await typeName("  My   Shop  ");
    await submitForm();

    expect(mocks.becomeSeller).toHaveBeenCalledWith({ name: "My Shop" });
    expect(mocks.user.mutateProfile).toHaveBeenCalledTimes(1);
    expect(text()).toContain("seller.onboarding.successTitle");
    expect(text()).toContain("My Shop");
    expect(text()).not.toContain("seller.onboarding.alreadyTitle");
    expect(container.querySelector("[role='status']")).not.toBeNull();
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "seller.onboarding.successToast",
      type: "success",
    });
  });
});
