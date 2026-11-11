import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { type Cache, SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getData, endSession } = vi.hoisted(() => ({
  getData: vi.fn(),
  endSession: vi.fn(),
}));

vi.mock("@/common/helpers/session", () => ({ endSession }));

vi.mock("./useFetcher", () => ({
  useFetcher: () => ({
    getData,
    deleteItem: vi.fn(),
    patchItem: vi.fn(),
  }),
}));

import { useUser } from "./user/useUser";
import { useSessionCacheReset } from "./useSessionCacheReset";

type Snapshot = { nick: string | null; loading: boolean; calls: number };

const Probe = () => {
  const { profileData, profileIsLoading } = useUser();
  const resetSessionCache = useSessionCacheReset();
  const snapshot: Snapshot = {
    nick: profileData?.nickName ?? null,
    loading: profileIsLoading,
    calls: getData.mock.calls.length,
  };

  return (
    <>
      <span data-state={JSON.stringify(snapshot)} />
      <button
        type="button"
        data-switch
        onClick={() => resetSessionCache({ revalidate: true })}
      />
      <button type="button" data-end onClick={() => resetSessionCache()} />
    </>
  );
};

/** The sign in screen: the store is reset there and no account hook is mounted. */
const SignIn = () => {
  const resetSessionCache = useSessionCacheReset();

  return (
    <button
      type="button"
      data-switch
      onClick={() => resetSessionCache({ revalidate: true })}
    />
  );
};

const Screen = ({ signedIn }: { signedIn: boolean }) =>
  signedIn ? <Probe /> : <SignIn />;

let container: HTMLDivElement;
let root: Root;
let provider: (cache: Readonly<Cache>) => Cache;

const read = (): Snapshot => {
  const node = container.querySelector("[data-state]");

  return JSON.parse(node?.getAttribute("data-state") ?? "{}") as Snapshot;
};

const click = async (selector: string): Promise<void> => {
  await act(async () =>
    container.querySelector<HTMLButtonElement>(selector)?.click(),
  );
  await flush();
};

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/** Re-renders the same provider, so a navigation keeps the SWR global state. */
const render = async (signedIn: boolean): Promise<void> => {
  await act(async () => {
    root.render(
      <SWRConfig value={{ provider }}>
        <Screen signedIn={signedIn} />
      </SWRConfig>,
    );
  });
  await flush();
};

beforeEach(async () => {
  getData
    .mockReset()
    .mockResolvedValue({ nickName: "Alpha", status: "ACTIVE" });
  endSession.mockReset().mockResolvedValue(undefined);

  const store = new Map();
  provider = () => store;

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("useSessionCacheReset", () => {
  it("loads the new account on the first page after a session switch", async () => {
    await render(true);
    expect(read().nick).toBe("Alpha");

    // Sign out: the next account signs in and the content page mounts again.
    await render(false);
    getData.mockResolvedValue({ nickName: "Beta", status: "PENDING" });
    await click("[data-switch]");
    await render(true);

    expect(read()).toEqual({ nick: "Beta", loading: false, calls: 2 });
  });

  it("drops the previous account immediately, without a reload", async () => {
    await render(true);
    expect(read().nick).toBe("Alpha");

    getData.mockResolvedValue({ nickName: "Beta", status: "PENDING" });
    await click("[data-switch]");

    expect(read()).toEqual({ nick: "Beta", loading: false, calls: 2 });
  });

  it("starts no request while the session is ending", async () => {
    await render(true);

    await click("[data-end]");

    expect(read()).toEqual({ nick: null, loading: true, calls: 1 });
  });
});
