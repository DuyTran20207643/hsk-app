import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/app-shell/admin-header";
import { getCurrentUser } from "@/lib/auth/session";

// Khung chung cho mọi trang /admin/*. Kiểm tra vai trò ở phía máy chủ
// (src/proxy.ts đã chặn trước; đây là lớp kiểm tra thứ hai).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Suspense fallback={<p className="text-muted-foreground">Đang kiểm tra quyền truy cập…</p>}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");
  if (user.role !== "admin" || user.status !== "active") redirect("/home");
  return children;
}
