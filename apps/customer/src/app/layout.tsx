import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { ProgressBarProvider, ThemeProvider } from "../components/providers";
import "./index.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Astrum",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable)}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="text-gray-900 dark:text-white">
            <ProgressBarProvider>
              {children}
              <Toaster position="bottom-right" richColors />
            </ProgressBarProvider>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
