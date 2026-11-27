import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetcher = vi.hoisted(() => ({
  getData: vi.fn(),
  postItem: vi.fn(),
  patchItem: vi.fn(),
}));

vi.mock("@/hooks/useFetcher", () => ({ useFetcher: () => fetcher }));

import { staffErrorCode } from "@/hooks/staff/staffError";
import { useGrantCourier } from "@/hooks/staff/useGrantCourier";
import {
  useGrantPointWorker,
  useMovePointWorker,
} from "@/hooks/staff/usePointWorkerMutations";
import { useStaffCourier } from "@/hooks/staff/useStaffCourier";
import { useStaffPoint } from "@/hooks/staff/useStaffPoint";

const ANSWER = {
  staffRoles: ["POINT_WORKER"] as const,
  point: {
    id: "pp-1",
    name: "Central Pickup",
    address: "Tverskaya 12",
    isActive: true,
  },
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

const renderProbe = async (probe: React.ReactNode): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        {probe}
      </SWRConfig>,
    );
  });
  await flush();
  await flush();
  await flush();
};

const text = (): string => container.textContent ?? "";

const button = (label: string): HTMLButtonElement =>
  Array.from(container.querySelectorAll("button")).find((element) =>
    element.textContent?.includes(label),
  ) as HTMLButtonElement;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

describe("staff read hooks", () => {
  beforeEach(() => {
    fetcher.getData.mockReset();
  });

  it("answers the point and the roles of the point read (AC-9)", async () => {
    fetcher.getData.mockResolvedValue(ANSWER);

    const Probe = () => {
      const { point, staffRoles, isLoading, error } = useStaffPoint();

      return (
        <span
          data-loading={String(isLoading)}
          data-error={String(error)}
          data-roles={staffRoles.join(",")}
        >
          {point?.name ?? "none"}
        </span>
      );
    };

    await renderProbe(<Probe />);

    expect(fetcher.getData).toHaveBeenCalledWith("/staff/point");
    expect(text()).toContain("Central Pickup");
    expect(
      container.querySelector("[data-roles]")?.getAttribute("data-roles"),
    ).toBe("POINT_WORKER");
  });

  it("keeps the refusal code a missing role answers with (AC-13)", async () => {
    fetcher.getData.mockRejectedValue(refusal(403, "NOT_POINT_WORKER"));

    const Probe = () => {
      const { error } = useStaffPoint();

      return <span data-code={staffErrorCode(error) ?? ""} />;
    };

    await renderProbe(<Probe />);

    expect(
      container.querySelector("[data-code]")?.getAttribute("data-code"),
    ).toBe("NOT_POINT_WORKER");
  });

  it("reads the courier answer without a point (AC-10)", async () => {
    fetcher.getData.mockResolvedValue({
      staffRoles: ["COURIER"],
      point: null,
    });

    const Probe = () => {
      const { staffRoles } = useStaffCourier();

      return <span data-roles={staffRoles.join(",")} />;
    };

    await renderProbe(<Probe />);

    expect(fetcher.getData).toHaveBeenCalledWith("/staff/courier");
    expect(
      container.querySelector("[data-roles]")?.getAttribute("data-roles"),
    ).toBe("COURIER");
  });
});

describe("staff mutation hooks", () => {
  beforeEach(() => {
    fetcher.postItem.mockReset();
    fetcher.patchItem.mockReset();
  });

  it("grants the point with the chosen id (AC-4)", async () => {
    fetcher.postItem.mockResolvedValue(ANSWER);

    const Probe = () => {
      const { run } = useGrantPointWorker();

      return (
        <button
          type="button"
          onClick={() => {
            void run({ pickupPointId: "pp-1" }).catch(() => undefined);
          }}
        >
          grant
        </button>
      );
    };

    await renderProbe(<Probe />);
    await act(async () => button("grant").click());
    await flush();

    expect(fetcher.postItem).toHaveBeenCalledWith("/staff/point-worker", {
      arg: { pickupPointId: "pp-1" },
    });
  });

  it("keeps the refusal code of a point grant (AC-5)", async () => {
    fetcher.postItem.mockRejectedValue(refusal(409, "PICKUP_POINT_INACTIVE"));

    const Probe = () => {
      const { run, error } = useGrantPointWorker();

      return (
        <>
          <button
            type="button"
            onClick={() => {
              void run({ pickupPointId: "pp-1" }).catch(() => undefined);
            }}
          >
            grant
          </button>
          <span data-code={staffErrorCode(error) ?? ""} />
        </>
      );
    };

    await renderProbe(<Probe />);
    await act(async () => button("grant").click());
    await flush();

    expect(
      container.querySelector("[data-code]")?.getAttribute("data-code"),
    ).toBe("PICKUP_POINT_INACTIVE");
  });

  it("moves the point through PATCH (AC-8)", async () => {
    fetcher.patchItem.mockResolvedValue(ANSWER);

    const Probe = () => {
      const { run } = useMovePointWorker();

      return (
        <button
          type="button"
          onClick={() => {
            void run({ pickupPointId: "pp-2" }).catch(() => undefined);
          }}
        >
          move
        </button>
      );
    };

    await renderProbe(<Probe />);
    await act(async () => button("move").click());
    await flush();

    expect(fetcher.patchItem).toHaveBeenCalledWith("/staff/point-worker", {
      arg: { pickupPointId: "pp-2" },
    });
  });

  it("takes the courier job with no body (AC-7)", async () => {
    fetcher.postItem.mockResolvedValue({
      staffRoles: ["COURIER"],
      point: null,
    });

    const Probe = () => {
      const { run } = useGrantCourier();

      return (
        <button
          type="button"
          onClick={() => {
            void run().catch(() => undefined);
          }}
        >
          courier
        </button>
      );
    };

    await renderProbe(<Probe />);
    await act(async () => button("courier").click());
    await flush();

    expect(fetcher.postItem).toHaveBeenCalledWith("/staff/courier", {
      arg: undefined,
    });
  });

  it("surfaces a network failure without a code (AC-14)", async () => {
    fetcher.postItem.mockRejectedValue(new Error("Network Error"));

    const Probe = () => {
      const { run, error } = useGrantCourier();

      return (
        <>
          <button
            type="button"
            onClick={() => {
              void run().catch(() => undefined);
            }}
          >
            courier
          </button>
          <span data-code={staffErrorCode(error) ?? ""} />
        </>
      );
    };

    await renderProbe(<Probe />);
    await act(async () => button("courier").click());
    await flush();

    expect(
      container.querySelector("[data-code]")?.getAttribute("data-code"),
    ).toBe("");
  });
});
