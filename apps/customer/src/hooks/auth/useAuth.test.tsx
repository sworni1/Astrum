import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import useSWR, { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { post, createSession, showToast, push, refresh } = vi.hoisted(() => ({
  post: vi.fn(),
  createSession: vi.fn(),
  showToast: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("../../common", () => ({ showToast }));

vi.mock("../../common/helpers/session", () => ({ createSession }));

vi.mock("../useFetcher", () => ({
  useFetcher: () => ({ fetcher: { post } }),
  resetSessionEnded: vi.fn(),
}));

import { useAuth } from "./useAuth";

const getData = vi.fn();

type Snapshot = { nick?: string; calls: number };

const Probe = () => {
  const { data } = useSWR<{ nickName: string }>("/users/me", getData);
  const { handleSignIn } = useAuth();
  const snapshot: Snapshot = {
    nick: data?.nickName,
    calls: getData.mock.calls.length,
  };

  return (
    <>
      <span data-state={JSON.stringify(snapshot)} />
      <button
        type="button"
        data-submit
        onClick={() =>
          void handleSignIn({
            email: "beta@example.com",
            password: "Test12345",
          })
        }
      />
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
  post.mockReset().mockResolvedValue({ status: 200, data: { token: "new" } });
  createSession.mockReset().mockResolvedValue(undefined);
  showToast.mockReset();
  push.mockReset();
  refresh.mockReset();
  getData.mockReset().mockResolvedValue({ nickName: "Alpha" });

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

describe("useAuth sign in", () => {
  it("drops the whole SWR store when another account signs in", async () => {
    expect(read()).toEqual({ nick: "Alpha", calls: 1 });

    const button = container.querySelector<HTMLButtonElement>("[data-submit]");
    await act(async () => button?.click());
    await flush();

    expect(read().nick).toBeUndefined();
  });

  it("writes the cookie before it clears the store and re-renders the server", async () => {
    const order: string[] = [];
    createSession.mockImplementation(() => {
      order.push("createSession");
      return Promise.resolve();
    });
    refresh.mockImplementation(() => order.push("refresh"));
    push.mockImplementation(() => order.push("push"));

    const button = container.querySelector<HTMLButtonElement>("[data-submit]");
    await act(async () => button?.click());
    await flush();

    expect(createSession).toHaveBeenCalledWith("new");
    expect(order).toEqual(["createSession", "refresh", "push"]);
    expect(showToast).toHaveBeenCalledWith({
      title: "signInSuccessTitle",
      type: "success",
      description: "signInSuccessText",
    });
  });
});
