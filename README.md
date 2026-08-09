# 🏫 Dapodik Checkpoint

**Aplikasi checklist pemantauan progres pemutakhiran Data Pokok Pendidikan (Dapodik)** untuk operator sekolah, dengan dashboard admin, ekspor laporan formal, dan penyimpanan berbasis Google Sheets.

> ⚠️ **Disclaimer** — Aplikasi ini adalah **alat bantu pemantauan checklist** yang dibangun mandiri. **Bukan** aplikasi resmi Dapodik dan **tidak terhubung** langsung ke server Dapodik Kemendikdasmen.

---

## ✨ Fitur

### Operator
- 🔐 Registrasi & login operator (username unik per NPSN).
- 📋 Checklist **12 tahap** pemutakhiran Dapodik per semester (**Ganjil / Genap**).
- 🔀 Pilihan **Metode Update** (Installer / Patch) — metode yang tidak dipilih disembunyikan dan **tidak dihitung** dalam progres.
- 🏫 Tahap 8 **Sekolah, Sarana, Prasarana** dengan alert kebutuhan akses Kepala Sekolah.
- 💾 **Auto-save** tiap 10 menit (saat aktif) + simpan manual + flush saat halaman ditutup.
- 🗂️ **Riwayat** snapshot per periode + **perbandingan dua periode**.
- 📤 **Ekspor** laporan checklist ke **Excel (.xlsx)** & **PDF** (layout formal + ruang tanda tangan).
- 👤 Profil lengkap: data pengguna, data Kepala Sekolah, NIP/NIY, status kepegawaian (PNS/Non-PNS), ganti password.

### Admin
- 📊 Dashboard statistik: total pengguna, operator, sekolah unik, snapshot, sudah/belum mulai.
- ➕ Tambah user baru dengan role **operator / admin**.
- 🔑 Reset password, 🗑️ reset checklist, 💣 reset database per user.
- 📈 **Ekspor rekap** operator + sekolah + progres terakhir (Excel/PDF).

### Umum
- ⏰ Countdown **Batas Akhir Pengiriman Data BOSP** di landing page.
- 🔔 Notifikasi global (toast sukses/gagal + dialog konfirmasi).
- 📱 Responsive (mobile / tablet / desktop).
- 🛡️ Password di-hash (SHA-256 + salt), token sesi ber-expiry.

---

## 🧰 Teknologi

| Lapisan | Teknologi |
|---|---|
| Frontend | HTML/CSS/JS vanilla (tanpa build), GitHub Pages |
| Backend | Google Apps Script (Web App) |
| Database | Google Spreadsheet |
| Ekspor | SheetJS (xlsx), jsPDF + autotable |

---

## 🏗️ Arsitektur

```
[ Browser / GitHub Pages ]
        │  HTTPS (fetch JSON)
        ▼
[ Google Apps Script Web App ]  ← action: login, getMaster, saveProgress, dll.
        │
        ▼
[ Google Spreadsheet ]  (Users, ChecklistMaster, ChecklistProgress,
                         History, SyncLog, Settings)
```

---

## 📁 Struktur Repository

```
dapodik-checkpoint/
├── index.html            # Landing + countdown BOSP
├── login.html            # Login operator/admin
├── register.html         # Registrasi operator
├── dashboard.html        # Dashboard operator
├── checklist.html        # Checklist 12 tahap
├── riwayat.html          # Riwayat + perbandingan
├── profil.html           # Profil operator
├── admin.html            # Dashboard admin
├── admin-profil.html     # Profil admin
├── export.html           # Ekspor laporan
├── css/
│   └── style.css
├── js/
│   ├── config.js         # ⚙️ API_URL & konstanta
│   ├── api.js            # Helper request ke backend
│   ├── auth.js           # Login/register/sesi
│   ├── notifikasi.js     # Toast + dialog konfirmasi
│   ├── tahun-pelajaran.js
│   ├── countdown-bosp.js
│   ├── dashboard.js
│   ├── checklist.js
│   ├── riwayat.js
│   ├── profil.js
│   ├── admin.js
│   ├── admin-profil.js
│   └── export.js
├── assets/
│   └── logo-dapodik.png
├── backend/              # (referensi) salinan kode Apps Script
│   ├── Code.gs
│   └── maintenance.gs
├── docs/
│   ├── PANDUAN_OPERATOR.md
│   └── PANDUAN_ADMIN.md
└── README.md
```

