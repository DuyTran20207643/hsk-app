import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Tiến độ · Hệ thống ôn thi HSK" };

// Trang tạm. Khi làm thật, bám theo mockup: docs/mockups/11-tien-do.png
export default function ProgressPage() {
  return <PageTitle eyebrow="Kết quả học tập" title="Tiến độ" />;
}
