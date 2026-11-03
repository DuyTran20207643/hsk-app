import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Quản trị từ vựng · Hệ thống ôn thi HSK" };

// Trang tạm. Khi làm thật, bám theo mockup: docs/mockups/16a-quan-tri-tu-vung.png
export default function AdminWordsPage() {
  return <PageTitle eyebrow="Quản trị" title="Quản trị từ vựng" />;
}
