import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Lộ trình · Hệ thống ôn thi HSK" };

// Trang tạm. Khi làm thật, bám theo mockup: docs/mockups/05a-lo-trinh.png
export default function RoadmapPage() {
  return <PageTitle eyebrow="Đếm ngược tới ngày thi" title="Lộ trình" />;
}
