import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Ngữ pháp · Hệ thống ôn thi HSK" };

// Trang tạm. Khi làm thật, bám theo mockup: docs/mockups/10-ngu-phap.png
export default function GrammarPage() {
  return <PageTitle eyebrow="Ôn tập" title="Ngữ pháp" />;
}
