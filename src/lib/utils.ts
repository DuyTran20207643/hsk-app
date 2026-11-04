import { createCn } from "cn/config"

// Gộp class Tailwind (bỏ class trùng, class sau thắng class trước).
// Khai báo thêm thang chữ iOS (text-headline, text-body…) là CỠ CHỮ,
// nếu không cn sẽ hiểu nhầm là màu chữ và xóa mất class màu (ví dụ text-primary-foreground).
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "large-title",
            "title1",
            "title2",
            "title3",
            "headline",
            "body",
            "subheadline",
            "footnote",
            "caption",
          ],
        },
      ],
    },
  },
})
