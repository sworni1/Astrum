import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProductGallery from "./index";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, number>) => {
    const messages: Record<string, string> = {
      gallery: "Product image gallery",
      gallerySlide: `Slide ${values?.current} of ${values?.total}`,
      imageAlt: `Product image ${values?.index}`,
      openImage: `Open image ${values?.index}`,
    };

    return messages[key];
  },
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span data-image-source={src} data-image-alt={alt} />
  ),
}));

vi.mock("@/components/ui/carousel", () => ({
  Carousel: ({
    children,
    className,
    "aria-label": ariaLabel,
  }: {
    children: ReactNode;
    className?: string;
    "aria-label"?: string;
  }) => (
    <section className={className} aria-label={ariaLabel}>
      {children}
    </section>
  ),
  CarouselContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  CarouselItem: ({
    children,
    "aria-label": ariaLabel,
  }: {
    children: ReactNode;
    "aria-label"?: string;
  }) => <fieldset aria-label={ariaLabel}>{children}</fieldset>,
  CarouselNext: () => null,
  CarouselPrevious: () => null,
}));

vi.mock("@/components/ui/aspect-ratio", () => ({
  AspectRatio: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("ProductGallery accessibility", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
  });

  it("labels the gallery and each slide with its position", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<ProductGallery images={["first.jpg", "second.jpg"]} />);
    });

    expect(
      container.querySelector('[aria-label="Product image gallery"]'),
    ).not.toBeNull();
    expect(
      Array.from(container.querySelectorAll("[aria-label^='Slide']")).map(
        (slide) => slide.getAttribute("aria-label"),
      ),
    ).toEqual(["Slide 1 of 2", "Slide 2 of 2"]);
  });
});
