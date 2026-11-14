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
  },
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

vi.mock("@/common/helpers/showToast", () => ({
  showToast: mocks.toast,
}));

vi.mock("@/hooks/user/useUser", () => ({ useUser: () => mocks.user }));

vi.mock("@/components/skeletons/EditProfileFormSkeleton", () => ({
  default: () => <div data-testid="profile-skeleton" />,
}));

vi.mock("@/features/pages/Profile/actions/EditProfileForm", () => ({
  default: () => <div data-testid="edit-profile" />,
}));

vi.mock("@/features/pages/Profile/actions/ChangePasswordForm", () => ({
  default: () => <div data-testid="change-password" />,
}));

vi.mock("@/features/pages/Profile/actions/LogOutForm", () => ({ default: () => <div /> }));

vi.mock("@/features/pages/Profile/actions/DeleteAccountForm", () => ({ default: () => <div /> }));

import Profile from "@/features/pages/Profile";
import SellOnAstrum from "@/features/pages/Profile/actions/SellOnAstrum";

let container: HTMLDivElement;
let root: Root;

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const render = async (element: React.ReactNode): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(element);
  });
  await flush();
};

describe("Profile seller entry", () => {
  beforeEach(() => {
    mocks.user.profileData = undefined;
    mocks.user.profileIsLoading = false;
    mocks.user.profileIsError = false;
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("shows the section for an account that does not sell (AC-2)", async () => {
    mocks.user.profileData = { isSeller: false, status: "ACTIVE" };
    await render(<Profile />);

    expect(
      container.querySelector("[data-testid='sell-on-astrum']"),
    ).not.toBeNull();
  });

  it("hides the section for a seller (AC-2)", async () => {
    mocks.user.profileData = { isSeller: true, status: "ACTIVE" };
    await render(<Profile />);

    expect(
      container.querySelector("[data-testid='sell-on-astrum']"),
    ).toBeNull();
  });

  it("shows nothing while the profile loads or fails (AC-2)", async () => {
    mocks.user.profileIsLoading = true;
    await render(<Profile />);

    expect(
      container.querySelector("[data-testid='sell-on-astrum']"),
    ).toBeNull();

    await act(async () => root.unmount());
    container.remove();

    mocks.user.profileIsLoading = false;
    mocks.user.profileIsError = true;
    await render(<Profile />);

    expect(
      container.querySelector("[data-testid='sell-on-astrum']"),
    ).toBeNull();
  });
});

describe("SellOnAstrum section", () => {
  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("links to the onboarding page with catalog copy (AC-2, AC-11)", async () => {
    await render(<SellOnAstrum />);

    expect(
      container.querySelector("[data-testid='sell-on-astrum']"),
    ).not.toBeNull();
    expect(container.textContent).toContain(
      "seller.onboarding.profileSectionTitle",
    );
    expect(
      container.querySelector("a[href='/seller/onboarding']")?.textContent,
    ).toBe("seller.onboarding.profileSectionAction");
  });
});
