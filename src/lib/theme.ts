// Chế độ giao diện sáng / tối.
// Lựa chọn của người dùng lưu trong trình duyệt (localStorage, khóa "theme").
// Chưa chọn lần nào thì theo cài đặt của máy.

export const THEME_STORAGE_KEY = "theme";
export type Theme = "light" | "dark";

// Chạy trong <head> TRƯỚC khi trang hiện ra, để không bị chớp sáng khi dùng chế độ tối.
// Nếu người dùng chưa chọn, giao diện tự đổi theo khi máy đổi chế độ sáng / tối.
export const THEME_INIT_SCRIPT = `(function () {
  var root = document.documentElement;
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function saved() {
    try { return localStorage.getItem("${THEME_STORAGE_KEY}"); } catch (e) { return null; }
  }
  function apply() {
    var t = saved();
    root.dataset.theme = t === "dark" || (t !== "light" && media.matches) ? "dark" : "light";
  }
  apply();
  media.addEventListener("change", apply);
})();`;
