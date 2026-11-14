import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReviewSummary from "@/features/pages/ProductOverview/Reviews/components/ReviewSummary";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("ReviewSummary", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
  });

  const render = async (
    aggregate: Parameters<typeof ReviewSummary>[0]["aggregate"],
  ) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<ReviewSummary aggregate={aggregate} />);
    });

    return container.textContent ?? "";
  };

  it("prints the average with one decimal and the integer shares (AC-3)", async () => {
    const text = await render({
      total: 3,
      averageRating: 4.666,
      distribution: { "5": 2, "3": 1 },
    });

    expect(text).toContain("4.7");
    expect(text).toContain("67%");
    expect(text).toContain("0%");
  });

  it("renders nothing at all when nothing is rated (AC-3)", async () => {
    const text = await render({
      total: 0,
      averageRating: 0,
      distribution: {},
    });

    expect(text).toBe("");
  });
});
