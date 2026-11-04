"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { ChevronLeft, CircleX, MailCheck } from "lucide-react";
import { SegmentedControl } from "@/components/ios/segmented-control";
import { Button, buttonVariants } from "@/components/ui/button";
import { URL_ERROR_MESSAGES } from "@/lib/auth/messages";
import { signIn, signUp, type AuthFormState } from "./actions";

// Mockup: docs/mockups/02-dang-nhap.png

type Mode = "signin" | "signup";

const MODE_OPTIONS = [
  { value: "signin", label: "Đăng nhập" },
  { value: "signup", label: "Đăng ký" },
] as const;

const COPY: Record<Mode, { title: string; subtitle: string; submit: string; pending: string }> = {
  signin: {
    title: "Chào mừng trở lại",
    subtitle: "Đăng nhập để tiếp tục lộ trình ôn thi của bạn.",
    submit: "Đăng nhập",
    pending: "Đang đăng nhập…",
  },
  signup: {
    title: "Tạo tài khoản",
    subtitle: "Đăng ký miễn phí để bắt đầu lộ trình ôn thi của bạn.",
    submit: "Đăng ký",
    pending: "Đang tạo tài khoản…",
  },
};

export function AuthForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const urlError = URL_ERROR_MESSAGES[searchParams.get("error") ?? ""];

  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "signin",
  );
  // Giữ nội dung ô nhập khi chuyển tab hoặc khi gửi bị lỗi
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [signInState, signInAction, signInPending] = useActionState<AuthFormState, FormData>(signIn, {});
  const [signUpState, signUpAction, signUpPending] = useActionState<AuthFormState, FormData>(signUp, {});

  const isSignUp = mode === "signup";
  const state = isSignUp ? signUpState : signInState;
  const pending = isSignUp ? signUpPending : signInPending;
  const copy = COPY[mode];
  // Lỗi trên URL (ví dụ tài khoản bị khóa) chỉ hiện khi chưa gửi form lần nào
  const hasSubmitted = Boolean(signInState.error || signUpState.error || signUpState.success);
  const error = state.error ?? (hasSubmitted ? undefined : urlError);

  return (
    <div className="flex flex-col">
      <Link
        href="/"
        className={buttonVariants({ variant: "plain", className: "-ml-3 w-fit gap-0.5 px-2 font-normal" })}
      >
        <ChevronLeft aria-hidden />
        Trang giới thiệu
      </Link>

      <div className="mt-6 flex flex-col items-center text-center">
        <div
          className="flex size-14 items-center justify-center rounded-[14px] bg-primary font-hanzi text-title1 text-primary-foreground"
          lang="zh-CN"
          aria-hidden
        >
          考
        </div>
        <h1 className="mt-4 text-large-title">{copy.title}</h1>
        <p className="mt-1 text-subheadline text-muted-foreground">{copy.subtitle}</p>
      </div>

      <SegmentedControl
        className="mt-8"
        label="Chọn đăng nhập hoặc đăng ký"
        options={MODE_OPTIONS}
        value={mode}
        onChange={setMode}
      />

      <form
        action={isSignUp ? signUpAction : signInAction}
        noValidate
        className="mt-6 flex flex-col"
      >
        <input type="hidden" name="next" value={next} />

        {/* Nhóm ô nhập kiểu danh sách iOS */}
        <div className="overflow-hidden rounded-xl bg-card">
          {isSignUp && (
            <Field
              label="Họ tên"
              name="fullName"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={setFullName}
            />
          )}
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="ban@email.com"
            value={email}
            onChange={setEmail}
          />
          <Field
            label="Mật khẩu"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            placeholder="Ít nhất 8 ký tự"
            value={password}
            onChange={setPassword}
          />
        </div>

        <div aria-live="polite">
          {error && (
            <p className="mt-4 flex gap-2 rounded-xl bg-red-fill px-4 py-3 text-subheadline text-destructive">
              <CircleX className="mt-px size-5 shrink-0" aria-hidden />
              {error}
            </p>
          )}
          {isSignUp && signUpState.success && (
            <p className="mt-4 flex gap-2 rounded-xl bg-secondary px-4 py-3 text-subheadline text-primary">
              <MailCheck className="mt-px size-5 shrink-0" aria-hidden />
              {signUpState.success}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" disabled={pending} className="mt-6 w-full">
          {pending ? copy.pending : copy.submit}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `auth-${name}`;
  return (
    // Hàng nhập kiểu iOS: đường phân cách thụt lề, hàng cuối không có
    <div className="group/row pl-4">
      <div className="flex min-h-11 items-center gap-3 border-b border-border pr-4 group-last/row:border-b-0">
        <label htmlFor={id} className="w-24 shrink-0 py-3 text-body">
          {label}
        </label>
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent py-3 text-body outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}
