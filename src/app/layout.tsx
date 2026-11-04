import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_SC } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Font giao diện cho máy không có font hệ thống của Apple (Windows, Android…).
// Thứ tự ưu tiên đầy đủ nằm ở --font-sans trong globals.css.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

// Font cho chữ Hán (giản thể) khi máy không có PingFang SC. Google Fonts tự chia nhỏ
// file theo dải ký tự, trình duyệt chỉ tải phần chứa chữ thực sự xuất hiện.
const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  weight: "variable",
  preload: false,
});

export const metadata: Metadata = {
  title: "Hệ thống ôn thi HSK",
  description: "Website giúp người Việt tự ôn thi HSK cấp 1–3",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: script bên dưới gắn data-theme vào <html> trước khi React chạy
    <html
      lang="vi"
      className={`${inter.variable} ${notoSansSC.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
