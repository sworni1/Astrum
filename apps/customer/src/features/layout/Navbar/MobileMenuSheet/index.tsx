"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { FiPackage } from "react-icons/fi";
import { MdFavoriteBorder, MdOutlineShoppingCart } from "react-icons/md";
import { TbCategory } from "react-icons/tb";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MobileMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wishlistIsLoading?: boolean;
  wishlistCount?: number;
  cartIsLoading?: boolean;
  cartCount?: number;
  orderCount?: number;
  orderIsLoading?: boolean;
}

export function MobileMenuSheet({
  open,
  onOpenChange,
  wishlistCount,
  wishlistIsLoading,
  cartCount,
  cartIsLoading,
  orderCount,
  orderIsLoading,
}: MobileMenuSheetProps) {
  const { setTheme, theme } = useTheme();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className=" text-gray-900 dark:text-white">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Make changes here</SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 auto-rows-min gap-6">
          <div className="flex-1 space-y-2 p-2">
            <Link
              href="/categories"
              className="flex w-full items-center space-x-3 p-2 rounded-md hover:bg-muted transition"
              onClick={() => onOpenChange(false)}
            >
              <TbCategory size={24} />
              <span>Categories</span>
            </Link>

            <div
              className="p-2 rounded-md hover:bg-muted transition flex items-center space-x-3"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              <ThemeSwitcher size={24} />
              <span>Theme</span>
            </div>

            <Link
              href="/wishlist"
              className="flex w-full items-center space-x-3 p-2 rounded-md hover:bg-muted transition"
              onClick={() => onOpenChange(false)}
            >
              <MdFavoriteBorder size={24} />
              <span>Wishlist</span>
              {wishlistIsLoading
                ? null
                : wishlistCount !== undefined &&
                  wishlistCount > 0 && (
                    <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {wishlistCount}
                    </span>
                  )}
            </Link>

            <Link
              href="/cart"
              className="flex w-full items-center space-x-3 p-2 rounded-md hover:bg-muted transition"
              onClick={() => onOpenChange(false)}
            >
              <MdOutlineShoppingCart size={24} />
              <span>Cart</span>
              {cartIsLoading
                ? null
                : cartCount !== undefined &&
                  cartCount > 0 && (
                    <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
            </Link>

            <Link
              href="/orders"
              className="flex w-full items-center space-x-3 p-2 rounded-md hover:bg-muted transition"
              onClick={() => onOpenChange(false)}
            >
              <FiPackage size={24} />
              <span>Orders</span>
              {orderIsLoading
                ? null
                : orderCount !== undefined &&
                  orderCount > 0 && (
                    <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {orderCount}
                    </span>
                  )}
            </Link>

            <Link
              href="/profile"
              className="flex w-full items-center space-x-2 p-2 rounded-md hover:bg-muted transition"
              onClick={() => onOpenChange(false)}
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback>JH</AvatarFallback>
              </Avatar>
              <span>Profile</span>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
