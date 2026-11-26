import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Gender } from "@/common/types/auth.types";
import type { UserData } from "@/common/types/user.types";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

import ProfileHeader from "@/features/pages/Profile/components/ProfileHeader";

let container: HTMLDivElement;
let root: Root;

const render = async (element: React.ReactNode): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(element);
  });
};

const profile = (overrides: Partial<UserData>): UserData => ({
  email: "wefr@example.com",
  nickName: "wefr",
  gender: Gender.Male,
  dateOfBirth: new Date("2000-01-01T00:00:00.000Z"),
  status: "ACTIVE",
  isSeller: false,
  staffRoles: [],
  ...overrides,
});

describe("ProfileHeader", () => {
  beforeEach(() => {
    container = undefined as unknown as HTMLDivElement;
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("prints the nickname, the email and the avatar initial (AC-4)", async () => {
    await render(<ProfileHeader profileData={profile({ nickName: "wefr" })} />);

    expect(container.querySelector("h1")?.textContent).toBe("wefr");
    expect(container.textContent).toContain("wefr@example.com");
    expect(
      container.querySelector("[data-testid='profile-header']")?.textContent,
    ).toContain("W");
  });

  it("labels a plain account as a buyer (AC-8)", async () => {
    await render(<ProfileHeader profileData={profile({})} />);

    expect(
      container.querySelector("[data-testid='profile-role-badge']")
        ?.textContent,
    ).toBe("profile.roleBuyer");
  });

  it("labels a seller and a staff account differently (AC-8)", async () => {
    await render(<ProfileHeader profileData={profile({ isSeller: true })} />);

    expect(
      container.querySelector("[data-testid='profile-role-badge']")
        ?.textContent,
    ).toBe("profile.roleSeller");

    await act(async () => root.unmount());
    container.remove();

    await render(
      <ProfileHeader profileData={profile({ staffRoles: ["COURIER"] })} />,
    );

    expect(
      container.querySelector("[data-testid='profile-role-badge']")
        ?.textContent,
    ).toBe("profile.roleStaff");
  });

  it("survives an account without a nickname (AC-4)", async () => {
    await render(
      <ProfileHeader
        profileData={profile({ nickName: null as unknown as string })}
      />,
    );

    expect(container.querySelector("h1")?.textContent).toBe("wefr@example.com");
  });
});
