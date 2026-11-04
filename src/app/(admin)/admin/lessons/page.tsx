import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Lộ trình và bài học · Quản trị" };

// Trang tạm, sẽ làm ở các nhiệm vụ sau.
export default function AdminLessonsPage() {
  return <PageTitle eyebrow="Quản trị" title="Lộ trình và bài học" />;
}
