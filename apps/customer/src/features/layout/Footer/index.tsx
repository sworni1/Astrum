import Link from "next/link";
import { AcmeLogo } from "../../general/AcmeLogo";

const Footer = () => {
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
                About
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:underline me-4 md:me-6">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/licensing" className="hover:underline me-4 md:me-6">
                Licensing
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:underline">
                Contact
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
          . All Rights Reserved.
        </span>
      </div>
    </footer>
  );
};

export default Footer;
