import "@/app/index.css";
import { verifySession } from "../../common/helpers/session";
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
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
