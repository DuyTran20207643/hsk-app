import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Trang chủ · Hệ thống ôn thi HSK" };

// Trang tạm. Khi làm thật, bám theo mockup: docs/mockups/04-trang-chu.png
export default function HomePage() {
  return <PageTitle eyebrow="Hôm nay" title="Trang chủ" />;
}
