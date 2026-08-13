/**
 * ============================================================
 * DAPODIK CHECKPOINT - HELPER TAHUN PELAJARAN
 * ============================================================
 * Menyediakan dropdown tahun pelajaran yang otomatis sinkron
 * antar halaman melalui localStorage (uiState).
 *
 * Konvensi tahun pelajaran Indonesia:
 * - Tahun ajaran baru dimulai bulan Juli.
 * - Jika sekarang Juli-Desember, tahun ajaran berjalan adalah:
 *   tahun ini / tahun depan
 * - Jika sekarang Januari-Juni, tahun ajaran berjalan adalah:
 *   tahun kemarin / tahun ini
 * ============================================================
 */

/**
 * Ambil key localStorage untuk uiState
 */
function tpGetStorageKey() {
  if (
    typeof APP_CONFIG !== 'undefined' &&
    APP_CONFIG.STORAGE_KEYS &&
    APP_CONFIG.STORAGE_KEYS.uiState
  ) {
    return APP_CONFIG.STORAGE_KEYS.uiState;
  }

  return 'dapodik_checkpoint_ui_state';
}

/**
 * Ambil uiState dari localStorage
 */
function tpGetCurrentUiState() {
  try {
    const raw = localStorage.getItem(tpGetStorageKey());

    if (!raw) {
      return {};
    }

    return JSON.parse(raw) || {};

  } catch (error) {
    return {};
  }
}

/**
 * Simpan sebagian data ke uiState tanpa menghapus field lain
 */
function tpSaveUiState(patch) {
  try {
    const current = tpGetCurrentUiState();

    const next = Object.assign({}, current, patch);

    localStorage.setItem(
      tpGetStorageKey(),
      JSON.stringify(next)
    );

  } catch (error) {
    console.error('Gagal menyimpan uiState tahun pelajaran.', error);
  }
}

/**
 * Tentukan tahun pelajaran default berdasarkan tanggal sekarang.
 *
 * Contoh:
 * Agustus 2026 -> 2026/2027
 * Februari 2027 -> 2026/2027
 */
function tpGetDefaultTahunFromNow() {
  const now = new Date();

  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const startYear = month >= 7 ? year : year - 1;

  return startYear + '/' + (startYear + 1);
}

/**
 * Buat daftar opsi tahun pelajaran.
 *
 * Default:
 * - 3 tahun ke belakang
 * - 3 tahun ke depan
 */
function tpBuildOptions(rangeBefore, rangeAfter) {
  const now = new Date();

  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const startYear = month >= 7 ? year : year - 1;

  const before = typeof rangeBefore === 'number' ? rangeBefore : 3;
  const after = typeof rangeAfter === 'number' ? rangeAfter : 3;

  const list = [];

  for (let offset = -before; offset <= after; offset++) {
    const y = startYear + offset;

    list.push(y + '/' + (y + 1));
  }

  return list;
}

/**
 * Isi sebuah <select> dengan opsi tahun pelajaran.
 * Jika nilai terpilih tidak ada dalam daftar opsi,
 * nilai tersebut tetap ditambahkan agar tidak hilang.
 */
function tpFillSelect(select, selectedValue) {
  if (!select) {
    return;
  }

  const options = tpBuildOptions(2, 3);

  select.innerHTML = '';

  options.forEach(function (tahun) {
    const opt = document.createElement('option');

    opt.value = tahun;
    opt.textContent = tahun;

    select.appendChild(opt);
  });

  const finalValue = selectedValue || tpGetDefaultTahunFromNow();

  const exists = Array.prototype.some.call(
    select.options,
    function (opt) {
      return opt.value === finalValue;
    }
  );

  if (!exists) {
    const opt = document.createElement('option');

    opt.value = finalValue;
    opt.textContent = finalValue;

    select.appendChild(opt);
  }

  select.value = finalValue;
}

/**
 * Inisialisasi dropdown tahun pelajaran.
 *
 * - Mengambil nilai tersimpan dari localStorage.
 * - Mengisi opsi tahun pelajaran.
 * - Menyimpan perubahan ke localStorage agar halaman lain ikut sinkron.
 */
function tpInitTahunSelect(selectId) {
  const select = document.getElementById(selectId);

  if (!select) {
    return null;
  }

  const uiState = tpGetCurrentUiState();

  const selected =
    uiState.tahunPelajaran || tpGetDefaultTahunFromNow();

  tpFillSelect(select, selected);

  /**
   * Cegah duplikasi listener jika fungsi dipanggil lebih dari sekali.
   */
  if (!select.dataset.tpListenerAdded) {
    select.addEventListener('change', function () {
      tpSaveUiState({
        tahunPelajaran: select.value
      });
    });

    select.dataset.tpListenerAdded = '1';
  }

  return select;
}
