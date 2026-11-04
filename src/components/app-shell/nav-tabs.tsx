"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { segmentItemClass, segmentTrackClass } from "@/components/ios/segment-styles";

export type NavTab = {
  href: string;
  label: string;
  match?: string[]; // các đường dẫn làm mục này sáng lên (mặc định: href)
};

// Thanh điều hướng dạng segmented control (mockup 04-trang-chu.png, 16a-quan-tri-tu-vung.png)
export function NavTabs({ tabs, label }: { tabs: NavTab[]; label: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className={cn(segmentTrackClass, "overflow-x-auto")}>
      {tabs.map((tab) => {
        const active = (tab.match ?? [tab.href]).some(
          (p) => pathname === p || pathname.startsWith(`${p}/`),
        );
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={segmentItemClass(active)}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
