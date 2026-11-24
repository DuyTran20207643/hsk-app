import { redirect } from "next/navigation";

// Các phiên làm bài mở ở /practice/<mã phiên>; bắt đầu phiên mới từ trang Ôn tập.
export default function PracticePage() {
  redirect("/review");
}
