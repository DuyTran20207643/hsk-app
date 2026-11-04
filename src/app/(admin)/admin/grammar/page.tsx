import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Ngữ pháp · Quản trị" };

// Trang tạm, sẽ làm ở các nhiệm vụ sau.
export default function AdminGrammarPage() {
  return <PageTitle eyebrow="Quản trị" title="Ngữ pháp" />;
}
