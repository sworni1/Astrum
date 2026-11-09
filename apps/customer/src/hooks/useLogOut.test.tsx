import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import useSWR, { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { endSession } = vi.hoisted(() => ({ endSession: vi.fn() }));

vi.mock("../common/helpers/session", () => ({ endSession }));

import { useLogOut } from "./useLogOut";

const getData = vi.fn();

type Snapshot = { items?: number; calls: number };

const Probe = () => {
  const { data } = useSWR<unknown[]>("/cart", getData);
  const { logOut } = useLogOut();
  const snapshot: Snapshot = {
    items: data?.length,
    calls: getData.mock.calls.length,
  };

  return (
    <>
      <span data-state={JSON.stringify(snapshot)} />
      <button type="button" data-logout onClick={() => void logOut()} />
    </>
  );
};

let container: HTMLDivElement;
let root: Root;

const read = (): Snapshot => {
  const node = container.querySelector("[data-state]");
  return JSON.parse(node?.getAttribute("data-state") ?? "{}") as Snapshot;
};

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

beforeEach(async () => {
  endSession.mockReset().mockResolvedValue(undefined);
  getData.mockReset().mockResolvedValue([{ id: "line-of-alpha" }]);

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Probe />
      </SWRConfig>,
    );
  });
  await flush();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("useLogOut", () => {
  it("drops the whole SWR store before the session ends", async () => {
    expect(read()).toEqual({ items: 1, calls: 1 });

    const button = container.querySelector<HTMLButtonElement>("[data-logout]");
    await act(async () => button?.click());
    await flush();

    expect(endSession).toHaveBeenCalledTimes(1);
    expect(read()).toEqual({ items: undefined, calls: 1 });
  });
});
