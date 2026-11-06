# Satoshi — Bitcoin, dipahami.

Dashboard Bitcoin berbahasa Indonesia dengan React, TypeScript, dan Vite. Mendukung **GitHub Pages tanpa server backend**, serta mode pengembangan Express. Harga, berita, dan analisis memiliki sumber serta timestamp. Data simulasi hanya muncul setelah pengguna memilih demo atau membuka situs dengan `?demo=1`.

## Publikasi GitHub Pages

Kode disimpan di repositori `DJmaster94/anjay`. Alamat bawaan situs Pages untuk repo ini adalah **https://djmaster94.github.io/anjay/**. Alamat tersebut aktif setelah konfigurasi Pages dan workflow publikasi berhasil; keberadaan kode di GitHub saja tidak mengaktifkan situs.

1. Pada GitHub, buka **Settings → Pages → Build and deployment → Source**, lalu pilih **GitHub Actions**.
2. Workflow **Publish Satoshi to GitHub Pages** berjalan otomatis setiap push ke `main`. Jika Source baru diaktifkan setelah push, buka **Actions → Publish Satoshi to GitHub Pages → Run workflow**.
3. Tunggu job deploy berhasil. Tautan hasil publikasi tersedia pada environment `github-pages`.

Workflow berada di `.github/workflows/pages.yml`. Actions memakai token bawaan GitHub, sehingga tidak membutuhkan token tambahan atau akun hosting lain. Versi action dikunci ke SHA resmi. Pemilihan Source Pages memerlukan akses pengaturan repo; token bawaan workflow tidak dapat mengaktifkan Pages untuk pertama kali.

Pada versi Pages:

- Browser mengambil harga, candle, dan arus transaksi dari API publik Binance/Coinbase setiap 60 detik selama halaman terbuka. Indikator serta probabilitas memakai modul perhitungan yang sama dengan server.
- Analisis harian berganti setelah candle harian UTC selesai dan permintaan data berikutnya berhasil, sekitar 07.00 WIB.
- GitHub Actions mengambil RSS dan menyimpan arsip harian dengan jadwal 10 menit. Jadwal GitHub bersifat best effort dan dapat terlambat; timestamp dan peringatan snapshot lama tetap ditampilkan.
- Arsip dipertahankan melalui cache harian Actions. Jika cache dihapus atau kedaluwarsa, arsip mulai terkumpul kembali. Harga live tidak bergantung pada cache Actions.
- Jika API browser gagal, snapshot harga terakhir diberi label **DATA TERTUNDA**. Tidak ada pergantian diam-diam ke data demo.
- Semua aset dan snapshot menggunakan base path proyek `/anjay/`. Untuk repo atau domain lain, set `PAGES_BASE_PATH` pada build; workflow mengisinya dari metadata Pages.

Menjalankan build Pages secara lokal:

```bash
npm ci
npm run snapshot:pages
npm run build:pages
npm run preview:pages
```

Preview statis memakai port 4176 dengan path `/anjay/`. `snapshot:pages` membutuhkan akses jaringan ke sumber berita/pasar; berkas hasilnya berada di `public/data/` dan tidak dimasukkan ke commit. Build Pages berada di `dist-pages/`.

## Menjalankan

Gunakan Node.js **22.12+** (divalidasi pada Node 24) dan npm. Tidak memerlukan API key atau database eksternal.

```bash
cd /workspace/anjay
npm ci
npm run dev
```

Server pengembangan menggunakan port **5173**, dengan API di **3001**. Frontend meneruskan `/api` ke backend. Kedua proses dijalankan oleh `concurrently`.

Preview yang tertanam di GPT diizinkan melalui CSP `frame-ancestors`; daftar origin ada di `config/preview.json` dan dipakai bersama oleh Vite serta Express. Origin lain tetap dibatasi. Port 3001 juga menyajikan build frontend jika `dist/index.html` tersedia, sehingga preview yang memilih port API tidak mendapat halaman 404. Saat mengembangkan antarmuka, gunakan port 5173 untuk hot reload; tampilan di port 3001 mengikuti build terakhir. Bila build belum tersedia, server memberi pesan 503 yang menjelaskan langkah menjalankannya.

Build produksi:

```bash
npm run build
npm start
```

