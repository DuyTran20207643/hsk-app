import { HeaderBar, Logo } from "./header-bar";
import { NavTabs, type NavTab } from "./nav-tabs";
import { ThemeToggle } from "./theme-toggle";
import { UserMenuSlot } from "./user-menu-slot";

const ADMIN_TABS: NavTab[] = [
  { href: "/admin/words", label: "Từ vựng" },
  { href: "/admin/questions", label: "Câu hỏi" },
  { href: "/admin/grammar", label: "Ngữ pháp" },
  { href: "/admin/lessons", label: "Lộ trình" },
  { href: "/admin/exams", label: "Đề thi" },
  { href: "/admin/users", label: "Người dùng" },
  { href: "/admin/stats", label: "Thống kê" },
];

// Thanh trên cùng của khu quản trị (mockup 16a-quan-tri-tu-vung.png)
export function AdminHeader() {
  return (
    <HeaderBar
      logo={<Logo href="/admin/words" badge="Quản trị" />}
      center={<NavTabs tabs={ADMIN_TABS} label="Điều hướng quản trị" />}
      right={
        <>
          <ThemeToggle />
          <UserMenuSlot />
        </>
      }
    />
  );
}
