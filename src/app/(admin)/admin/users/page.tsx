import type { Metadata } from "next";
import { PageTitle } from "@/components/app-shell/page-title";

export const metadata: Metadata = { title: "Người dùng · Quản trị" };

// Trang tạm, sẽ làm ở các nhiệm vụ sau.
export default function AdminUsersPage() {
  return <PageTitle eyebrow="Quản trị" title="Người dùng" />;
}
