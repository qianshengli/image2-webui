import { Toaster } from "sonner";
import "./globals.css";
import { TopNav } from "@/components/top-nav";

export default function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Toaster position="top-center" richColors />
      <main
        className="min-h-screen bg-[#f5f5f3] p-3 text-stone-900 lg:h-dvh lg:overflow-hidden lg:box-border lg:p-4"
        style={{
          fontFamily:
            '"SF Pro Display","SF Pro Text","PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif',
        }}
      >
        <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1680px] flex-col gap-3 lg:h-full lg:min-h-0 lg:flex-row lg:gap-4">
          <TopNav />
          <div className="min-w-0 flex-1 lg:h-full lg:min-h-0">{children}</div>
        </div>
      </main>
    </>
  );
}
