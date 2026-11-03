"use client";

import Link from "next/link";
import { useTransition } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/auth/actions";

type Props = {
  name: string;
  email: string;
  isAdmin: boolean;
};

// Nút ảnh đại diện góc phải, bấm vào mở menu nhỏ.
export function UserMenu({ name, email, isAdmin }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Tài khoản: ${name}`}
        className="flex size-10 items-center justify-center rounded-full bg-muted text-base font-semibold outline-none hover:bg-border focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {initialOf(name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60 rounded-xl p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5">
            <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
            <span className="block truncate text-xs font-normal">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem className="px-2 py-2" render={<Link href="/admin/words" />}>
            <ShieldCheck aria-hidden />
            Trang quản trị
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="px-2 py-2"
          disabled={pending}
          onClick={() => startTransition(() => signOut())}
        >
          <LogOut aria-hidden />
          {pending ? "Đang đăng xuất…" : "Đăng xuất"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Chữ cái đầu của tên gọi (từ cuối trong họ tên Việt Nam), ví dụ "Trần Quốc Duy" → "D"
function initialOf(name: string) {
  const lastWord = name.trim().split(/\s+/).at(-1) ?? "";
  return (lastWord.charAt(0) || "?").toLocaleUpperCase("vi");
}
