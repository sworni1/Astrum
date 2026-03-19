import type { Metadata } from "next";
import { ProgressBarProvider, ThemeProvider } from "../components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";

export const metadata: Metadata = {
  title: "Astrum",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
