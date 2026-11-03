import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Thẻ từ · Hệ thống ôn thi HSK" };

// Trang tạm. Khi làm thật, bám theo mockup: docs/mockups/08a-the-tu-mat-truoc.png
export default function FlashcardsPage() {
  return <PageTitle eyebrow="Ôn tập" title="Thẻ từ" />;
}
