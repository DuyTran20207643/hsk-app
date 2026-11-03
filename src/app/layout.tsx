import type { Metadata } from "next";
import { Be_Vietnam_Pro, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

// Font chính cho giao diện tiếng Việt.
const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

// Font cho chữ Hán (giản thể). Google Fonts tự chia nhỏ file theo dải ký tự,
// trình duyệt chỉ tải phần chứa chữ thực sự xuất hiện, nên không cần preload.
const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  weight: "variable",
  preload: false,
});

export const metadata: Metadata = {
  title: "Hệ thống ôn thi HSK",
  description: "Website giúp người Việt tự ôn thi HSK cấp 1–3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${notoSansSC.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
