// Tiêu đề lớn đầu trang (kiểu iOS); dùng tạm cho các trang chưa làm.
export function PageTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div>
      {eyebrow && (
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-1 text-4xl font-bold tracking-tight">{title}</h1>
    </div>
  );
}
