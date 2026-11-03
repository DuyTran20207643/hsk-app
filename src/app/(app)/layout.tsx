import { AppHeader } from "@/components/app-shell/app-header";

// Khung chung cho các trang cần đăng nhập (đã được src/proxy.ts bảo vệ).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
