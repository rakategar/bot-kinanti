# Bot Kinanti 🤖

WhatsApp Bot untuk LMS Kinanti - Menghubungkan guru dan siswa melalui WhatsApp.

## 📋 Fitur

- **Untuk Guru:**
  - Membuat tugas baru
  - Melihat daftar tugas
  - Melihat rekap pengumpulan
  - Broadcast tugas ke siswa

- **Untuk Siswa:**
  - Melihat tugas yang ada
  - Mengumpulkan tugas (foto/PDF)
  - Melihat status pengumpulan
  - Convert gambar ke PDF

## 🚀 Instalasi

### 1. Install Dependencies

```bash
pnpm install
# atau
npm install
```

### 2. Setup Environment

Copy `.env.example` ke `.env` dan isi dengan kredensial yang sesuai:

```bash
cp .env.example .env
```

### 3. Generate Prisma Client

```bash
pnpm prisma:generate
# atau
npx prisma generate
```

### 4. Jalankan Bot

**Cara 1: Buka 2 Terminal (Recommended untuk development)**
```bash
./start.sh
```
Script ini akan membuka 2 terminal sistem:
- Terminal 1: Bot WhatsApp (`node server.js`)
- Terminal 2: Cloudflare Tunnel

**Cara 2: Background Mode (Untuk production/server)**
```bash
./start-bg.sh
```
Menjalankan kedua service di background. Log disimpan di folder `logs/`.

**Cara 3: Manual**
```bash
# Terminal 1 - Bot
node server.js

# Terminal 2 - Cloudflare
cloudflared tunnel --config cloudflared/config.yml run
```

### 5. Stop Bot

```bash
./stop.sh
```

### 5. Scan QR Code

Saat pertama kali dijalankan, scan QR code yang muncul di terminal menggunakan WhatsApp di HP.

## 📁 Struktur Folder

```
bot kinanti/
├── server.js           # Entry point utama
├── package.json        # Dependencies
├── .env               # Environment variables
├── src/
│   ├── client/        # WhatsApp client setup
│   ├── config/        # Konfigurasi (Prisma, Supabase)
│   ├── controllers/   # Logic handler (guru, siswa)
│   ├── features/      # Fitur tambahan (img to pdf)
│   ├── nlp/           # Natural Language Processing
│   ├── services/      # State management, logger
│   └── utils/         # Helper functions
├── routes/
│   └── broadcast.js   # API broadcast untuk web
├── lib/
│   └── assignments.js # Assignment utilities
└── prisma/
    ├── schema.prisma  # Database schema
    └── migrations/    # Database migrations
```

## 🔧 Environment Variables

| Variable | Deskripsi |
|----------|-----------|
| `DATABASE_URL` | URL koneksi PostgreSQL/Supabase |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_KEY` | Service role key Supabase |
| `BOT_SECRET` | Secret untuk API broadcast |
| `PORT` | Port server (default: 4000) |

## 🌐 API Endpoints

### POST `/broadcast`

Broadcast pesan tugas ke siswa.

**Headers:**
```
Authorization: Bearer <BOT_SECRET>
```

**Body:**
```json
{
  "kode": "TGS001",
  "kelas": "XII-RPL-1",
  "siswa": [
    { "phone": "628123456789", "name": "Siswa 1" }
  ],
  "judul": "Tugas Matematika",
  "deadline": "2026-01-30T23:59:00",
  "pdfUrl": "https://..."
}
```

## 🔗 Integrasi dengan Web LMS

Bot ini dirancang untuk berjalan terpisah dari web LMS dan terhubung via API.

Untuk production, gunakan Cloudflare Tunnel atau reverse proxy untuk expose bot ke internet:

```bash
# Cloudflare Tunnel
cloudflared tunnel run kinanti-bot
```

## 📝 Notes

- Bot menggunakan WhatsApp Web JS library
- Session disimpan di folder `.wwebjs_auth/`
- Pastikan Chrome/Chromium terinstall di server

## 🐛 Troubleshooting

1. **QR Code tidak muncul:** Hapus folder `.wwebjs_auth/` dan restart
2. **Database error:** Cek `DATABASE_URL` di `.env`
3. **Broadcast gagal:** Pastikan `BOT_SECRET` sama di web dan bot
