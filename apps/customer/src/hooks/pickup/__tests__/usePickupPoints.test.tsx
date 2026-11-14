import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getData } = vi.hoisted(() => ({ getData: vi.fn() }));

vi.mock("@/hooks/useFetcher", () => ({ useFetcher: () => ({ getData }) }));

import { usePickupPoints } from "@/hooks/pickup/usePickupPoints";

const Probe = () => {
  const { points, isLoading, error } = usePickupPoints();

  return (
    <span
      data-state={JSON.stringify({
        names: points.map((point) => point.name),
        isLoading,
        failed: error !== null,
      })}
    />
  );
};

let container: HTMLDivElement;
let root: Root;

const state = () =>
  JSON.parse(
    container.querySelector("[data-state]")?.getAttribute("data-state") ?? "{}",
  ) as { names?: string[]; isLoading?: boolean; failed?: boolean };

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const render = async (): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <SWRConfig
        value={{
          provider: () => new Map(),
          dedupingInterval: 0,
          shouldRetryOnError: false,
        }}
      >
        <Probe />
      </SWRConfig>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await flush();
};

describe("usePickupPoints", () => {
  beforeEach(() => {
    getData.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("читает точки по своему пути и отдаёт список (AC-5)", async () => {
    getData.mockResolvedValue({
      points: [
        { id: "pp-1", name: "Central Pickup", address: "Tverskaya 12" },
      ],
    });

    await render();

    expect(getData).toHaveBeenCalledWith("/pickup-points");
    expect(state()).toMatchObject({
      names: ["Central Pickup"],
      isLoading: false,
      failed: false,
    });
  });

  it("отдаёт пустой список без ошибки, когда точек нет (AC-6)", async () => {
    getData.mockResolvedValue({ points: [] });

    await render();

    expect(state()).toMatchObject({ names: [], failed: false });
  });

  it("поднимает ошибку запроса, чтобы форма показала повтор (AC-6)", async () => {
    getData.mockRejectedValue(new Error("gateway is down"));

    await render();

    expect(state()).toMatchObject({ names: [], failed: true });
  });
});
