"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { segmentItemClass, segmentTrackClass } from "@/components/ios/segment-styles";

export type NavTab = {
  href: string;
  label: string;
  match?: string[]; // các đường dẫn làm mục này sáng lên (mặc định: href)
};

type Props = { tabs: NavTab[]; label: string };

// Thanh điều hướng dạng segmented control (mockup 04-trang-chu.png, 16a-quan-tri-tu-vung.png)
// Đường dẫn hiện tại chỉ biết khi có người truy cập (trang có mã trong địa chỉ, ví dụ /practice/<mã phiên>),
// nên phần tô sáng mục đang mở nằm trong Suspense; trong lúc chờ thì hiện các mục chưa tô sáng.
export function NavTabs(props: Props) {
  return (
    <Suspense fallback={<TabList {...props} pathname={null} />}>
      <ActiveTabs {...props} />
    </Suspense>
  );
}

function ActiveTabs(props: Props) {
  const pathname = usePathname();
  return <TabList {...props} pathname={pathname} />;
}

function TabList({ tabs, label, pathname }: Props & { pathname: string | null }) {
  return (
    <nav aria-label={label} className={cn(segmentTrackClass, "overflow-x-auto")}>
      {tabs.map((tab) => {
        const active =
          pathname !== null && (tab.match ?? [tab.href]).some((p) => pathname === p || pathname.startsWith(`${p}/`));
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
