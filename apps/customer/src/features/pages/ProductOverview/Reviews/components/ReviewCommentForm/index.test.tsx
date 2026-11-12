import { AxiosError, AxiosHeaders } from "axios";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReviewCommentForm from ".";
import { showToast } from "@/common/helpers/showToast";

const mocks = vi.hoisted(() => ({ trigger: vi.fn(), onCreated: vi.fn() }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/common/helpers/showToast", () => ({ showToast: vi.fn() }));

vi.mock("@/hooks/review/useCreateReviewComment", () => ({
  useCreateReviewComment: () => ({
    createCommentTrigger: mocks.trigger,
    isCreatingComment: false,
  }),
}));

const deferred = () => {
  let resolve: (value: unknown) => void = () => undefined;
  const promise = new Promise((res) => {
    resolve = res;
  });

  return { promise, resolve };
};

const setText = (element: HTMLTextAreaElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;

  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("ReviewCommentForm (spec 0014)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mocks.trigger.mockReset();
    mocks.onCreated.mockReset();
    vi.mocked(showToast).mockClear();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
  });

  const flush = async (): Promise<void> => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const mount = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <ReviewCommentForm reviewId="review-1" onCreated={mocks.onCreated} />,
      );
    });

    return {
      form: container.querySelector("form") as HTMLFormElement,
      field: container.querySelector("textarea") as HTMLTextAreaElement,
      submit: container.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement,
    };
  };

  it("names the field through its label, not the placeholder alone (AC-13)", async () => {
    const { field } = await mount();
    const label = container.querySelector("label");

    expect(label?.textContent).toBe("comments.label");
    expect(label?.getAttribute("for")).toBe(field.id);
  });

  it("refuses four characters and 2001 characters, and enables at five (AC-8, AC-11)", async () => {
    const { field, submit } = await mount();

    await act(async () => setText(field, "four"));
    expect(submit.disabled).toBe(true);

    await act(async () => setText(field, "a".repeat(2001)));
    expect(submit.disabled).toBe(true);

    await act(async () => setText(field, "  five!  "));
    expect(submit.disabled).toBe(false);
  });

  it("counts the trimmed body, so five spaces are refused (AC-8)", async () => {
    const { field, submit } = await mount();

    await act(async () => setText(field, "     "));

    expect(submit.disabled).toBe(true);
  });

  it("sends the trimmed body once and reports the answer (AC-8, AC-11)", async () => {
    mocks.trigger.mockResolvedValue({
      comment: { id: "comment-1" },
      commentCount: 1,
    });
    const { field, submit, form } = await mount();

    await act(async () => setText(field, "  a valid reply  "));
    await act(async () => {
      form.requestSubmit(submit);
    });
    await flush();

    expect(mocks.trigger).toHaveBeenCalledTimes(1);
    expect(mocks.trigger).toHaveBeenCalledWith({ body: "a valid reply" });
    expect(mocks.onCreated).toHaveBeenCalledWith({
      comment: { id: "comment-1" },
      commentCount: 1,
    });
    expect(showToast).toHaveBeenCalledWith({
      title: "comments.saved",
      type: "success",
    });
  });

  it("sends no second request while the first one is in flight (AC-11)", async () => {
    const pending = deferred();
    mocks.trigger.mockReturnValue(pending.promise);
    const { field, submit, form } = await mount();

    await act(async () => setText(field, "a valid reply"));
    await act(async () => {
      form.requestSubmit(submit);
    });
    await act(async () => {
      form.requestSubmit(submit);
    });
    await flush();

    expect(mocks.trigger).toHaveBeenCalledTimes(1);

    // Released, so the module's send lock is free for the next test.
    await act(async () => {
      pending.resolve({ comment: { id: "comment-1" }, commentCount: 1 });
    });
    await flush();
  });

  it("keeps the typed text and raises the rate limit copy (AC-9)", async () => {
    const refused = new AxiosError(
      "refused",
      "ERR_BAD_REQUEST",
      { headers: new AxiosHeaders() } as never,
      null,
      {
        status: 429,
        statusText: "refused",
        data: { code: "REVIEW_COMMENT_RATE_LIMITED" },
        headers: {},
        config: { headers: new AxiosHeaders() } as never,
      },
    );
    mocks.trigger.mockRejectedValue(refused);
    const { field, submit, form } = await mount();

    await act(async () => setText(field, "a valid reply"));
    await act(async () => {
      form.requestSubmit(submit);
    });
    await flush();

    expect(field.value).toBe("a valid reply");
    expect(mocks.onCreated).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      title: "comments.refused.rateLimited",
      type: "error",
    });
  });
});