Pada produksi, Express melayani frontend dan API pada satu port, default **3001**. Atur `PORT` melalui environment untuk menggantinya. `.env.example` mendokumentasikan variabel; berkas `.env` tidak dimuat otomatis. Ekspor variabel di shell atau konfigurasi layanan.

## Fitur

- Harga, perubahan, rentang, dan volume 24 jam; pembaruan otomatis setiap 60 detik.
- Grafik interaktif 24 jam, 7 hari, 30 hari, dan 90 hari, tooltip, serta overlay S1/R1.
- Analisis harian dengan RSI Wilder 14, ATR Wilder 14, SMA 20/50, EMA 20, MACD (selisih EMA 12/26), dan tren.
- Support/resistance pivot klasik dari candle harian sebelumnya yang sudah tertutup; dua skenario bersyarat dengan target dan invalidasi.
- Estimasi arah dari 50 pola historis terdekat, interval Wilson 95%, dan evaluasi walk-forward tanpa data masa depan.
- Volume taker beli/jual dan sampel agregat transaksi Binance. **Bukan jumlah orang unik** atau gambaran seluruh bursa.
- Berita Bitcoin dari RSS CoinDesk dan Cointelegraph, filter kategori, pencarian, ringkasan, serta tautan sumber.
- Interpretasi seluruh candle tertutup dengan perubahan open-to-close ≥1% per jam dalam 72 jam terakhir, diurutkan menurut besarnya perubahan. Fakta, hipotesis, dan skenario masa depan ditampilkan terpisah.
- Salin ringkasan, ekspor JSON, arsip laporan harian, dialog metodologi, dan tata letak responsif.

## Sumber dan akses jaringan

| Domain | Kegunaan |
| --- | --- |
| `data-api.binance.vision` | API publik Binance: ticker BTC/USDT, candle harian/jam, dan `aggTrades` |
| `api.exchange.coinbase.com` | Cadangan harga dan candle BTC/USD |
| `www.coindesk.com` | RSS berita |
| `cointelegraph.com` | RSS berita |
| `registry.npmjs.org` | Instalasi dependensi |

Domain API/RSS harus diizinkan pada pengaturan jaringan cloud. Pada pengembangan awal, akses ini masih diblokir. Setelah lingkungan dipublikasikan dan dipulihkan, izin jaringan telah aktif: pada 6 November 2026, endpoint live berhasil mengembalikan HTTP 200 dengan harga Binance, analisis harian, dan 21 artikel berita. Server perlu dijalankan kembali setelah mesin dipulihkan; proses yang berjalan tidak ikut tersimpan dalam snapshot. Menyimpan draft konfigurasi saja tidak mengaktifkan izin pada mesin.

