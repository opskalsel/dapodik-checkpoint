/**
 * ============================================================
 * DAPODIK CHECKPOINT - DASHBOARD
 * ============================================================
 * Tahap 4C
 * - Validasi token sesi
 * - Tampilkan profil operator
 * - Pilih semester & tahun pelajaran
 * - Muat progres dari backend
 * - Lanjut ke halaman checklist
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('dashboard-page')) {
    initDashboard();
  }
});

async function initDashboard() {
  bindLogout();

  const user = getSessionUser();
  const token = getSessionToken();

  if (!user || !token) {
    window.location.href = 'login.html?role=operator';
    return;
  }

  renderProfile(user);
  setupPeriodControls();

  const sessionValid = await validateSession();

  if (!sessionValid) {
    return;
  }

  await loadProgress();
}

/**
 * ============================================================
 * SESSION VALIDATION
 * ============================================================
 */

async function validateSession() {
  try {
    const result = await apiRequest('validateToken', {}, true);

    if (!result.success) {
      clearSession();
      window.location.href = 'login.html?role=operator';
      return false;
    }

    if (result.data && result.data.user) {
      saveSession(getSessionToken(), result.data.user);
      renderProfile(result.data.user);
    }

    return true;

  } catch (error) {
    showAuthMessage(
      'dashboard-message',
      error.message || String(error),
      'error'
    );

    return false;
  }
}

/**
 * ============================================================
 * PROFILE
 * ============================================================
 */

function renderProfile(user) {
  setTextById('profile-nama', user.namaOperator || '-');
  setTextById('profile-sekolah', user.namaSekolah || '-');
  setTextById('profile-npsn', user.npsn || '-');
  setTextById('profile-username', user.username || '-');
  setTextById('profile-email', user.email || '-');

  const roleBadge = document.getElementById('profile-role-badge');

  if (!roleBadge) {
    return;
  }

  const role = String(user.role || '').toLowerCase();

  if (role === 'admin') {
    roleBadge.textContent = 'Admin';
    roleBadge.className = 'badge badge-red';
  } else {
    roleBadge.textContent = 'Operator';
    roleBadge.className = 'badge badge-blue';
  }
}

/**
 * ============================================================
 * PERIOD CONTROLS
 * ============================================================
 */

function setupPeriodControls() {
  const uiState = getUiState();

  const semesterSelect = document.getElementById('period-semester');
  const tahunInput = document.getElementById('period-tahun');

  if (semesterSelect) {
    semesterSelect.value = uiState.semester || APP_CONFIG.DEFAULT_SEMESTER;
  }

  if (tahunInput) {
  /**
   * Tahun pelajaran sekarang berupa dropdown.
   * Opsi dibuat oleh helper tahun-pelajaran.js dan
   * otomatis sinkron antar halaman.
   */
  tpInitTahunSelect('period-tahun');
  }

  const loadButton = document.getElementById('load-progress-button');

  if (loadButton) {
    loadButton.addEventListener('click', function () {
      loadProgress();
    });
  }

  const continueButton = document.getElementById('continue-checklist-button');

  if (continueButton) {
    continueButton.addEventListener('click', function () {
      goToChecklist();
    });
  }

  if (semesterSelect) {
    semesterSelect.addEventListener('change', function () {
      loadProgress();
    });
  }

  if (tahunInput) {
    tahunInput.addEventListener('change', function () {
      loadProgress();
    });
  }
}

function getSelectedPeriod() {
  const semesterSelect = document.getElementById('period-semester');
  const tahunInput = document.getElementById('period-tahun');

  const semester = semesterSelect
    ? semesterSelect.value
    : APP_CONFIG.DEFAULT_SEMESTER;

  const tahun = tahunInput
    ? normalizeTahunPelajaranClient(tahunInput.value)
    : APP_CONFIG.DEFAULT_TAHUN_PELAJARAN;

  return {
    semester: semester,
    tahunPelajaran: tahun
  };
}

function goToChecklist() {
  hideAuthMessage('dashboard-message');

  const period = getSelectedPeriod();

  if (!isValidSemester(period.semester)) {
    showAuthMessage(
      'dashboard-message',
      'Semester tidak valid. Gunakan Ganjil atau Genap.',
      'error'
    );
    return;
  }

  if (!isValidTahunPelajaranClient(period.tahunPelajaran)) {
    showAuthMessage(
      'dashboard-message',
      'Tahun pelajaran tidak valid. Gunakan format seperti 2026/2027.',
      'error'
    );
    return;
  }

  saveUiState(period);

  window.location.href = 'checklist.html';
}

/**
 * ============================================================
 * LOAD PROGRESS
 * ============================================================
 */

