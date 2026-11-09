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

vi.mock("../../../common/helpers/showToast", () => ({
  showToast: mocks.toast,
}));

vi.mock("../../../hooks/user", () => ({ useUser: () => mocks.user }));

vi.mock("../../../components/skeletons", () => ({
  EditProfileFormSkeleton: () => <div data-testid="profile-skeleton" />,
}));

vi.mock("./actions", () => ({
  EditProfileForm: () => <div data-testid="edit-profile" />,
  ChangePasswordForm: () => <div data-testid="change-password" />,
  LogOutForm: () => <div />,
  DeleteAccountForm: () => <div />,
  SellOnAstrum: () => <div data-testid="sell-on-astrum-stub" />,
}));

import SellOnAstrum from "./actions/SellOnAstrum";
import Profile from "./index";

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
      container.querySelector("[data-testid='sell-on-astrum-stub']"),
    ).not.toBeNull();
  });

  it("hides the section for a seller (AC-2)", async () => {
    mocks.user.profileData = { isSeller: true, status: "ACTIVE" };
    await render(<Profile />);

    expect(
      container.querySelector("[data-testid='sell-on-astrum-stub']"),
    ).toBeNull();
  });

  it("shows nothing while the profile loads or fails (AC-2)", async () => {
    mocks.user.profileIsLoading = true;
    await render(<Profile />);

    expect(
      container.querySelector("[data-testid='sell-on-astrum-stub']"),
    ).toBeNull();

    await act(async () => root.unmount());
    container.remove();

    mocks.user.profileIsLoading = false;
    mocks.user.profileIsError = true;
    await render(<Profile />);

    expect(
      container.querySelector("[data-testid='sell-on-astrum-stub']"),
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
