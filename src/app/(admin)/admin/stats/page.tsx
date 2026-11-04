import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Thống kê · Quản trị" };

// Trang tạm, sẽ làm ở các nhiệm vụ sau.
export default function AdminStatsPage() {
  return <PageTitle eyebrow="Quản trị" title="Thống kê" />;
}
