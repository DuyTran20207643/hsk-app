import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Sổ từ · Hệ thống ôn thi HSK" };

// Trang tạm. Khi làm thật, bám theo mockup: docs/mockups/09-so-tu.png
export default function VocabPage() {
  return <PageTitle eyebrow="Ôn tập" title="Sổ từ" />;
}
