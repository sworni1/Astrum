"use client";

import { Store } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FiPackage } from "react-icons/fi";
import { LuMenu } from "react-icons/lu";
import { MdFavoriteBorder, MdOutlineShoppingCart } from "react-icons/md";
import { TbCategory } from "react-icons/tb";
import { showToast } from "@/common/helpers/showToast";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AcmeLogo } from "@/features/general/AcmeLogo";
import { useGetOrders } from "@/hooks/order/useGetOrders";
import { useGetCart } from "@/hooks/product/useCart/useGetCart";
import { useGetWishlist } from "@/hooks/product/useWishlist/useGetWishlist";
import { useUser } from "@/hooks/user/useUser";
import { MobileMenuSheet } from "./MobileMenuSheet";
import NavItem from "./NavItem";
import Searchbar from "./Searchbar";

export default function Navbar() {
  const t = useTranslations("nav");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { cart, cartIsLoading, cartError } = useGetCart();
  const { wishlist, wishlistIsLoading, wishlistError } = useGetWishlist();
  const {
    orders,
    isLoading: ordersIsLoading,
    error: ordersError,
  } = useGetOrders();
  const { profileData } = useUser();
  const isSeller = profileData?.isSeller === true;

  if (cartError) {
    showToast({
      title: t("cartFailed"),
      type: "error",
    });
  }

  if (ordersError) {
    showToast({
      title: t("ordersFailed"),
      type: "error",
    });
  }

  if (wishlistError) {
    showToast({
      title: t("wishlistFailed"),
      type: "error",
    });
  }

  return (
    <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50 items-center align-middle">
      <div className="flex h-16 items-center px-4 max-w-7xl mx-auto">
        <div className="flex items-center space-x-4">
          <Link href="/" className="inline-flex items-center">
            <AcmeLogo />
            <span className="font-bold hidden sm:flex">Astrum</span>
          </Link>
        </div>

        <div className="flex-1 flex justify-center px-4 mx-3">
          <div className="flex items-center">
            <Searchbar />
          </div>
        </div>

        <div className="hidden sm:flex space-x-6 items-center">
          <NavItem icon={<TbCategory size={25} />} href={"/categories"} />

          <LocaleSwitcher />

          <ThemeSwitcher />

          <NavItem
            icon={<MdFavoriteBorder size={25} />}
            count={wishlist?.length}
            href={"/wishlist"}
            loading={wishlistIsLoading}
          />
          <NavItem
            icon={<MdOutlineShoppingCart size={25} />}
            count={cart?.length}
            href={"/cart"}
            loading={cartIsLoading}
          />
          <NavItem
            icon={<FiPackage size={25} />}
            count={orders?.length}
            href={"/orders"}
            loading={ordersIsLoading}
          />
          {isSeller && (
            <NavItem
              icon={<Store size={25} />}
              href={"/seller/orders"}
              label={t("sales")}
            />
          )}
          <Link href={"/profile"}>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full cursor-pointer"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback>JH</AvatarFallback>
              </Avatar>
            </Button>
          </Link>
        </div>

        <div className="block sm:hidden">
          <div className="relative inline-flex align-middle">
            <LuMenu
              size={25}
              className="relative  rounded-full"
              onClick={() => setSheetOpen(true)}
            />
          </div>

          <MobileMenuSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            wishlistCount={wishlist?.length}
            wishlistIsLoading={wishlistIsLoading}
            cartCount={cart?.length}
            cartIsLoading={cartIsLoading}
            orderCount={orders?.length}
            orderIsLoading={ordersIsLoading}
            isSeller={isSeller}
          />
        </div>
      </div>
    </nav>
  );
}
