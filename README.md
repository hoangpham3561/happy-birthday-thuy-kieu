# Happy Birthday — Thuý Kiều

Website quà sinh nhật cho **Thuỳ Trang (Thuý Kiều)** — static HTML/CSS/JS, sẵn sàng deploy Vercel.

## Flow

1. Nhập mật khẩu `0709`
2. Lời giới thiệu
3. Ảnh rơi xuống tạo hình bánh kem
4. Thiệp lời chúc + nút **Quà bất ngờ**
5. Finale: chữ/ảnh mưa nền + gallery kéo xoay

## Chạy local

```bash
cd happy_birdthday
python3 -m http.server 5173
# hoặc: npm start
```

Mở http://localhost:5173

## Deploy Vercel

1. Import repo trên [vercel.com/new](https://vercel.com/new)
2. Framework Preset: **Other**
3. Build Command: để trống
4. Output Directory: để trống (`.` / root)
5. Deploy

Hoặc CLI:

```bash
npx vercel
```

## Tuỳ chỉnh (`js/config.js`)

- `password` — mật khẩu
- `name` / `nickname`
- `intro` — lời giới thiệu
- `letter` — nội dung thiệp
- `fallingTexts` — chữ rơi màn cuối
- `photos` — danh sách ảnh trong `photos/`
- Nhạc: đặt file `music/bg.mp3`
