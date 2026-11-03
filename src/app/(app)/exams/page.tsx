import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Danh sách đề thi · Hệ thống ôn thi HSK" };

// Trang tạm. Khi làm thật, bám theo mockup: docs/mockups/12-danh-sach-de.png
export default function ExamsPage() {
  return <PageTitle eyebrow="Thi thử" title="Danh sách đề thi" />;
}
