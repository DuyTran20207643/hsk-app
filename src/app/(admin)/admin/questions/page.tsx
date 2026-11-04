import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Câu hỏi · Quản trị" };

// Trang tạm, sẽ làm ở các nhiệm vụ sau.
export default function AdminQuestionsPage() {
  return <PageTitle eyebrow="Quản trị" title="Câu hỏi" />;
}
