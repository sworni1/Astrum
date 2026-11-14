import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: {
    profileData: undefined as
      | {
          isSeller: boolean;
          status: "ACTIVE" | "PENDING";
          staffRoles: Array<"POINT_WORKER" | "COURIER">;
        }
      | undefined,
    profileIsLoading: false,
    profileIsError: false,
  },
  point: {
    point: null as {
      id: string;
      name: string;
      address: string;
      isActive: boolean;
    } | null,
    staffRoles: [] as string[],
    isLoading: false,
    error: null as unknown,
    mutate: vi.fn(),
  },
  points: {
    points: [
      { id: "pp-1", name: "Central Pickup", address: "Tverskaya 12" },
      { id: "pp-2", name: "South Pickup", address: "Lenina 4" },
    ],
    isLoading: false,
    error: null as unknown,
    mutate: vi.fn(),
  },
  movePoint: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) =>
    (key: string): string =>
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

vi.mock("@/common/helpers/showToast", () => ({ showToast: mocks.toast }));

vi.mock("@/hooks/user/useUser", () => ({ useUser: () => mocks.user }));

vi.mock("@/hooks/staff/useStaffPoint", () => ({
  useStaffPoint: () => mocks.point,
}));

vi.mock("@/hooks/pickup/usePickupPoints", () => ({
  usePickupPoints: () => mocks.points,
}));

vi.mock("@/hooks/staff/usePointWorkerMutations", () => ({
  useGrantPointWorker: () => ({ run: vi.fn(), isSubmitting: false }),
  useMovePointWorker: () => ({ run: mocks.movePoint, isSubmitting: false }),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <select
      data-testid="point-change-select"
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

import WorkOnAstrum from "@/features/pages/Profile/actions/WorkOnAstrum";

const POINT = {
  id: "pp-1",
  name: "Central Pickup",
  address: "Tverskaya 12",
  isActive: true,
};

const refusal = (status: number, code: string) => ({
  isAxiosError: true,
  response: { status, data: { code } },
});

let container: HTMLDivElement;
let root: Root;

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const renderSection = async (): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<WorkOnAstrum />);
  });
  await flush();
};

const text = (): string => container.textContent ?? "";

const button = (label: string): HTMLButtonElement | undefined =>
  Array.from(container.querySelectorAll("button")).find((element) =>
    element.textContent?.includes(label),
  );

const profile = (
  staffRoles: Array<"POINT_WORKER" | "COURIER">,
  status: "ACTIVE" | "PENDING" = "ACTIVE",
) => {
  mocks.user.profileData = { isSeller: false, status, staffRoles };
};

describe("WorkOnAstrum", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.profileData = undefined;
    mocks.user.profileIsLoading = false;
    mocks.user.profileIsError = false;
    mocks.point.point = null;
    mocks.point.isLoading = false;
    mocks.point.error = null;
    mocks.point.mutate.mockResolvedValue(undefined);
    mocks.points.isLoading = false;
    mocks.points.error = null;
    mocks.movePoint.mockResolvedValue({
      staffRoles: ["POINT_WORKER"],
      point: POINT,
    });
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("paints nothing while the profile loads or fails (AC-2)", async () => {
    mocks.user.profileIsLoading = true;
    await renderSection();

    expect(
      container.querySelector("[data-testid='work-on-astrum']"),
    ).toBeNull();

    await act(async () => root.unmount());
    container.remove();

    mocks.user.profileIsLoading = false;
    mocks.user.profileIsError = true;
    await renderSection();

    expect(
      container.querySelector("[data-testid='work-on-astrum']"),
    ).toBeNull();
  });

  it("explains the step in one sentence with a link for an account without a role (AC-2)", async () => {
    profile([]);
    await renderSection();

    expect(text()).toContain("staff.profile.sectionText");
    expect(
      container.querySelector("a[href='/staff/onboarding']")?.textContent,
    ).toBe("staff.profile.action");
  });

  it("names the roles held and links each one to its page (AC-2)", async () => {
    profile(["POINT_WORKER", "COURIER"]);
    mocks.point.point = POINT;
    await renderSection();

    expect(text()).toContain("staff.roles.pointWorker");
    expect(text()).toContain("staff.roles.courier");
    expect(container.querySelector("a[href='/point']")).not.toBeNull();
    expect(container.querySelector("a[href='/courier']")).not.toBeNull();
  });

  it("keeps the point line out for a courier who holds no point role (AC-2)", async () => {
    profile(["COURIER"]);
    await renderSection();

    expect(text()).not.toContain("staff.profile.pointLabel");
    expect(container.querySelector("[data-testid='point-change']")).toBeNull();
  });

  it("shows a loading line while the point read is in flight (AC-2)", async () => {
    profile(["POINT_WORKER"]);
    mocks.point.isLoading = true;
    await renderSection();

    expect(text()).toContain("staff.profile.pointLoading");
    expect(container.querySelector("[data-testid='point-change']")).toBeNull();
  });

  it("shows a retry line for a failed point read and never works nowhere (AC-2)", async () => {
    profile(["POINT_WORKER"]);
    mocks.point.error = refusal(503, "STAFF_ROLE_UNAVAILABLE");
    await renderSection();

    expect(text()).toContain("staff.profile.pointFailed");
    expect(text()).not.toContain("staff.profile.pointLoading");

    await act(async () => button("staff.profile.pointRetry")?.click());

    expect(mocks.point.mutate).toHaveBeenCalledTimes(1);
  });

  it("prints the point name and the change control on a successful read (AC-2)", async () => {
    profile(["POINT_WORKER"]);
    mocks.point.point = POINT;
    await renderSection();

    expect(text()).toContain("staff.profile.pointLabel");
    expect(text()).toContain("Central Pickup");
    expect(
      container.querySelector("[data-testid='point-change']"),
    ).not.toBeNull();
  });

  it("disables the change control with the notice while the address is unconfirmed (AC-2)", async () => {
    profile(["POINT_WORKER"], "PENDING");
    mocks.point.point = POINT;
    await renderSection();

    expect(text()).toContain("staff.profile.pendingNotice");
    expect(button("staff.profile.changeSubmit")?.disabled).toBe(true);
  });

  it("moves the point and revalidates the point read (AC-8)", async () => {
    profile(["POINT_WORKER"]);
    mocks.point.point = POINT;
    await renderSection();

    const select = container.querySelector(
      "[data-testid='point-change-select']",
    ) as HTMLSelectElement;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value",
    )?.set;

    await act(async () => {
      setter?.call(select, "pp-2");
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const submit = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      submit.requestSubmit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await flush();

    expect(mocks.movePoint).toHaveBeenCalledWith({ pickupPointId: "pp-2" });
    expect(mocks.point.mutate).toHaveBeenCalledTimes(1);
  });

  it("keeps the change disabled on the stored point (AC-8)", async () => {
    profile(["POINT_WORKER"]);
    mocks.point.point = POINT;
    await renderSection();

    expect(button("staff.profile.changeSubmit")?.disabled).toBe(true);
    expect(mocks.movePoint).not.toHaveBeenCalled();
  });
});
