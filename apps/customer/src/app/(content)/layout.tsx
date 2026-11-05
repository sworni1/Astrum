import "@/app/index.css";
import { verifySession } from "../../common/helpers/session";
import ConfirmEmailBanner from "../../features/layout/ConfirmEmailBanner";
import Footer from "../../features/layout/Footer";
import Navbar from "../../features/layout/Navbar";

export default async function ContentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await verifySession();
  if (!session) return null;

  return (
    <>
      <ConfirmEmailBanner />
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
