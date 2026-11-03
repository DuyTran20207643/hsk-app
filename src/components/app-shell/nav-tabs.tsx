"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Các mục trên thanh điều hướng; "match" là những đường dẫn làm mục đó sáng lên.
const TABS = [
  { href: "/home", label: "Trang chủ", match: ["/home", "/onboarding"] },
  { href: "/roadmap", label: "Lộ trình", match: ["/roadmap"] },
  { href: "/review", label: "Ôn tập", match: ["/review", "/practice", "/flashcards", "/vocab", "/grammar"] },
  { href: "/exams", label: "Thi thử", match: ["/exams"] },
  { href: "/progress", label: "Tiến độ", match: ["/progress"] },
];

// Thanh điều hướng dạng segmented control (mockup 04-trang-chu.png)
export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Điều hướng chính" className="flex overflow-x-auto rounded-xl bg-muted p-0.5">
      {TABS.map((tab) => {
        const active = tab.match.some((p) => pathname === p || pathname.startsWith(`${p}/`));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-[10px] px-3 py-1.5 text-sm whitespace-nowrap transition-colors sm:px-4",
              active ? "bg-card font-semibold shadow-sm" : "text-foreground/80 hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
