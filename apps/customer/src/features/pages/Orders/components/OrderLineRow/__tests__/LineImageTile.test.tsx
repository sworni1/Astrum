import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import LineImageTile from "@/features/pages/Orders/components/OrderLineRow/LineImageTile";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    onError,
  }: {
    src: string;
    alt: string;
    onError?: () => void;
  }) =>
    createElement("img", {
      "data-line-image": src,
      alt,
      onError,
    }),
}));

describe("LineImageTile", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  const render = async (src: string): Promise<void> => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<LineImageTile src={src} alt="Ручка Parker" />);
    });
  };

  it("печатает картинку, пока она не сломалась (AC-11)", async () => {
    await render("https://cdn.test/pen.png");

    expect(container.querySelector("[data-line-image]")).not.toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("держит иконку вместо пустой картинки (AC-11)", async () => {
    await render("");

    expect(container.querySelector("[data-line-image]")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("заменяет иконкой картинку, которая не загрузилась (AC-11)", async () => {
    await render("https://cdn.test/broken.svg");

    const image = container.querySelector("[data-line-image]");

    await act(async () => {
      image?.dispatchEvent(new Event("error"));
    });

    expect(container.querySelector("[data-line-image]")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
