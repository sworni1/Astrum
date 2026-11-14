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
    mutateProfile: vi.fn(),
  },
  points: {
    points: [] as Array<{ id: string; name: string; address: string }>,
    isLoading: false,
    error: null as unknown,
    mutate: vi.fn(),
  },
  grantPoint: vi.fn(),
  grantCourier: vi.fn(),
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

vi.mock("@/hooks/pickup/usePickupPoints", () => ({
  usePickupPoints: () => mocks.points,
}));

vi.mock("@/hooks/staff/usePointWorkerMutations", () => ({
  useGrantPointWorker: () => ({ run: mocks.grantPoint, isSubmitting: false }),
  useMovePointWorker: () => ({ run: vi.fn(), isSubmitting: false }),
}));

vi.mock("@/hooks/staff/useGrantCourier", () => ({
  useGrantCourier: () => ({ run: mocks.grantCourier, isSubmitting: false }),
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
      data-testid="staff-select"
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

import StaffOnboarding from "@/features/pages/StaffOnboarding";

const POINT = {
  id: "pp-1",
  name: "Central Pickup",
  address: "Tverskaya 12",
  isActive: true,
};

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
    root.render(<StaffOnboarding />);
  });
  await flush();
};

const text = (): string => container.textContent ?? "";

const button = (label: string): HTMLButtonElement | undefined =>
  Array.from(container.querySelectorAll("button")).find((element) =>
    element.textContent?.includes(label),
  );

const select = (): HTMLSelectElement =>
  container.querySelector("[data-testid='staff-select']") as HTMLSelectElement;

const pick = async (value: string): Promise<void> => {
  const element = select();
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value",
  )?.set;

  await act(async () => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await flush();
};

