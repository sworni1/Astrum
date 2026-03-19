import "@/app/index.css";
import Navbar from "../../features/layout/Navbar";
import Footer from "../../features/layout/Footer";
import { verifySession } from "../../common/helpers/session";

export default async function ContentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await verifySession();
  if (!session) return null;

  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
