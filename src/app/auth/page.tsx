import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = {
  title: "Đăng nhập · Hệ thống ôn thi HSK",
};

// Mockup: docs/mockups/02-dang-nhap.png
export default function AuthPage() {
  return (
    <main className="flex flex-1 justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        {/* AuthForm đọc ?mode, ?next, ?error trên URL nên cần nằm trong Suspense */}
        <Suspense fallback={<div className="h-96" />}>
          <AuthForm />
        </Suspense>
      </div>
    </main>
  );
}
