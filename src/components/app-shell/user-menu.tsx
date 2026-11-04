"use client";

import Link from "next/link";
import { useTransition } from "react";
import { House, LogOut, ShieldCheck } from "lucide-react";
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

// Mỗi mục trong menu cao tối thiểu 44px để dễ bấm
const ITEM_CLASS = "min-h-11 gap-2.5 px-2 text-body [&_svg:not([class*='size-'])]:size-5";

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
        className="flex size-11 items-center justify-center rounded-full bg-muted text-headline outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {initialOf(name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-xl p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5">
            <span className="block truncate text-headline text-foreground">{name}</span>
            <span className="block truncate text-footnote font-normal">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {isAdmin && (
          <>
            <DropdownMenuItem className={ITEM_CLASS} render={<Link href="/home" />}>
              <House aria-hidden />
              Trang học tập
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM_CLASS} render={<Link href="/admin/words" />}>
              <ShieldCheck aria-hidden />
              Trang quản trị
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem
          className={ITEM_CLASS}
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
