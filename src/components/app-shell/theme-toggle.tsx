"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

// Theo dõi data-theme trên <html> để báo đúng trạng thái cho trình đọc màn hình
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const getIsDark = () => document.documentElement.dataset.theme === "dark";
const getServerIsDark = () => false;

// Công tắc sáng / tối kiểu iOS, đặt bên trái ảnh đại diện.
// Vị trí núm và biểu tượng đổi bằng CSS (class dark:) nên hiện đúng ngay từ đầu, không bị nháy.
// Vùng bấm cao 44px, thanh trượt bên trong nhỏ gọn hơn.
export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getIsDark, getServerIsDark);

  function toggle() {
    const next: Theme = getIsDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Trình duyệt chặn lưu trữ: vẫn đổi giao diện, chỉ không nhớ cho lần sau
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Giao diện tối"
      title="Đổi giao diện sáng / tối"
      onClick={toggle}
      className="group/theme flex min-h-11 min-w-11 items-center justify-center rounded-full px-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {/* Thanh trượt */}
      <span className="relative flex h-6 w-11 items-center rounded-full bg-muted transition-colors group-hover/theme:bg-input/40">
        {/* Núm tròn: bên trái khi sáng, bên phải khi tối */}
        <span className="absolute left-0.5 flex size-5 items-center justify-center rounded-full bg-card shadow-[0_1px_3px_rgb(0_0_0/0.2)] transition-transform duration-200 dark:translate-x-5 dark:bg-[#636366]">
          <Sun className="size-3.5 text-orange dark:hidden" aria-hidden />
          <Moon className="hidden size-3.5 text-foreground dark:block" aria-hidden />
        </span>
      </span>
    </button>
  );
}
