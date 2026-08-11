# DeepSeek Website Chatbot

Chatbot RAG tự crawl nội dung công khai trên cùng domain, lập chỉ mục cục bộ và chỉ gửi các đoạn liên quan tới DeepSeek. API key chỉ tồn tại ở backend.

## Chạy nhanh

Yêu cầu Node.js 20+.

```bash
npm install
copy .env.example .env
# sửa .env rồi chạy:
npm run index
npm start
```

Tạo `ADMIN_TOKEN` mạnh trong PowerShell:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

## Nhúng vào header website

Mở `/admin.html`, đăng nhập bằng `ADMIN_TOKEN`, cấu hình bot và copy đoạn HTML được tạo tự động.

Dashboard cũng cho phép thêm tối đa 20 URL HTTPS, nhập nội dung kiến thức thủ công và đặt hướng dẫn riêng cho chatbot. Sau khi lưu URL hoặc nội dung, chạy **Lập chỉ mục lại** để đưa chúng vào kho tìm kiếm; hướng dẫn chatbot có hiệu lực ngay.

Đặt đoạn này trước thẻ đóng `</head>` hoặc trong phần custom code/header của CMS:

```html
<script
  src="https://chat.example.com/widget.js"
  data-api-url="https://chat.example.com"
  data-title="Trợ lý tư vấn"
  data-color="#111827"
  defer></script>
```

Thay `chat.example.com` bằng domain backend. `defer` giúp widget không chặn tốc độ tải trang.

## Cấu hình

- `DEEPSEEK_API_KEY`: key bí mật, chỉ đặt trên server; tuyệt đối không viết vào HTML.
- `WEBSITE_URL`: trang bắt đầu crawl. Crawler chỉ theo link cùng origin.
- `ALLOWED_ORIGINS`: danh sách website được phép gọi API, phân cách bằng dấu phẩy.
- `ADMIN_TOKEN`: mật khẩu riêng để gọi reindex thủ công, tối thiểu 32 ký tự.
- `TRUST_PROXY=true`: bật khi backend nằm sau reverse proxy đáng tin cậy như Cloudflare/Nginx.

Reindex thủ công:

```bash
curl -X POST https://chat.example.com/api/admin/reindex -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Bảo mật triển khai

Project đã có: CORS allowlist, rate limit, giới hạn kích thước request, timeout, giới hạn URL crawl cùng domain, Helmet security headers, admin token so sánh constant-time, lọc lịch sử và chống prompt injection ở system prompt.

Trước production cần thêm:

1. Chỉ chạy qua HTTPS; đặt backend sau Cloudflare/WAF hoặc reverse proxy.
2. Lưu `.env` trong secret manager của nền tảng, không commit Git. Đổi key ngay nếu từng bị lộ.
3. Giới hạn ngân sách/rate limit trong tài khoản DeepSeek và theo dõi log chi phí.
4. Không index trang tài khoản, dữ liệu khách hàng hoặc nội dung riêng tư. Crawler hiện chỉ đọc link công khai cùng domain và tôn trọng `robots.txt`.
5. Với nhiều máy/container, thay rate limiter trong bộ nhớ bằng Redis và lưu `data/index.json` trên persistent volume.
6. Không ghi nguyên câu hỏi chứa dữ liệu cá nhân vào log. Sao lưu và cập nhật dependency định kỳ.

Không hệ thống internet nào có thể cam kết “không bao giờ bị hack”, nhưng các lớp trên giảm đáng kể bề mặt tấn công. Dữ liệu động như giá, tồn kho và đơn hàng nên nối qua API có xác thực riêng thay vì crawl.
