import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { NavTabs } from "./nav-tabs";
import { UserMenu } from "./user-menu";

// Thanh trên cùng của các trang học (mockup 04-trang-chu.png)
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-xl">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-2.5 md:grid-cols-[1fr_auto_1fr]">
        <Link href="/home" className="flex w-fit items-center gap-2 text-lg font-semibold">
          <span className="size-7 rounded-lg bg-primary" aria-hidden />
          Ôn thi HSK
        </Link>
        <div className="col-span-2 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1">
          <NavTabs />
        </div>
        <div className="justify-self-end md:col-start-3">
          {/* Thông tin tài khoản đọc từ cookie nên tải sau, không làm chậm cả trang */}
          <Suspense fallback={<div className="size-10 rounded-full bg-muted" />}>
            <UserMenuSlot />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function UserMenuSlot() {
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