> 💡 Backend berjalan di **Google Apps Script** (tidak di-repo). Folder `backend/` hanyalah salinan referensi untuk version control.

---

## 🚀 Instalasi & Setup

### 1. Database (Google Spreadsheet)
1. Buat spreadsheet baru, beri nama `DB Dapodik Checkpoint`.
2. Buat sheet dengan header:
   - `Users`
   - `ChecklistMaster`
   - `ChecklistProgress`
   - `History`
   - `SyncLog`
   - `Settings`
3. Format kolom `NoHP`, `NPSN`, `NIPOperator`, `NIPKepalaSekolah` sebagai **Plain Text**.

### 2. Backend (Google Apps Script)
1. Buka [script.new](https://script.new) → buat project `Backend Dapodik Checkpoint`.
2. Salin isi `backend/Code.gs` dan `backend/maintenance.gs`.
3. Isi `CONFIG.SPREADSHEET_ID` dengan ID spreadsheet.
4. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Jalankan sekali dari editor:
   - `seedAdmin` → membuat akun `admin` (password sementara tampil di **log**).
   - `installMaintenanceTriggers` → backup harian + laporan mingguan.
6. Salin URL Web App (`.../exec`).

### 3. Frontend (GitHub Pages)
1. Isi `js/config.js`:
   ```js
   API_URL: 'https://script.google.com/macros/s/XXXX/exec'
   ```
2. Push repository ke GitHub.
3. **Settings → Pages → Branch: `main` → Folder: `/ (root)` → Save**.
4. Buka `https://USERNAME.github.io/dapodik-checkpoint/`.

### 4. Login Pertama
- Admin: username `admin` + password sementara dari log → **wajib ganti password**.
- Operator: daftar melalui `register.html`.

---

## 🔌 Endpoint API (Apps Script)

| Action | Kegunaan |
|---|---|
| `ping` | Cek status API |
| `register` | Daftar operator |
| `login` / `validateToken` | Autentikasi & sesi |
| `getMaster` | Ambil checklist master per semester |
| `getProgress` / `saveProgress` | Baca / simpan progres |
| `getHistory` / `saveSnapshot` | Riwayat & snapshot |
| `changePassword` | Ganti password |
| `updateUserData` | Ubah data pengguna |
| `updateProfile` | Ubah data Kepala Sekolah |
| `getAdminStats` / `getAdminRekap` | Statistik & rekap admin |
| `createUserByAdmin` | Admin buat user |
| `resetPassword` | Admin reset password |
| `resetUserChecklist` / `resetUserDatabase` | Admin reset data |

---

## 🗄️ Skema Database (Sheet)

| Sheet | Isi |
|---|---|
| `Users` | Akun, role, data operator/sekolah, kepala sekolah, NIP/NIY |
| `ChecklistMaster` | Item checklist per semester (12 tahap) |
| `ChecklistProgress` | Centang per item per (user+tahun+semester) |
| `History` | Snapshot progres per periode |
| `SyncLog` | Log sinkronisasi & audit admin |
| `Settings` | Konfigurasi umum |

---

## 🛠️ Maintenance

- **Backup otomatis** harian (02:00) ke folder `Dapodik Checkpoint Backups`, retensi 30 hari.
- **Laporan pemakaian** mingguan via email (berbasis `SyncLog`).
- **Kuota Apps Script**: pantau di <https://script.google.com/home/quotas>.
- **Tahun ajaran baru**: progres otomatis per tahun; edit `ChecklistMaster` hanya bila ada perubahan kebijakan.
- Test backup manual: jalankan `testBackupNow`.

---

## 🗺️ Roadmap

- [ ] Migrasi ke **Supabase** bila pengguna/quota meningkat.
- [ ] Notifikasi WhatsApp/email pengingat.
- [ ] PWA offline mode.
- [ ] Ekspor perbandingan periode.

---

## 📄 Lisensi

Internal / edukasi. Gunakan secara bertanggung jawab.

---

## 🙏 Kredit

Dibangun untuk membantu operator sekolah memantau pemutakhiran Dapodik secara rapi dan terstruktur.