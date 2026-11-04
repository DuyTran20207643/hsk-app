import Link from "next/link";
import { HeaderBar, Logo } from "@/components/app-shell/header-bar";
import { HanVietChip } from "@/components/ios/chips";
import { WidgetCard } from "@/components/ios/widget-card";
import { buttonVariants } from "@/components/ui/button";

// Trang giới thiệu (công khai). Mockup: docs/mockups/01-gioi-thieu.png

const FEATURES = [
  {
    hanzi: "计划",
    title: "Lộ trình đếm ngược",
    text: "Hệ thống chia khối lượng học theo số ngày còn lại đến kỳ thi và tự điều chỉnh khi bạn bỏ lỡ một ngày.",
  },
  {
    hanzi: "汉越",
    title: "Học qua âm Hán Việt",
    text: "Hiểu từ mới nhanh hơn nhờ âm Hán Việt, kèm cảnh báo những từ trông quen nhưng nghĩa đã khác.",
  },
  {
    hanzi: "弱点",
    title: "Biết mình yếu ở đâu",
    text: "Sau mỗi bài, hệ thống chỉ ra dạng câu và chủ đề bạn hay sai, rồi tạo bài ôn riêng cho bạn.",
  },
];

// Ví dụ "Chữ của ngày": chữ gốc 学 và các từ ghép
const WORD_FAMILY = [
  { hanzi: "学生", pinyin: "xuésheng", hanViet: "học sinh", meaning: "học sinh" },
  { hanzi: "同学", pinyin: "tóngxué", hanViet: "đồng học", meaning: "bạn học" },
  { hanzi: "学校", pinyin: "xuéxiào", hanViet: "học hiệu", meaning: "trường học" },
  { hanzi: "留学", pinyin: "liúxué", hanViet: "lưu học", meaning: "du học" },
];

export default function LandingPage() {
  return (
    <>
      <HeaderBar
        logo={<Logo href="/" />}
        right={
          <>
            <Link href="/auth" className={buttonVariants({ variant: "plain", size: "sm" })}>
              Đăng nhập
            </Link>
            <Link href="/auth?mode=signup" className={buttonVariants({ variant: "tinted", size: "sm" })}>
              Đăng ký
            </Link>
          </>
        }
      />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4">
        <section className="mx-auto flex max-w-3xl flex-col items-center py-14 text-center sm:py-20">
          <p className="text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
            Ôn thi HSK 1–3
          </p>
          <h1 className="mt-3 text-[2.375rem] leading-[1.15] font-bold tracking-tight sm:text-[3.25rem]">
            Tự ôn thi HSK cho người Việt, theo đúng ngày thi
          </h1>
          <p className="mt-5 max-w-2xl text-title3 text-muted-foreground">
            Nhập ngày thi, nhận lộ trình học từng ngày. Học từ qua âm Hán Việt, luyện đề đúng cấu
            trúc và biết chính xác mình còn yếu ở đâu.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/auth?mode=signup" className={buttonVariants({ size: "lg" })}>
              Bắt đầu miễn phí
            </Link>
            <Link href="/auth" className={buttonVariants({ variant: "gray", size: "lg" })}>
              Tôi đã có tài khoản
            </Link>
          </div>
        </section>

        <section aria-label="Điểm nổi bật" className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <WidgetCard key={feature.hanzi} className="p-6">
              <p lang="zh-CN" className="font-hanzi text-title1 font-semibold text-primary">
                {feature.hanzi}
              </p>
              <h2 className="mt-2 text-title3 font-semibold">{feature.title}</h2>
              <p className="mt-2 text-body text-muted-foreground">{feature.text}</p>
            </WidgetCard>
          ))}
        </section>

        <section className="mt-12">
          <div className="px-1">
            <h2 className="text-title2 font-bold">Thử ngay: Chữ của ngày</h2>
            <p className="text-subheadline text-muted-foreground">
              Một chữ gốc mở ra cả nhóm từ, đọc theo âm Hán Việt là đoán được nghĩa.
            </p>
          </div>
          <WidgetCard className="mt-3 flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
            <div className="flex flex-col items-center gap-2 sm:w-40">
              <span lang="zh-CN" className="font-hanzi text-[5rem] leading-none font-semibold">
                学
              </span>
              <HanVietChip>học · xué</HanVietChip>
            </div>
            <ul className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
              {WORD_FAMILY.map((word) => (
                <li
                  key={word.hanzi}
                  className="flex flex-col items-center rounded-xl bg-background px-2 py-3 text-center"
                >
                  <span lang="zh-CN" className="font-hanzi text-title1">
                    {word.hanzi}
                  </span>
                  <span className="font-hanzi text-footnote text-muted-foreground">{word.pinyin}</span>
                  <span className="mt-1 text-subheadline font-semibold text-primary">{word.hanViet}</span>
                  <span className="text-subheadline">{word.meaning}</span>
                </li>
              ))}
            </ul>
          </WidgetCard>
        </section>

        <footer className="py-12 text-center text-footnote text-muted-foreground">
          Đồ án tốt nghiệp · Hệ thống quản trị ôn thi HSK
        </footer>
      </main>
    </>
  );
}
