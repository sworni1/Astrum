import "@/app/index.css";
import { readSessionUserId } from "@/common/helpers/session";
import ConfirmEmailBanner from "@/features/layout/ConfirmEmailBanner";
import Footer from "@/features/layout/Footer";
import Navbar from "@/features/layout/Navbar";

export default async function ContentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // A visitor renders the shop with no account read mounted at all, so nothing
  // behind the header asks for a session it does not have (spec 0028, AC-13).
  const guest = (await readSessionUserId()) === null;

  return (
    <>
      {guest ? null : <ConfirmEmailBanner />}
      <Navbar guest={guest} />
      {children}
      <Footer />
    </>
  );
}
