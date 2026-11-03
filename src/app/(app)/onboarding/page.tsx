import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Đặt mục tiêu ôn thi · Hệ thống ôn thi HSK" };

// Trang tạm. Khi làm thật, bám theo mockup: docs/mockups/03-dat-muc-tieu.png
export default function OnboardingPage() {
  return <PageTitle eyebrow="Chào mừng bạn" title="Đặt mục tiêu ôn thi" />;
}
