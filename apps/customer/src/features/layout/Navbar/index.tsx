"use client";

import { MapPin, Store, Truck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { FiPackage } from "react-icons/fi";
import { LuMenu } from "react-icons/lu";
import { MdFavoriteBorder, MdOutlineShoppingCart } from "react-icons/md";
import { TbCategory } from "react-icons/tb";
import { showLoadFailureOnce } from "@/common/helpers/showLoadFailureOnce";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AcmeLogo } from "@/features/general/AcmeLogo";
import { useGetOrders } from "@/hooks/order/useGetOrders";
import { useGetCart } from "@/hooks/product/useCart/useGetCart";
import { useGetWishlist } from "@/hooks/product/useWishlist/useGetWishlist";
import { useUser } from "@/hooks/user/useUser";
import { hasRole } from "@/hooks/staff/staff.types";
import { MobileMenuSheet } from "./MobileMenuSheet";
import NavItem from "./NavItem";
import Searchbar from "./Searchbar";

type NavbarProps = { guest: boolean };

export default function Navbar({ guest }: NavbarProps) {
  const t = useTranslations("nav");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { cart, cartIsLoading, cartError } = useGetCart();
  const { wishlist, wishlistIsLoading, wishlistError } = useGetWishlist();
  const {
    page: ordersPage,
    isLoading: ordersIsLoading,
    error: ordersError,
  } = useGetOrders({}, { enabled: !guest });
  const { profileData } = useUser({ enabled: !guest });
  const isSeller = profileData?.isSeller === true;
  const staffRoles = profileData?.staffRoles ?? [];

  useEffect(() => {
    showLoadFailureOnce(cartError, t("cartFailed"));
    showLoadFailureOnce(wishlistError, t("wishlistFailed"));
    showLoadFailureOnce(ordersError, t("ordersFailed"));
  }, [cartError, wishlistError, ordersError, t]);

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
          {guest ? null : (
            <NavItem
              icon={<FiPackage size={25} />}
              count={ordersPage?.counts.all}
              href={"/orders"}
              loading={ordersIsLoading}
            />
          )}
          {isSeller && (
            <NavItem
              icon={<Store size={25} />}
              href={"/seller/orders"}
              label={t("sales")}
            />
          )}
          {hasRole(staffRoles, "POINT_WORKER") && (
            <NavItem
              icon={<MapPin size={25} />}
              href={"/point"}
              label={t("point")}
            />
          )}
          {hasRole(staffRoles, "COURIER") && (
            <NavItem
              icon={<Truck size={25} />}
              href={"/courier"}
              label={t("courier")}
            />
          )}
          {guest ? (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href={"/auth/signin"}>{t("signIn")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={"/auth/register"}>{t("register")}</Link>
              </Button>
            </div>
          ) : (
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
          )}
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
            orderCount={ordersPage?.counts.all}
            orderIsLoading={ordersIsLoading}
            isSeller={isSeller}
            staffRoles={staffRoles}
          />
        </div>
      </div>
    </nav>
  );
}