async function loadProgress() {
  hideAuthMessage('dashboard-message');

  const period = getSelectedPeriod();

  if (!isValidSemester(period.semester)) {
    showAuthMessage(
      'dashboard-message',
      'Semester tidak valid. Gunakan Ganjil atau Genap.',
      'error'
    );
    return;
  }

  if (!isValidTahunPelajaranClient(period.tahunPelajaran)) {
    showAuthMessage(
      'dashboard-message',
      'Tahun pelajaran tidak valid. Gunakan format seperti 2026/2027.',
      'error'
    );
    return;
  }

  saveUiState(period);

  const loadButton = document.getElementById('load-progress-button');

  setButtonLoading(loadButton, true, 'Memuat...');

  try {
    const result = await apiRequest(
      'getProgress',
      {
        semester: period.semester,
        tahunPelajaran: period.tahunPelajaran,
        metodeUpdate: getStoredMetode(period.semester, period.tahun)
      },
      true
    );

    if (!result.success) {
      if (result.code === 401 || result.code === 403) {
        clearSession();
        window.location.href = 'login.html?role=operator';
        return;
      }

      throw new Error(result.message || 'Gagal memuat progres.');
    }

    renderProgress(result.data.summary);

  } catch (error) {
    showAuthMessage(
      'dashboard-message',
      error.message || String(error),
      'error'
    );
  } finally {
    setButtonLoading(loadButton, false, 'Muat Progres');
  }
}

function renderProgress(summary) {
  const totalPercent = Number(summary.totalPersen || 0);

  setTextById('total-percent', formatPercent(totalPercent));
  setTextById(
    'total-checked',
    summary.checkedItems + ' dari ' + summary.totalItems + ' item tercentang'
  );
  setTextById(
    'total-weight-info',
    'Bobot tercentang: ' +
      summary.checkedWeight +
      ' dari ' +
      summary.totalWeight
  );

  const totalBar = document.getElementById('total-bar');

  if (totalBar) {
    totalBar.style.width = totalPercent + '%';
  }

  renderStageList(summary.stages || []);
}

function renderStageList(stages) {
  const container = document.getElementById('stage-list');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (!stages.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Belum ada data tahap untuk ditampilkan.';
    container.appendChild(empty);
    return;
  }

  stages.forEach(function (stage) {
    const row = document.createElement('div');
    row.className = 'stage-row';

    const info = document.createElement('div');
    info.className = 'stage-info';

    const title = document.createElement('strong');
    title.textContent = stage.tahapID + '. ' + stage.namaTahap;

    const meta = document.createElement('span');
    meta.textContent =
      stage.checkedItems +
      '/' +
      stage.totalItems +
      ' item • ' +
      formatPercent(stage.persen);

    info.appendChild(title);
    info.appendChild(meta);

    const track = document.createElement('div');
    track.className = 'progress-track small';

    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = Number(stage.persen || 0) + '%';

    if (stage.warna) {
      fill.style.background = stage.warna;
    }

    track.appendChild(fill);

    row.appendChild(info);
    row.appendChild(track);

    container.appendChild(row);
  });
}

/**
 * ============================================================
 * UI STATE HELPERS
 * ============================================================
 */

function getUiState() {
  try {
    const raw = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.uiState);

    if (!raw) {
      return {};
    }

    return JSON.parse(raw) || {};

  } catch (error) {
    return {};
  }
}

function saveUiState(state) {
  try {
    localStorage.setItem(
      APP_CONFIG.STORAGE_KEYS.uiState,
      JSON.stringify(state)
    );
  } catch (error) {
    console.error('Gagal menyimpan UI state.', error);
  }
}

/**
 * ============================================================
 * VALIDATION HELPERS
 * ============================================================
 */

function isValidSemester(value) {
  return value === 'Ganjil' || value === 'Genap';
}

function normalizeTahunPelajaranClient(value) {
  let v = String(value || '').trim();

  v = v.replace(/\s+/g, '');
  v = v.replace(/\\/g, '/');
  v = v.replace(/-/g, '/');

  return v;
}

function isValidTahunPelajaranClient(value) {
  const v = normalizeTahunPelajaranClient(value);

  const match = v.match(/^(\d{4})\/(\d{4})$/);

  if (!match) {
    return false;
  }

  const tahunAwal = Number(match[1]);
  const tahunAkhir = Number(match[2]);

  return tahunAkhir === tahunAwal + 1;
}

function formatPercent(value) {
  const num = Number(value || 0);

  return (Math.round(num * 100) / 100).toLocaleString('id-ID') + '%';
}

/**
 * ============================================================
 * LOGOUT
 * ============================================================
 */

function bindLogout() {
  const logoutButton = document.getElementById('logout-button');

  if (logoutButton) {
    logoutButton.addEventListener('click', function () {
      clearSession();
      window.location.href = 'index.html';
    });
  }
}

/**
 * Ambil metode update yang terakhir dipilih (dari draft localStorage)
 * untuk periode tertentu.
 */
function getStoredMetode(semester, tahun) {
  try {
    const key =
      APP_CONFIG.STORAGE_KEYS.draftProgress +
      ':' + semester + ':' + tahun;

    const raw = localStorage.getItem(key);

    if (!raw) {
      return '';
    }

    const draft = JSON.parse(raw) || {};

    return draft.metodeUpdate || '';

  } catch (error) {
    return '';
  }
}

