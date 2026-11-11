import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AcmeLogo } from "@/features/general/AcmeLogo";

const Footer = async () => {
  const t = await getTranslations("footer");

  return (
    <footer className="border-t border-border">
      <div className="w-full max-w-screen-xl mx-auto p-4 md:py-8">
        <div className="sm:flex items-center sm:justify-between flex-row">
          <div className="flex items-center space-x-4">
            <Link href="/" className="inline-flex items-center">
              <AcmeLogo />
              <span className="font-bold">Astrum</span>
            </Link>
          </div>
          <ul className="flex flex-wrap items-center mb-6 text-sm font-medium text-gray-500 sm:mb-0 dark:text-gray-400">
            <li>
              <Link href="/about" className="hover:underline me-4 md:me-6">
                {t("about")}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:underline me-4 md:me-6">
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/licensing" className="hover:underline me-4 md:me-6">
                {t("licensing")}
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:underline">
                {t("contact")}
              </Link>
            </li>
          </ul>
        </div>
        <hr className="my-6 border-border sm:mx-auto lg:my-8" />
        <span className="block text-sm text-gray-500 text-center dark:text-gray-400">
          © 2025{" "}
          <Link
            href="/"
            className="hover:underline text-sm text-gray-500 dark:text-gray-400"
          >
            Astrum
          </Link>
          . {t("rights")}
        </span>
      </div>
    </footer>
  );
};

export default Footer;
