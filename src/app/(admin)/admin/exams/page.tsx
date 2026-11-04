import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Đề thi · Quản trị" };

// Trang tạm, sẽ làm ở các nhiệm vụ sau.
export default function AdminExamsPage() {
  return <PageTitle eyebrow="Quản trị" title="Đề thi" />;
}
