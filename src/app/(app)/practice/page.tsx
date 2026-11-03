import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Ôn tổng hợp · Hệ thống ôn thi HSK" };

// Trang tạm. Khi làm thật, bám theo mockup: docs/mockups/07-on-tong-hop.png
export default function PracticePage() {
  return <PageTitle eyebrow="Ôn tập" title="Ôn tổng hợp" />;
}
