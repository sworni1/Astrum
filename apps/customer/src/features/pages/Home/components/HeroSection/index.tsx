import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Button } from "../../../../../components/ui/button";

const HeroSection = async () => {
  const t = await getTranslations("home");

  return (
    <section className="py-8 antialiased md:py-16">
      <div className="mx-auto grid max-w-screen-xl px-4 pb-8 md:grid-cols-12 lg:gap-12 lg:pb-16 xl:gap-0">
        <div className="content-center justify-self-start md:col-span-7 md:text-start">
          <h1 className="mb-4 text-4xl text-black font-extrabold leading-none tracking-tight dark:text-white md:max-w-2xl md:text-5xl xl:text-6xl">
            {t("heroTitle")}
            <br />
            {t("heroAccent")}
          </h1>
          <p className="mb-4 max-w-2xl text-gray-500 dark:text-gray-400 md:mb-12 md:text-lg lg:mb-5 lg:text-xl">
            {t("heroText")}
          </p>
          <Button>{t("heroCta")}</Button>
        </div>
        <div className="hidden md:col-span-5 md:mt-0 md:flex">
          <Image
            className="dark:hidden"
            src="https://flowbite.s3.amazonaws.com/blocks/e-commerce/girl-shopping-list.svg"
            alt={t("heroImageAlt")}
            width={500}
            height={500}
            unoptimized
          />
          <Image
            className="hidden dark:block"
            src="https://flowbite.s3.amazonaws.com/blocks/e-commerce/girl-shopping-list-dark.svg"
            alt={t("heroImageAlt")}
            width={500}
            height={500}
            unoptimized
          />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
