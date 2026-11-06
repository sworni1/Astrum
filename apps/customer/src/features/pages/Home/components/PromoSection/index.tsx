import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

const PromoSection = async () => {
  const t = await getTranslations("home");

  return (
    <section className="px-4 py-8 antialiased md:py-16">
      <div className="mx-auto grid max-w-screen-xl rounded-lg p-4 md:p-8 lg:grid-cols-12 lg:gap-8 lg:p-16 xl:gap-16">
        <div className="lg:col-span-5 lg:mt-0">
          <Link href="/">
            <img
              className="mb-4 h-56 w-56 dark:hidden sm:h-96 sm:w-96 md:h-full md:w-full"
              src="https://flowbite.s3.amazonaws.com/blocks/e-commerce/imac-components.svg"
              alt={t("promoImageAlt")}
            />
            <img
              className="mb-4 hidden dark:block md:h-full"
              src="https://flowbite.s3.amazonaws.com/blocks/e-commerce/imac-components-dark.svg"
              alt={t("promoImageAlt")}
            />
          </Link>
        </div>
        <div className="me-auto place-self-center lg:col-span-7">
          <h1 className="mb-3 text-2xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white md:text-4xl">
            {t("promoTitle")}
          </h1>
          <p className="mb-6 text-gray-500 dark:text-gray-400">
            {t("promoText")}
          </p>
          <Button>{t("promoCta")}</Button>
        </div>
      </div>
    </section>
  );
};

export default PromoSection;
