import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

// Mọi trang trong /admin/* đều đi qua đây: kiểm tra vai trò ở phía máy chủ.
// (src/proxy.ts cũng đã chặn trước; đây là lớp kiểm tra thứ hai.)
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Đang kiểm tra quyền truy cập…</p>}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");
  if (user.role !== "admin" || user.status !== "active") redirect("/home");
  return children;
}