const submit = async (): Promise<void> => {
  const form = container.querySelector("form") as HTMLFormElement;

  await act(async () => {
    form.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await flush();
  await flush();
};

const activeProfile = (
  staffRoles: Array<"POINT_WORKER" | "COURIER"> = [],
  status: "ACTIVE" | "PENDING" = "ACTIVE",
) => {
  mocks.user.profileData = { isSeller: false, status, staffRoles };
};

describe("StaffOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.profileData = undefined;
    mocks.user.profileIsLoading = false;
    mocks.user.profileIsError = false;
    mocks.user.mutateProfile.mockResolvedValue(undefined);
    mocks.points.points = [POINT];
    mocks.points.isLoading = false;
    mocks.points.error = null;
    mocks.points.mutate.mockResolvedValue(undefined);
    mocks.grantPoint.mockResolvedValue({
      staffRoles: ["POINT_WORKER"],
      point: POINT,
    });
    mocks.grantCourier.mockResolvedValue({
      staffRoles: ["COURIER"],
      point: null,
    });
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("shows one skeleton while the profile loads (AC-3)", async () => {
    mocks.user.profileIsLoading = true;
    await renderPage();

    expect(container.querySelectorAll("[aria-label]")).toHaveLength(1);
    expect(container.querySelector("form")).toBeNull();
  });

  it("shows the profile failure screen and retries the read (AC-3)", async () => {
    mocks.user.profileIsError = true;
    await renderPage();

    expect(text()).toContain("staff.failureTitle");

    await act(async () => button("staff.retry")?.click());

    expect(mocks.user.mutateProfile).toHaveBeenCalledTimes(1);
  });

  it("offers both jobs to an account without a role (AC-3)", async () => {
    activeProfile();
    await renderPage();

    expect(text()).toContain("staff.onboarding.pointTitle");
    expect(text()).toContain("staff.onboarding.courierTitle");
    expect(text()).not.toContain("staff.onboarding.pendingNotice");
    expect(button("staff.onboarding.pointSubmit")?.disabled).toBe(false);
  });

  it("sends nothing and shows the inline text when no point is chosen (AC-3)", async () => {
    activeProfile();
    await renderPage();

    await submit();

    expect(mocks.grantPoint).not.toHaveBeenCalled();
    expect(text()).toContain("staff.refusals.validation");
  });

  it("disables both actions of a PENDING account with the notice (AC-3)", async () => {
    activeProfile([], "PENDING");
    await renderPage();

    expect(text()).toContain("staff.onboarding.pendingNotice");
    expect(button("staff.onboarding.pointSubmit")?.disabled).toBe(true);
    expect(button("staff.onboarding.courierSubmit")?.disabled).toBe(true);
  });

  it("confirms a role already held and keeps offering the other one (AC-3)", async () => {
    activeProfile(["POINT_WORKER"]);
    await renderPage();

    expect(
      container.querySelectorAll("[data-testid='staff-role-held']"),
    ).toHaveLength(1);
    expect(container.querySelector("a[href='/point']")).not.toBeNull();
    expect(text()).toContain("staff.onboarding.alreadyHeldPoint");
    expect(text()).toContain("staff.onboarding.courierTitle");
    expect(
      container.querySelector("[data-testid='staff-point-grant']"),
    ).toBeNull();
  });

  it("shows the inline text a 422 VALIDATION answer carries (AC-3)", async () => {
    mocks.grantPoint.mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { code: "VALIDATION" } },
    });
    activeProfile();
    await renderPage();

    await pick("pp-1");
    await submit();

    expect(text()).toContain("staff.refusals.validation");
  });

  it("shows the cart copy for a closed point (AC-14)", async () => {
    mocks.grantPoint.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { code: "PICKUP_POINT_INACTIVE" } },
    });
    activeProfile();
    await renderPage();

    await pick("pp-1");
    await submit();

    expect(text()).toContain("cart.pickupInactive");
  });

  it("disables the point action when no point is open and retries the read (AC-3)", async () => {
    mocks.points.points = [];
    activeProfile();
    await renderPage();

    expect(text()).toContain("staff.onboarding.pointNoPoints");
    expect(button("staff.onboarding.pointSubmit")?.disabled).toBe(true);

    await act(async () => button("staff.onboarding.pointRetry")?.click());

    expect(mocks.points.mutate).toHaveBeenCalledTimes(1);
  });

  it("shows the failed point read with a retry of its own (AC-3)", async () => {
    mocks.points.error = new Error("network");
    activeProfile();
    await renderPage();

    expect(text()).toContain("cart.pickupLoadFailed");
    expect(button("cart.pickupRetry")).toBeDefined();
    expect(button("staff.onboarding.pointSubmit")?.disabled).toBe(true);
  });

  it("shows the success card with the stored point and revalidates the profile (AC-3, AC-15)", async () => {
    activeProfile();
    await renderPage();

    await pick("pp-1");
    await submit();

    expect(mocks.grantPoint).toHaveBeenCalledWith({ pickupPointId: "pp-1" });
    expect(mocks.user.mutateProfile).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector("[data-testid='staff-success']"),
    ).not.toBeNull();
    expect(text()).toContain("staff.onboarding.successPointTitle");
    expect(text()).toContain("staff.roles.pointWorker");
    expect(text()).toContain(POINT.name);
    expect(text()).toContain(POINT.address);
    expect(container.querySelector("[role='status']")).not.toBeNull();
    expect(document.activeElement?.textContent).toBe(
      "staff.onboarding.successPointTitle",
    );
  });

  it("takes the courier job and shows the courier card (AC-7)", async () => {
    activeProfile();
    await renderPage();

    await act(async () => button("staff.onboarding.courierSubmit")?.click());
    await flush();
    await flush();

    expect(mocks.grantCourier).toHaveBeenCalledTimes(1);
    expect(mocks.user.mutateProfile).toHaveBeenCalledTimes(1);
    expect(text()).toContain("staff.onboarding.successCourierTitle");
    expect(text()).toContain("staff.roles.courier");
  });

  it("toasts a courier failure instead of a card (AC-3)", async () => {
    mocks.grantCourier.mockRejectedValue(new Error("Network Error"));
    activeProfile();
    await renderPage();

    await act(async () => button("staff.onboarding.courierSubmit")?.click());
    await flush();
    await flush();

    expect(mocks.toast).toHaveBeenCalledWith({
      title: "staff.onboarding.actionFailed",
      type: "error",
    });
    expect(container.querySelector("[data-testid='staff-success']")).toBeNull();
  });
});
