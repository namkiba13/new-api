# 94API: cập nhật ngôn ngữ và giao diện

Repo: namkiba13/new-api. Nhánh: theme/94api.
Gói mã nguồn thay đổi dựa trên c1a876db5e28c955dcfdae2546527dda8aada8a3.
Không chứa bí mật, node_modules hoặc bản build. Chưa push/deploy production.

## Dành cho AI/người phụ trách triển khai

1. Kiểm tra nhánh theme/94api và lưu các thay đổi đang có. So sánh các file trong gói với nhánh hiện tại; không ghi đè mù nếu nhánh đã tiến xa hơn commit nền.
2. Áp dụng các file web/ và e2e/ vào đúng đường dẫn trong repo. Phải cập nhật cả React và thư mục public, không chỉ chép theme tĩnh.
3. Trong web: chạy bun install --frozen-lockfile, bun run test src/features/home/__tests__, bun run build:check.
4. Review rồi commit/push nhánh theme/94api theo quy trình của bạn. Coolify build lại từ nhánh đó.
5. Sau deploy: kiểm tra Home có đúng một topbar, chọn đủ 7 ngôn ngữ, chuyển Light/Dark/System, tải lại trang, kiểm tra điện thoại và mở chuông thông báo. Không tự tạo thông báo giả khi API không có dữ liệu.

## Thay đổi

- Home dùng PublicLayout và topbar gốc; bỏ topbar trùng trong iframe.
- en, vi, fr, ru, ja, zhCN, zhTW cho nội dung landing page, nhãn trợ năng và nút sao chép.
- Dùng i18next và ThemeProvider sẵn có của ứng dụng. Đồng bộ màu resolved light/dark và ngôn ngữ tới iframe; chỉ nhận message từ parent cùng origin.
- Menu ngôn ngữ và chuông có mặt ở mobile. Tránh mở hai notification popover cùng lúc.
- Giữ màu xanh và các nút topbar không bo tròn trên Home.
- Giữ API mẫu, nhãn thương hiệu và nội dung thông báo do quản trị viên viết; không tự dịch dữ liệu API.

## Kiểm chứng tại máy phát triển

- 5 kiểm thử trong 2 file đã đạt; typecheck và production build đạt.
- Trình duyệt thực: đã kiểm tra menu 7 ngôn ngữ, chuyển sang tiếng Việt, giao diện sáng và tối đồng bộ trên Home.
- Lint các file Home/test/theme đạt. Public-header còn 6 lỗi lint có sẵn ngoài phần sửa (nested ternary và array index key); chưa sửa lan sang các đoạn đó.
- Script e2e hiện có đã cập nhật selector iframe; chưa chạy lại toàn bộ ma trận viewport của script này.

Bản xem thử cục bộ dùng cổng 4175; cổng 4174 là bản tĩnh cũ.
