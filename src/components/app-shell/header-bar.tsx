import Link from "next/link";

// Khung thanh trên cùng kiểu iOS: nền trong mờ, làm mờ nội dung phía sau,
// đường kẻ mảnh phía dưới. Bố cục: logo | giữa | phải.
export function HeaderBar({
  center,
  right,
  logo,
}: {
  logo: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bar backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-2 lg:grid-cols-[1fr_auto_1fr]">
        {logo}
        {center && (
          <div className="col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1">
            {center}
          </div>
        )}
        <div className="flex items-center gap-2 justify-self-end lg:col-start-3">{right}</div>
      </div>
    </header>
  );
}

// Logo "Ôn thi HSK", có thể kèm nhãn nhỏ (ví dụ QUẢN TRỊ)
export function Logo({ href, badge }: { href: string; badge?: string }) {
  return (
    <Link href={href} className="flex min-h-11 w-fit items-center gap-2 text-headline">
      <span className="size-7 rounded-lg bg-primary" aria-hidden />
      Ôn thi HSK
      {badge && (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-caption font-semibold tracking-wide text-muted-foreground uppercase">
          {badge}
        </span>
      )}
    </Link>
  );
}
