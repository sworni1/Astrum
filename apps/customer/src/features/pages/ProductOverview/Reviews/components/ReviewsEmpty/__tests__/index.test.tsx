import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReviewsEmpty from "@/features/pages/ProductOverview/Reviews/components/ReviewsEmpty";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("ReviewsEmpty", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
  });

  it("renders the honest empty state and no invented review (AC-6)", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<ReviewsEmpty />);
    });

    expect(container.textContent).toContain("emptyTitle");
    expect(container.textContent).toContain("emptyText");
  });
});
