import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

vi.mock("@/hooks/user/useUser", () => ({
  useUser: () => ({ deleteAccountTrigger: vi.fn() }),
}));

import DeleteAccountForm from "@/features/pages/Profile/actions/DeleteAccountForm";

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

describe("DeleteAccountForm", () => {
  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("prints the removal card in the destructive line colour (AC-7)", async () => {
    await render(<DeleteAccountForm />);

    const card = container.querySelector("[data-testid='delete-account-card']");

    expect(card).not.toBeNull();
    expect(card?.className).toContain("border-destructive-line");
    expect(card?.querySelector("h2")?.className).toContain(
      "text-destructive-soft",
    );
    expect(container.textContent).toContain("profile.deleteTitle");
    expect(container.textContent).toContain("profile.deleteButton");
  });
});
