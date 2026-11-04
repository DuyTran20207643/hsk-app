import { HeaderBar, Logo } from "./header-bar";
import { NavTabs, type NavTab } from "./nav-tabs";
import { ThemeToggle } from "./theme-toggle";
import { UserMenuSlot } from "./user-menu-slot";

const LEARNER_TABS: NavTab[] = [
  { href: "/home", label: "Trang chủ", match: ["/home", "/onboarding"] },
  { href: "/roadmap", label: "Lộ trình" },
  { href: "/review", label: "Ôn tập", match: ["/review", "/practice", "/flashcards", "/vocab", "/grammar"] },
  { href: "/exams", label: "Thi thử" },
  { href: "/progress", label: "Tiến độ" },
];

// Thanh trên cùng của các trang học viên (mockup 04-trang-chu.png)
export function AppHeader() {
  return (
    <HeaderBar
      logo={<Logo href="/home" />}
      center={<NavTabs tabs={LEARNER_TABS} label="Điều hướng chính" />}
      right={
        <>
          <ThemeToggle />
          <UserMenuSlot />
        </>
      }
    />
  );
}
