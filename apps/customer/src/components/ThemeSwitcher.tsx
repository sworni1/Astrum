"use client";

import { MdInvertColors } from "react-icons/md";
import { useTheme } from "next-themes";

type Props = {
  size?: number;
  onClick?: () => void;
};

export default function ThemeSwitcher({ size = 26, onClick }: Props) {
  const { setTheme, theme } = useTheme();

  const handleChangeTheme =
    onClick || (() => setTheme(theme === "light" ? "dark" : "light"));

  return (
    <MdInvertColors
      size={size}
      className="cursor-pointer text-foreground hover:text-foreground/60 transition-opacity"
      onClick={handleChangeTheme}
    />
  );
}
