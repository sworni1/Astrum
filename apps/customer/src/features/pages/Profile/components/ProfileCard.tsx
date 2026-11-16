import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  CARD,
  CARD_BODY,
  CARD_BODY_FLUSH,
  CARD_FOOTER,
  CARD_HEADER,
  CARD_TEXT,
  CARD_TITLE,
} from "@/features/pages/Profile/lib/styles";

type Props = {
  title?: string;
  text?: string;
  footer?: ReactNode;
  children?: ReactNode;
  /** Rows draw their own padding, so the body loses its gutters (AC-7). */
  flushBody?: boolean;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
  testId?: string;
};

/**
 * One card of the profile screen: a header, a body and a footer strip, which is
 * the shape every mockup block has (spec 0023, AC-4, AC-5).
 */
const ProfileCard = ({
  title,
  text,
  footer,
  children,
  flushBody = false,
  className,
  titleClassName,
  bodyClassName,
  testId,
}: Props) => {
  const hasHeader = title !== undefined || text !== undefined;

  return (
    <section className={cn(CARD, className)} data-testid={testId}>
      {hasHeader ? (
        <div className={CARD_HEADER}>
          {title !== undefined ? (
            <h2 className={cn(CARD_TITLE, titleClassName)}>{title}</h2>
          ) : null}
          {text !== undefined ? <p className={CARD_TEXT}>{text}</p> : null}
        </div>
      ) : null}

      <div
        className={cn(flushBody ? CARD_BODY_FLUSH : CARD_BODY, bodyClassName)}
      >
        {children}
      </div>

      {footer === undefined ? null : (
        <div className={CARD_FOOTER}>{footer}</div>
      )}
    </section>
  );
};

export default ProfileCard;
