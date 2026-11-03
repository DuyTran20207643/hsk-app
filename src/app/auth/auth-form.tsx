"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { URL_ERROR_MESSAGES } from "@/lib/auth/messages";
import { signIn, signUp, type AuthFormState } from "./actions";

type Mode = "signin" | "signup";

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
        className="-ml-1 flex w-fit items-center gap-0.5 text-primary hover:opacity-80"
      >
        <ChevronLeft className="size-5" aria-hidden />
        Trang giới thiệu
      </Link>

      <div className="mt-8 flex flex-col items-center text-center">
        <div
          className="flex size-14 items-center justify-center rounded-2xl bg-primary font-hanzi text-3xl text-primary-foreground"
          lang="zh-CN"
          aria-hidden
        >
          考
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{copy.title}</h1>
        <p className="mt-2 text-muted-foreground">{copy.subtitle}</p>
      </div>

      {/* Segmented control kiểu iOS */}
      <div role="tablist" aria-label="Chọn đăng nhập hoặc đăng ký" className="mt-8 grid grid-cols-2 rounded-xl bg-muted p-0.5">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-[10px] py-2 text-sm transition-colors",
              mode === m ? "bg-card font-semibold shadow-sm" : "text-foreground/80 hover:text-foreground",
            )}
          >
            {m === "signin" ? "Đăng nhập" : "Đăng ký"}
          </button>
        ))}
      </div>

      <form
        action={isSignUp ? signUpAction : signInAction}
        noValidate
        className="mt-6 flex flex-col"
      >
        <input type="hidden" name="next" value={next} />

        {/* Nhóm ô nhập kiểu danh sách iOS */}
        <div className="divide-y divide-border overflow-hidden rounded-xl bg-card">
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
            <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {isSignUp && signUpState.success && (
            <p className="mt-4 rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">
              {signUpState.success}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-6 h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? copy.pending : copy.submit}
        </button>
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
    <div className="flex items-center gap-3 px-4">
      <label htmlFor={id} className="w-24 shrink-0 py-3.5">
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
        className="min-w-0 flex-1 bg-transparent py-3.5 outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
