import { cva } from "class-variance-authority";

export const stepperWidth = cva("w-full", {
  variants: {
    size: {
      full: "",
      sm: "sm:w-[14rem]",
    },
  },
  defaultVariants: {
    size: "full",
  },
});

export type StepperSize = "full" | "sm";
