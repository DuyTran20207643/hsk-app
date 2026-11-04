import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Nút kiểu iOS 16. Mọi cỡ đều có vùng bấm tối thiểu 44×44px.
//   filled : nền tint, chữ trắng — hành động chính
//   tinted : nền tint-fill, chữ tint — hành động phụ nổi bật
//   gray   : nền xám (fill), chữ thường — hành động phụ
//   plain  : không nền, chữ tint — như liên kết
// Dùng cho thẻ <Link>: className={buttonVariants({ variant, size })}
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 font-semibold whitespace-nowrap transition-opacity outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-70 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        filled: "bg-primary text-primary-foreground hover:opacity-90",
        tinted: "bg-secondary text-secondary-foreground hover:opacity-80",
        gray: "bg-muted text-foreground hover:opacity-80",
        plain: "text-primary hover:opacity-70",
        destructive: "bg-red-fill text-destructive hover:opacity-80",
      },
      size: {
        // 50px: nút lớn chiếm cả chiều ngang (Tạo lộ trình, Đăng nhập…)
        lg: "min-h-[50px] rounded-xl px-5 text-headline",
        default: "min-h-11 rounded-xl px-4 text-body",
        sm: "min-h-11 rounded-full px-4 text-subheadline",
        icon: "size-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "filled",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "filled",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
