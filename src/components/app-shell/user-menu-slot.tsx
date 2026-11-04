import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { UserMenu } from "./user-menu";

// Nút ảnh đại diện. Đọc phiên đăng nhập nên nằm trong Suspense,
// để phần còn lại của trang không phải chờ.
export function UserMenuSlot() {
  return (
    <Suspense fallback={<div className="size-11 rounded-full bg-muted" />}>
      <UserMenuLoader />
    </Suspense>
  );
}

async function UserMenuLoader() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <UserMenu
      name={user.displayName || user.email}
      email={user.email}
      isAdmin={user.role === "admin" && user.status === "active"}
    />
  );
}