Server mengikuti `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, dan trust TLS yang disediakan lingkungan melalui Undici. Verifikasi TLS tetap aktif. Tidak ada token yang diperlukan untuk endpoint publik ini. Binance dapat membatasi akses geografis/rate limit; Coinbase menjadi cadangan. Jika keduanya gagal, API mengembalikan 503, atau menyajikan cache terdahulu yang diberi label kedaluwarsa setelah 90 detik. Angka simulasi tidak pernah dipakai sebagai fallback live.

Binance menggunakan **USDT**, bukan USD fiat; UI menyatakan pasangan tersebut. Coinbase menggunakan **USD**, tidak menyediakan order flow dalam integrasi ini, dan nilai volume kuotasinya merupakan estimasi volume BTC × harga terkini. Jumlah agregat transaksi dan volume berasal dari jendela berbeda yang ditampilkan pada tab Aktivitas pasar.

## Pembaruan harian dan arsip

Scheduler backend berjalan setiap 60 detik selama proses server aktif. Setelah candle UTC berganti, analisis hari baru dihitung pada pembaruan berhasil berikutnya sekitar **07.00 WIB / 00.00 UTC**. Candle yang masih berjalan tidak digunakan untuk analisis harian atau penjelasan gerakan besar.

Laporan live disimpan atomik di `.cache/daily/`; ubah `ANALYSIS_CACHE_DIR` untuk menggunakan volume persisten pada hosting. API arsip menampilkan paling banyak 30 laporan terbaru. Riwayat tidak diisi mundur atau dibuat-buat. Mode demo tidak menulis arsip. Server harus tetap hidup untuk pembaruan tanpa pengunjung; proses tidak ikut tersimpan di snapshot lingkungan. Gunakan layanan Node yang selalu aktif di hosting jika menginginkan operasi 24 jam.

RSS diambil maksimal setiap 10 menit. Kategori berita menggunakan kata kunci. Artikel dalam ±6 jam dari pergerakan ditautkan sebagai konteks, **bukan bukti sebab akibat**. Judul dan ringkasan mengikuti bahasa asli penerbit. Tidak ada layanan AI berbayar di balik penjelasan; narasi analisis bersifat deterministik dan dapat diperiksa di `server/analysis.mjs`.

## Metode probabilitas

Untuk setiap hari historis, fitur dihitung hanya dari penutupan yang sudah diketahui: RSI/25, deviasi terhadap SMA20 ×20, return 7 hari ×10, dan ATR/harga ×20. Pilih 50 tetangga terdekat berdasarkan jarak Euclidean. Proporsi hari berikutnya yang naik menjadi estimasi; penutupan tanpa perubahan dikecualikan. Minimal 150 candle diperlukan. Data harian yang berlubang menunda analisis.

Horizon adalah **penutupan hari UTC berikutnya dibanding penutupan terakhir**, bukan harga saat ini. Evaluasi walk-forward sampai 90 hari memakai hanya label yang telah tersedia saat prediksi. UI memperlihatkan akurasi model, baseline kelas mayoritas, dan Brier score. Interval Wilson mengasumsikan sampel independen, sementara pasar dapat berkorelasi: hasil bukan probabilitas terkalibrasi atau jaminan keuntungan.

## Validasi

```bash
npm test
npm run build
npm run test:e2e
npm run test:e2e:pages
```

Unit test mencakup indikator, pivot, candle yang belum selesai, celah data, probabilitas kedua arah, parser RSS, adapter kedua bursa, dan penolakan ticker lama. Playwright menjalankan build produksi pada port 4173 dan memeriksa desktop/mobile, interaksi grafik, ekspor, modal, filter berita, data kedaluwarsa, kegagalan live, iframe dari origin GPT, serta penolakan iframe dari situs lain. Pengujian iframe menggunakan origin virtual yang seluruh permintaannya dicegat secara lokal; tidak mengirim data ke GPT.

Playwright memakai `/usr/bin/chromium` bila tersedia. Di mesin lain, jalankan `npx playwright install chromium` atau atur `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Proses test menonaktifkan scheduler jaringan dengan `DISABLE_SCHEDULER=1`.

Lima pengujian khusus Pages menjalankan situs statis tanpa Express: base path proyek, analisis API browser, pembaruan harga, arsip/berita, dan fallback snapshot. Mock data hanya dipakai oleh pengujian.

Endpoint pemeriksaan:

- `GET /api/health` — kesiapan proses, bukan konfirmasi koneksi pasar.
- `GET /api/dashboard?mode=live` — data pasar; periksa status HTTP, `meta.stale`, `meta.analysisStale`, serta error RSS.
- `GET /api/dashboard?mode=demo` — data sintetis eksplisit.
- `GET /api/history` — arsip harian dari data live yang pernah berhasil diambil.

## Struktur

- `src/App.tsx`, `src/styles.css` — antarmuka dan interaksi.
- `src/types.ts` — kontrak data frontend.
- `server/providers.mjs` — integrasi, validasi, dan parser sumber eksternal.
- `shared/market.mjs`, `shared/dashboard.mjs` — adapter pasar dan bentuk data yang dipakai server serta browser.
- `src/data.ts` — pemilihan sumber data untuk mode server atau GitHub Pages.
- `scripts/generate-pages-data.mjs` — pembuatan snapshot RSS dan arsip Pages.
- `.github/workflows/pages.yml` — build, pembaruan snapshot, dan publikasi otomatis.
- `server/analysis.mjs` — indikator, probabilitas, level, serta interpretasi gerakan.
- `server/service.mjs` — cache, penjadwalan, dan arsip.
- `server/demo.mjs` — data demonstrasi deterministik dengan label simulasi.
- `tests/` — unit dan pengujian browser.

Status publikasi yang sebenarnya dapat diperiksa pada tab Actions dan environment `github-pages` di GitHub. Berkas `wahyudi` bawaan repositori dipertahankan.
