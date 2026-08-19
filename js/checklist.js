/**
 * ============================================================
 * DAPODIK CHECKPOINT - CHECKLIST PAGE
 * ============================================================
 * Tahap 4D
 * - Muat master checklist dari backend
 * - Muat progres tersimpan
 * - Render navigasi 12 tahap
 * - Render item per sub-bagian
 * - Filter item berdasarkan metode update Installer/Patch
 * - Simpan draft ke localStorage
 * - Simpan manual ke backend
 * ============================================================
 */

const checklistState = {
  user: null,
  semester: '',
  tahun: '',
  metode: 'Installer',
  master: [],
  stages: [],
  progress: {},
  draftItems: {},
  dirty: {},
  activeTahap: 1,
  loaded: false
};

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('checklist-page')) {
    initChecklist();
  }
});

/**
 * ============================================================
 * INIT
 * ============================================================
 */

async function initChecklist() {
  bindChecklistControls();

  const user = getSessionUser();
  const token = getSessionToken();

  if (!user || !token) {
    window.location.href = 'login.html?role=operator';
    return;
  }

  checklistState.user = user;

  loadPeriodFromStorage();

  const sessionValid = await validateChecklistSession();

  if (!sessionValid) {
    return;
  }

  await loadChecklistData();
}

async function validateChecklistSession() {
  try {
    const result = await apiRequest('validateToken', {}, true);

    if (!result.success) {
      clearSession();
      window.location.href = 'login.html?role=operator';
      return false;
    }

    if (result.data && result.data.user) {
      saveSession(getSessionToken(), result.data.user);
      checklistState.user = result.data.user;
    }

    return true;

  } catch (error) {
    showAuthMessage(
      'checklist-message',
      error.message || String(error),
      'error'
    );

    return false;
  }
}

/**
 * ============================================================
 * CONTROLS
 * ============================================================
 */

function bindChecklistControls() {
  const semesterSelect = document.getElementById('checklist-semester');
  const tahunInput = document.getElementById('checklist-tahun');
  const reloadButton = document.getElementById('reload-checklist-button');
  const saveButton = document.getElementById('save-checklist-button');

  if (semesterSelect) {
    semesterSelect.addEventListener('change', function () {
      loadChecklistData();
    });
  }

  if (tahunInput) {
    tahunInput.addEventListener('change', function () {
      loadChecklistData();
    });
  }

  document.querySelectorAll('input[name="metode-update"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      checklistState.metode = this.value;
      writeDraft();
      renderAll();
    });
  });

  if (reloadButton) {
    reloadButton.addEventListener('click', function () {
      loadChecklistData();
    });
  }

  if (saveButton) {
    saveButton.addEventListener('click', function () {
      saveNow();
    });
  }
}

function loadPeriodFromStorage() {
  const uiState = getUiState();

  const semesterSelect = document.getElementById('checklist-semester');
  const tahunInput = document.getElementById('checklist-tahun');

  if (semesterSelect) {
    semesterSelect.value = uiState.semester || APP_CONFIG.DEFAULT_SEMESTER;
  }

  if (tahunInput) {
  tpInitTahunSelect('checklist-tahun');
  }
}

function syncPeriodFromInputs() {
  const semesterSelect = document.getElementById('checklist-semester');
  const tahunInput = document.getElementById('checklist-tahun');

  const semester = semesterSelect
    ? semesterSelect.value
    : APP_CONFIG.DEFAULT_SEMESTER;

  const tahun = tahunInput
    ? normalizeTahunPelajaranClient(tahunInput.value)
    : APP_CONFIG.DEFAULT_TAHUN_PELAJARAN;

  if (!isValidSemester(semester)) {
    showAuthMessage(
      'checklist-message',
      'Semester tidak valid. Gunakan Ganjil atau Genap.',
      'error'
    );
    return null;
  }

  if (!isValidTahunPelajaranClient(tahun)) {
    showAuthMessage(
      'checklist-message',
      'Tahun pelajaran tidak valid. Gunakan format seperti 2026/2027.',
      'error'
    );
    return null;
  }

  checklistState.semester = semester;
  checklistState.tahun = tahun;

  saveUiState({
    semester: semester,
    tahunPelajaran: tahun
  });

  return {
    semester: semester,
    tahun: tahun
  };
}

/**
 * ============================================================
 * LOAD DATA
 * ============================================================
 */

async function loadChecklistData() {
  hideAuthMessage('checklist-message');

  const period = syncPeriodFromInputs();

  if (!period) {
    return;
  }

  const reloadButton = document.getElementById('reload-checklist-button');

  setButtonLoading(reloadButton, true, 'Memuat...');

  const draft = loadDraft();

  checklistState.draftItems = draft.items || {};
  checklistState.dirty = draft.dirty || {};
  checklistState.metode = draft.metodeUpdate || checklistState.metode || 'Installer';

  if (typeof setMetodeRadio === 'function') {
    setMetodeRadio(checklistState.metode);
  }

  try {
    const masterResult = await apiRequest(
      'getMaster',
      {
        semester: period.semester,
        refresh: true
      },
      true
    );

    /**
     * Guard: jangan baca .data jika respons gagal
     */
    if (!masterResult || !masterResult.success || !masterResult.data) {
      if (masterResult && (masterResult.code === 401 || masterResult.code === 403)) {
        clearSession();
        window.location.href = 'login.html?role=operator';
        return;
      }

      throw new Error(
        (masterResult && masterResult.message) ||
        'Gagal memuat master checklist.'
      );
    }

    checklistState.master = masterResult.data.items || [];
    checklistState.stages = masterResult.data.stages || [];

    const progressResult = await apiRequest(
      'getProgress',
      {
        semester: period.semester,
        tahunPelajaran: period.tahun,
        metodeUpdate: checklistState.metode
      },
      true
    );

    if (progressResult && progressResult.success && progressResult.data) {
      checklistState.progress = progressResult.data.progress || {};
    } else {
      checklistState.progress = {};

      showAuthMessage(
        'checklist-message',
        'Master checklist dimuat, tetapi progres gagal diambil. Menampilkan status kosong.',
        'info'
      );
    }

    checklistState.semester = period.semester;
    checklistState.tahun = period.tahun;
    checklistState.loaded = true;

    renderAll();

  } catch (error) {
    showAuthMessage(
      'checklist-message',
      error.message || String(error),
      'error'
    );

  } finally {
    setButtonLoading(reloadButton, false, 'Muat Ulang');
  }
}

/**
 * ============================================================
 * DRAFT LOCAL STORAGE
 * ============================================================
 */

function getDraftStorageKey() {
  return (
    APP_CONFIG.STORAGE_KEYS.draftProgress +
    ':' +
    checklistState.semester +
    ':' +
    checklistState.tahun
  );
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(getDraftStorageKey());

    if (!raw) {
      return {};
    }

    return JSON.parse(raw) || {};

  } catch (error) {
    return {};
  }
}

function writeDraft() {
  try {
    const payload = {
      semester: checklistState.semester,
      tahunPelajaran: checklistState.tahun,
      metodeUpdate: checklistState.metode,
      updatedAt: new Date().toISOString(),
      items: checklistState.draftItems,
      dirty: checklistState.dirty
    };

    localStorage.setItem(
      getDraftStorageKey(),
      JSON.stringify(payload)
    );

  } catch (error) {
    console.error('Gagal menyimpan draft lokal.', error);
  }
}

/**
 * ============================================================
 * ITEM STATE
 * ============================================================
 */

function getItemState(itemID) {
  const draft = checklistState.draftItems[itemID];

  if (draft) {
    return {
      checked: Boolean(draft.checked),
      catatan: String(draft.catatan || '')
    };
  }

  const server = checklistState.progress[itemID];

  if (server) {
    return {
      checked: Boolean(server.checked),
      catatan: String(server.catatan || '')
    };
  }

  return {
    checked: false,
    catatan: ''
  };
}

function isItemVisible(item) {
  const grup = String(item.grupMetodeUpdate || 'Umum');

  if (grup === 'Umum') {
    return true;
  }

  if (!checklistState.metode) {
    return true;
  }

  return grup.toLowerCase() === checklistState.metode.toLowerCase();
}

function onItemCheckedChange(itemID, checked) {
  const current = getItemState(itemID);

  checklistState.draftItems[itemID] = {
    checked: checked,
    catatan: current.catatan || ''
  };

  checklistState.dirty[itemID] = true;

  writeDraft();
  updateProgressUI();
  updateSaveStatus();
}

function onItemCatatanChange(itemID, catatan) {
  const current = getItemState(itemID);

  checklistState.draftItems[itemID] = {
    checked: current.checked,
    catatan: catatan
  };

  checklistState.dirty[itemID] = true;

  writeDraft();
  updateSaveStatus();
}

/**
 * ============================================================
 * RENDER
 * ============================================================
 */

function renderAll() {
  renderStageNav();
  renderActiveStage();
  updateProgressUI();
  updateSaveStatus();
}

function renderStageNav() {
  const nav = document.getElementById('stage-nav');

  if (!nav) {
    return;
  }

  nav.innerHTML = '';

  checklistState.stages.forEach(function (stage) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'stage-tab';
    button.dataset.tahap = stage.tahapID;

    if (Number(stage.tahapID) === Number(checklistState.activeTahap)) {
      button.classList.add('active');
    }

    const number = document.createElement('span');
    number.className = 'stage-tab-number';
    number.textContent = stage.tahapID;

    if (stage.warna) {
      number.style.background = stage.warna;
    }

    const label = document.createElement('span');
    label.className = 'stage-tab-label';
    label.textContent = stage.namaTahap;

    const percent = document.createElement('span');
    percent.className = 'stage-tab-percent';
    percent.dataset.stagePercent = stage.tahapID;
    percent.textContent = '0%';

    button.appendChild(number);
    button.appendChild(label);
    button.appendChild(percent);

    button.addEventListener('click', function () {
      checklistState.activeTahap = Number(stage.tahapID);

      document.querySelectorAll('.stage-tab').forEach(function (btn) {
        btn.classList.remove('active');
      });

      button.classList.add('active');

      renderActiveStage();
    });

    nav.appendChild(button);
  });
}

function renderActiveStage() {
  const content = document.getElementById('checklist-content');

  if (!content) {
    return;
  }

  content.innerHTML = '';

  const stageMeta = checklistState.stages.find(function (stage) {
    return Number(stage.tahapID) === Number(checklistState.activeTahap);
  });

  const heading = document.createElement('div');
  heading.className = 'section-heading';

  const title = document.createElement('h2');
  title.textContent = stageMeta
    ? stageMeta.tahapID + '. ' + stageMeta.namaTahap
    : 'Tahap ' + checklistState.activeTahap;

  const subtitle = document.createElement('p');
  subtitle.textContent = stageMeta
    ? stageMeta.kelompokPrioritas + ' • Urgensi: ' + stageMeta.urgensi
    : '';

  heading.appendChild(title);
  heading.appendChild(subtitle);

  content.appendChild(heading);

  const items = checklistState.master.filter(function (item) {
    return (
      Number(item.tahapID) === Number(checklistState.activeTahap) &&
      isItemVisible(item)
    );
  });

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.textContent = 'Tidak ada item checklist untuk tahap ini.';
    content.appendChild(empty);
    return;
  }

  /**
   * Kelompokkan item berdasarkan SubBagian,
   * dengan tetap mempertahankan urutan master.
   */
  const groups = new Map();

  items.forEach(function (item) {
    const key = item.subBagian || 'Umum';

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(item);
  });

  groups.forEach(function (groupItems, subBagian) {
    const card = document.createElement('section');
    card.className = 'card checklist-card';

    const cardTitle = document.createElement('h3');
    cardTitle.textContent = subBagian;

    card.appendChild(cardTitle);

    groupItems.forEach(function (item) {
      card.appendChild(createItemElement(item));
    });

    content.appendChild(card);
  });
}

function createItemElement(item) {
  const state = getItemState(item.itemID);

  const wrapper = document.createElement('div');
  wrapper.className = 'checklist-item';

  if (state.checked) {
    wrapper.classList.add('checked');
  }

  const control = document.createElement('div');
  control.className = 'checklist-item-control';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'chk-' + item.itemID;
  checkbox.checked = state.checked;

  checkbox.addEventListener('change', function () {
    wrapper.classList.toggle('checked', checkbox.checked);
    onItemCheckedChange(item.itemID, checkbox.checked);
  });

  control.appendChild(checkbox);

  const body = document.createElement('div');
  body.className = 'checklist-item-body';

  const label = document.createElement('label');
  label.className = 'checklist-item-title';
  label.htmlFor = checkbox.id;
  label.textContent = item.uraian;

  const help = document.createElement('p');
  help.className = 'checklist-item-help';
  help.textContent = formatBulletText(item.halYangHarusDipastikan || '-');

  const note = document.createElement('textarea');
  note.className = 'checklist-item-note';
  note.rows = 2;
  note.placeholder = 'Catatan (opsional)';
  note.value = state.catatan || '';

  note.addEventListener('change', function () {
    onItemCatatanChange(item.itemID, note.value.trim());
  });

  body.appendChild(label);
  body.appendChild(help);
  body.appendChild(note);

  wrapper.appendChild(control);
  wrapper.appendChild(body);

  return wrapper;
}

/**
 * ============================================================
 * PROGRESS COMPUTATION
 * ============================================================
 */

function computeProgress() {
  const byStage = {};

  let totalItems = 0;
  let checkedItems = 0;
  let totalWeight = 0;
  let checkedWeight = 0;

  checklistState.master.forEach(function (item) {
    if (!isItemVisible(item)) {
      return;
    }

    if (!byStage[item.tahapID]) {
      byStage[item.tahapID] = {
        totalItems: 0,
        checkedItems: 0,
        totalWeight: 0,
        checkedWeight: 0,
        persen: 0
      };
    }

    const stage = byStage[item.tahapID];
    const state = getItemState(item.itemID);
    const checked = Boolean(state.checked);

    stage.totalItems += 1;
    totalItems += 1;

    if (checked) {
      stage.checkedItems += 1;
      checkedItems += 1;
    }

    const weight = Number(item.weight || 0);

    if (weight > 0) {
      stage.totalWeight += weight;
      totalWeight += weight;

      if (checked) {
        stage.checkedWeight += weight;
        checkedWeight += weight;
      }
    }
  });

  Object.keys(byStage).forEach(function (key) {
    const stage = byStage[key];

    stage.persen = stage.totalWeight > 0
      ? roundNumber((stage.checkedWeight / stage.totalWeight) * 100, 2)
      : 0;
  });

  const totalPersen = totalWeight > 0
    ? roundNumber((checkedWeight / totalWeight) * 100, 2)
    : 0;

  return {
    byStage: byStage,
    totalItems: totalItems,
    checkedItems: checkedItems,
    totalWeight: totalWeight,
    checkedWeight: checkedWeight,
    totalPersen: totalPersen
  };
}

function updateProgressUI() {
  const progress = computeProgress();

  setTextById(
    'checklist-total-percent',
    formatPercent(progress.totalPersen)
  );

  setTextById(
    'checklist-total-checked',
    progress.checkedItems +
      ' dari ' +
      progress.totalItems +
      ' item tercentang'
  );

  const totalBar = document.getElementById('checklist-total-bar');

  if (totalBar) {
    totalBar.style.width = progress.totalPersen + '%';
  }

  document.querySelectorAll('[data-stage-percent]').forEach(function (el) {
    const tahapID = el.dataset.stagePercent;
    const stageProgress = progress.byStage[tahapID];

    el.textContent = formatPercent(stageProgress ? stageProgress.persen : 0);
  });
}

function updateSaveStatus() {
  const el = document.getElementById('save-status');

  if (!el) {
    return;
  }

  const dirtyCount = Object.keys(checklistState.dirty).filter(function (key) {
    return checklistState.dirty[key];
  }).length;

  if (dirtyCount > 0) {
    el.textContent = dirtyCount + ' perubahan belum disimpan';
  } else {
    el.textContent = 'Tidak ada perubahan yang belum disimpan';
  }
}

/**
 * ============================================================
 * SAVE TO BACKEND
 * ============================================================
 */

async function saveNow() {
  hideAuthMessage('checklist-message');

  const period = syncPeriodFromInputs();

  if (!period) {
    return;
  }

  if (!checklistState.metode) {
    showAuthMessage(
      'checklist-message',
      'Pilih metode update terlebih dahulu: Installer atau Patch.',
      'error'
    );
    return;
  }

  const dirtyIds = Object.keys(checklistState.dirty).filter(function (itemID) {
    return checklistState.dirty[itemID];
  });

  if (!dirtyIds.length) {
    showAuthMessage(
      'checklist-message',
      'Tidak ada perubahan yang perlu disimpan.',
      'info'
    );
    return;
  }

  const items = dirtyIds.map(function (itemID) {
    const state = getItemState(itemID);

    return {
      itemID: itemID,
      checked: Boolean(state.checked),
      catatan: String(state.catatan || '')
    };
  });

  const saveButton = document.getElementById('save-checklist-button');

  setButtonLoading(saveButton, true, 'Menyimpan...');

  try {
    const result = await apiRequest(
      'saveProgress',
      {
        semester: period.semester,
        tahunPelajaran: period.tahun,
        metodeUpdate: checklistState.metode,
        aksi: 'manual',
        items: items
      },
      true
    );

    if (!result.success) {
      if (result.code === 401 || result.code === 403) {
        clearSession();
        window.location.href = 'login.html?role=operator';
        return;
      }

      throw new Error(result.message || 'Gagal menyimpan progres.');
    }

    /**
     * Setelah sukses, anggap item-item tersebut sudah tersimpan di server.
     */
    items.forEach(function (item) {
      checklistState.progress[item.itemID] = {
        checked: item.checked,
        catatan: item.catatan
      };

      delete checklistState.dirty[item.itemID];
    });

    writeDraft();
    updateSaveStatus();
    updateProgressUI();

    showAuthMessage(
      'checklist-message',
      'Progres berhasil disimpan. Total item terkirim: ' + items.length,
      'success'
    );

  } catch (error) {
    showAuthMessage(
      'checklist-message',
      error.message || String(error),
      'error'
    );
  } finally {
    setButtonLoading(saveButton, false, 'Simpan Sekarang');
  }
}

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function setMetodeRadio(metode) {
  document.querySelectorAll('input[name="metode-update"]').forEach(function (radio) {
    radio.checked = radio.value === metode;
  });
}

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

function roundNumber(value, decimals) {
  const factor = Math.pow(10, decimals);

  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * ============================================================
 * PATCH 4D-1
 * ============================================================
 * 1. Accordion / expand-collapse untuk sub-bagian
 * 2. Perbaikan hitungan "n perubahan belum disimpan"
 * ============================================================
 */

const collapsedSubsections = new Set();

/**
 * Ambil kondisi item yang terakhir tersimpan di server
 */
function getServerItemState(itemID) {
  const server = checklistState.progress[itemID];

  if (!server) {
    return {
      checked: false,
      catatan: ''
    };
  }

  return {
    checked: Boolean(server.checked),
    catatan: String(server.catatan || '')
  };
}

/**
 * Item dianggap berubah jika kondisi saat ini
 * berbeda dari kondisi yang tersimpan di server
 */
function isItemDirty(itemID) {
  const current = getItemState(itemID);
  const server = getServerItemState(itemID);

  return (
    current.checked !== server.checked ||
    current.catatan !== server.catatan
  );
}

/**
 * Ambil daftar item yang benar-benar berubah.
 * Hanya item yang terlihat sesuai metode update yang dihitung.
 */
function getDirtyItemIDs() {
  const masterByID = {};

  checklistState.master.forEach(function (item) {
    masterByID[item.itemID] = item;
  });

  const candidateIDs = new Set();

  checklistState.master.forEach(function (item) {
    candidateIDs.add(item.itemID);
  });

  Object.keys(checklistState.draftItems || {}).forEach(function (itemID) {
    if (masterByID[itemID]) {
      candidateIDs.add(itemID);
    }
  });

  return Array.from(candidateIDs).filter(function (itemID) {
    const item = masterByID[itemID];

    if (!item) {
      return false;
    }

    if (!isItemVisible(item)) {
      return false;
    }

    return isItemDirty(itemID);
  });
}

/**
 * Simpan draft lokal.
 * Dirty dihitung ulang berdasarkan selisih dengan server.
 */
function writeDraft() {
  try {
    const dirtyIDs = getDirtyItemIDs();
    const dirtyMap = {};

    dirtyIDs.forEach(function (itemID) {
      dirtyMap[itemID] = true;
    });

    const payload = {
      semester: checklistState.semester,
      tahunPelajaran: checklistState.tahun,
      metodeUpdate: checklistState.metode,
      updatedAt: new Date().toISOString(),
      items: checklistState.draftItems,
      dirty: dirtyMap
    };

    localStorage.setItem(
      getDraftStorageKey(),
      JSON.stringify(payload)
    );

  } catch (error) {
    console.error('Gagal menyimpan draft lokal.', error);
  }
}

/**
 * Saat checkbox berubah, simpan draft lalu hitung ulang status perubahan
 */
function onItemCheckedChange(itemID, checked) {
  const current = getItemState(itemID);

  checklistState.draftItems[itemID] = {
    checked: checked,
    catatan: current.catatan || ''
  };

  writeDraft();
  updateProgressUI();
  updateSaveStatus();
}

/**
 * Saat catatan berubah, simpan draft lalu hitung ulang status perubahan
 */
function onItemCatatanChange(itemID, catatan) {
  const current = getItemState(itemID);

  checklistState.draftItems[itemID] = {
    checked: current.checked,
    catatan: catatan
  };

  writeDraft();
  updateSaveStatus();
}

/**
 * Hitung jumlah perubahan berdasarkan item yang benar-benar berbeda
 * dari kondisi server
 */
function updateSaveStatus() {
  const el = document.getElementById('save-status');

  if (!el) {
    return;
  }

  const dirtyIds = getDirtyItemIDs();

  if (dirtyIds.length > 0) {
    el.textContent = dirtyIds.length + ' perubahan belum disimpan';
  } else {
    el.textContent = 'Tidak ada perubahan yang belum disimpan';
  }
}

/**
 * ============================================================
 * RENDER ACTIVE STAGE - ACCORDION SUB BAGIAN
 * ============================================================
 */

function renderActiveStage() {
  const content = document.getElementById('checklist-content');

  if (!content) {
    return;
  }

  content.innerHTML = '';

  const stageMeta = checklistState.stages.find(function (stage) {
    return Number(stage.tahapID) === Number(checklistState.activeTahap);
  });

  const heading = document.createElement('div');
  heading.className = 'section-heading';

  const title = document.createElement('h2');
  title.textContent = stageMeta
    ? stageMeta.tahapID + '. ' + stageMeta.namaTahap
    : 'Tahap ' + checklistState.activeTahap;

  const subtitle = document.createElement('p');
  subtitle.textContent = stageMeta
    ? stageMeta.kelompokPrioritas + ' • Urgensi: ' + stageMeta.urgensi
    : '';

  heading.appendChild(title);
  heading.appendChild(subtitle);

  content.appendChild(heading);

  const items = checklistState.master.filter(function (item) {
    return (
      Number(item.tahapID) === Number(checklistState.activeTahap) &&
      isItemVisible(item)
    );
  });

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.textContent = 'Tidak ada item checklist untuk tahap ini.';
    content.appendChild(empty);
    return;
  }

  /**
   * Kelompokkan item berdasarkan SubBagian
   */
  const groups = new Map();

  items.forEach(function (item) {
    const key = item.subBagian || 'Umum';

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(item);
  });

  groups.forEach(function (groupItems, subBagian) {
    content.appendChild(
      createSubsectionElement(
        checklistState.activeTahap,
        subBagian,
        groupItems
      )
    );
  });

  updateAllSubsectionCounts();
}

/**
 * Buat kontainer accordion untuk satu sub-bagian
 */
function createSubsectionElement(tahapID, subBagian, groupItems) {
  const key = tahapID + '::' + subBagian;

  const section = document.createElement('section');
  section.className = 'card checklist-subsection';
  section.dataset.subsectionKey = key;

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'subsection-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'subsection-title';

  const title = document.createElement('h3');
  title.textContent = subBagian;

  const count = document.createElement('span');
  count.className = 'subsection-count';
  count.dataset.subsectionCount = key;
  count.textContent = '0/0 item';

  titleWrap.appendChild(title);
  titleWrap.appendChild(count);

  const chevron = document.createElement('span');
  chevron.className = 'subsection-chevron';
  chevron.textContent = '▾';

  header.appendChild(titleWrap);
  header.appendChild(chevron);

  header.addEventListener('click', function () {
    toggleSubsection(key, section);
  });

  const body = document.createElement('div');
  body.className = 'subsection-body';

  if (collapsedSubsections.has(key)) {
    body.classList.add('hidden');
    section.classList.add('collapsed');
  }

  groupItems.forEach(function (item) {
    body.appendChild(createItemElement(item));
  });

  section.appendChild(header);
  section.appendChild(body);

  return section;
}

/**
 * Toggle expand / collapse sub-bagian
 */
function toggleSubsection(key, section) {
  const body = section.querySelector('.subsection-body');

  if (!body) {
    return;
  }

  if (collapsedSubsections.has(key)) {
    collapsedSubsections.delete(key);
    body.classList.remove('hidden');
    section.classList.remove('collapsed');
  } else {
    collapsedSubsections.add(key);
    body.classList.add('hidden');
    section.classList.add('collapsed');
  }
}

/**
 * Update semua counter sub-bagian
 */
function updateAllSubsectionCounts() {
  document.querySelectorAll('.checklist-subsection').forEach(function (section) {
    updateSubsectionCount(section);
  });
}

/**
 * Update counter satu sub-bagian
 */
function updateSubsectionCount(section) {
  if (!section) {
    return;
  }

  const checkboxes = section.querySelectorAll(
    '.checklist-item-control input[type="checkbox"]'
  );

  let total = checkboxes.length;
  let checked = 0;

  checkboxes.forEach(function (checkbox) {
    if (checkbox.checked) {
      checked += 1;
    }
  });

  const countEl = section.querySelector('[data-subsection-count]');

  if (countEl) {
    countEl.textContent = checked + '/' + total + ' item';
  }
}

/**
 * ============================================================
 * CREATE ITEM ELEMENT - WITH SUBSECTION COUNT UPDATE
 * ============================================================
 */

function createItemElement(item) {
  const state = getItemState(item.itemID);

  const wrapper = document.createElement('div');
  wrapper.className = 'checklist-item';
  wrapper.dataset.itemId = item.itemID;

  if (state.checked) {
    wrapper.classList.add('checked');
  }

  const control = document.createElement('div');
  control.className = 'checklist-item-control';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'chk-' + item.itemID;
  checkbox.checked = state.checked;

  checkbox.addEventListener('change', function () {
    wrapper.classList.toggle('checked', checkbox.checked);

    onItemCheckedChange(item.itemID, checkbox.checked);

    const subsection = wrapper.closest('.checklist-subsection');

    if (subsection) {
      updateSubsectionCount(subsection);
    }
  });

  control.appendChild(checkbox);

  const body = document.createElement('div');
  body.className = 'checklist-item-body';

  const label = document.createElement('label');
  label.className = 'checklist-item-title';
  label.htmlFor = checkbox.id;
  label.textContent = item.uraian;

  const help = document.createElement('p');
  help.className = 'checklist-item-help';
  help.textContent = formatBulletText(item.halYangHarusDipastikan || '-');

  const note = document.createElement('textarea');
  note.className = 'checklist-item-note';
  note.rows = 2;
  note.placeholder = 'Catatan (opsional)';
  note.value = state.catatan || '';

  note.addEventListener('change', function () {
    onItemCatatanChange(item.itemID, note.value.trim());
  });

  body.appendChild(label);
  body.appendChild(help);
  body.appendChild(note);

  wrapper.appendChild(control);
  wrapper.appendChild(body);

  return wrapper;
}

/**
 * ============================================================
 * SAVE NOW - ONLY TRUE DIRTY ITEMS
 * ============================================================
 */

async function saveNow() {
  hideAuthMessage('checklist-message');

  const period = syncPeriodFromInputs();

  if (!period) {
    return;
  }

  if (!checklistState.metode) {
    showAuthMessage(
      'checklist-message',
      'Pilih metode update terlebih dahulu: Installer atau Patch.',
      'error'
    );
    return;
  }

  const dirtyIds = getDirtyItemIDs();

  if (!dirtyIds.length) {
    showAuthMessage(
      'checklist-message',
      'Tidak ada perubahan yang perlu disimpan.',
      'info'
    );
    return;
  }

  const items = dirtyIds.map(function (itemID) {
    const state = getItemState(itemID);

    return {
      itemID: itemID,
      checked: Boolean(state.checked),
      catatan: String(state.catatan || '')
    };
  });

  const saveButton = document.getElementById('save-checklist-button');

  setButtonLoading(saveButton, true, 'Menyimpan...');

  try {
    const result = await apiRequest(
      'saveProgress',
      {
        semester: period.semester,
        tahunPelajaran: period.tahun,
        metodeUpdate: checklistState.metode,
        aksi: 'manual',
        items: items
      },
      true
    );

    if (!result.success) {
      if (result.code === 401 || result.code === 403) {
        clearSession();
        window.location.href = 'login.html?role=operator';
        return;
      }

      throw new Error(result.message || 'Gagal menyimpan progres.');
    }

    /**
     * Setelah sukses, update baseline server di state lokal
     */
    items.forEach(function (item) {
      checklistState.progress[item.itemID] = {
        checked: item.checked,
        catatan: item.catatan
      };
    });

    /**
     * Bersihkan draft item yang sudah tidak berbeda dari server
     */
    Object.keys(checklistState.draftItems).forEach(function (itemID) {
      if (!isItemDirty(itemID)) {
        delete checklistState.draftItems[itemID];
      }
    });

    writeDraft();
    updateSaveStatus();
    updateProgressUI();

    showAuthMessage(
      'checklist-message',
      'Progres berhasil disimpan. Total item terkirim: ' + items.length,
      'success'
    );

  } catch (error) {
    showAuthMessage(
      'checklist-message',
      error.message || String(error),
      'error'
    );
  } finally {
    setButtonLoading(saveButton, false, 'Simpan Sekarang');
  }
}

/**
 * ============================================================
 * PATCH 4E-1 - AUTO-SAVE 5 MENIT & IDLE MECHANISM
 * ============================================================
 */

const autoSaveState = {
  lastActivity: Date.now(),
  lastSync: Date.now(),
  timer: null,
  saving: false,

  /**
   * Interval auto-save utama, diambil dari APP_CONFIG.SYNC_INTERVAL_MINUTES.
   * Default PRD: 5 menit.
   */
  get intervalMs() {
    return (Number(APP_CONFIG.SYNC_INTERVAL_MINUTES) || 5) * 60000;
  },

  /**
   * Timer pemeriksaan dijalankan tiap 1 menit.
   */
  checkIntervalMs: 60000,

  /**
   * Jika tidak ada aktivitas selama 15 menit, auto-save berhenti.
   */
  idleTimeoutMs: 15 * 60000,

  /**
   * Flush saat pindah tahap dibatasi maksimal sekali tiap 2 menit
   * agar tidak terlalu sering memanggil backend.
   */
  navigateFlushThrottleMs: 2 * 60000
};

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('checklist-page')) {
    initAutoSave();
  }
});

/**
 * ============================================================
 * INIT AUTO-SAVE
 * ============================================================
 */

function initAutoSave() {
  ensureAutoSaveStatusElement();

  autoSaveState.lastActivity = Date.now();
  autoSaveState.lastSync = Date.now();

  bindActivityEvents();
  bindPageVisibilityEvents();
  bindPageHideEvents();
  bindStageNavAutoSaveEvents();
  bindNoteInputAutoSave();
  startAutoSaveChecker();

  updateAutoSaveStatus('Auto-save: aktif, menunggu interval sinkronisasi.');
}

/**
 * Buat elemen status auto-save jika belum ada di HTML
 */
function ensureAutoSaveStatusElement() {
  if (document.getElementById('autosave-status')) {
    return;
  }

  const saveStatus = document.getElementById('save-status');

  if (!saveStatus) {
    return;
  }

  const el = document.createElement('div');
  el.id = 'autosave-status';
  el.className = 'muted autosave-status';
  el.textContent = 'Auto-save: menyiapkan...';

  saveStatus.insertAdjacentElement('afterend', el);
}

/**
 * ============================================================
 * ACTIVITY TRACKING
 * ============================================================
 */

function bindActivityEvents() {
  const events = [
    'pointerdown',
    'click',
    'keydown',
    'change',
    'input',
    'scroll',
    'touchstart'
  ];

  events.forEach(function (eventName) {
    document.addEventListener(
      eventName,
      function () {
        markUserActivity();
      },
      { passive: true }
    );
  });
}

function markUserActivity() {
  autoSaveState.lastActivity = Date.now();
}

function isUserActive() {
  return Date.now() - autoSaveState.lastActivity < autoSaveState.idleTimeoutMs;
}

function isPageVisible() {
  return !document.hidden;
}

/**
 * ============================================================
 * AUTO-SAVE TIMER
 * ============================================================
 */

function startAutoSaveChecker() {
  if (autoSaveState.timer) {
    clearInterval(autoSaveState.timer);
  }

  autoSaveState.timer = setInterval(function () {
    autoSaveTick();
  }, autoSaveState.checkIntervalMs);

  /**
   * Cek pertama setelah halaman siap
   */
  setTimeout(function () {
    autoSaveTick();
  }, 1500);
}

function autoSaveTick() {
  if (!checklistState.loaded) {
    updateAutoSaveStatus('Auto-save: menunggu checklist selesai dimuat.');
    return;
  }

  if (autoSaveState.saving) {
    updateAutoSaveStatus('Auto-save: sedang menyimpan...');
    return;
  }

  if (!isPageVisible()) {
    updateAutoSaveStatus('Auto-save: dijeda karena tab tidak aktif.');
    return;
  }

  if (!isUserActive()) {
    updateAutoSaveStatus('Auto-save: berhenti karena tidak ada aktivitas.');
    return;
  }

  const dirtyIds = getDirtyItemIDs();
  const dirtyCount = dirtyIds.length;

  const now = Date.now();
  const elapsed = now - autoSaveState.lastSync;
  const remaining = autoSaveState.intervalMs - elapsed;

  if (remaining <= 0) {
    if (dirtyCount > 0) {
      updateAutoSaveStatus(
        'Auto-save: mengirim ' + dirtyCount + ' perubahan...'
      );

      const items = buildItemsFromIDs(dirtyIds);

      performSaveProgress(items, 'auto');

    } else {
      autoSaveState.lastSync = now;
      updateAutoSaveStatus('Auto-save: aktif, tidak ada perubahan.');
    }

  } else {
    updateAutoSaveStatus(
      'Auto-save aktif • ' +
      dirtyCount +
      ' perubahan belum disimpan • sinkron berikutnya ±' +
      formatDurationMs(remaining)
    );
  }
}

/**
 * ============================================================
 * PERFORM SAVE - SHARED FOR MANUAL & AUTO
 * ============================================================
 */

async function performSaveProgress(items, aksi) {
  if (autoSaveState.saving) {
    return {
      success: false,
      message: 'Masih ada proses simpan yang sedang berjalan.'
    };
  }

  if (!items || !items.length) {
    return {
      success: true,
      message: 'Tidak ada item yang perlu disimpan.'
    };
  }

  if (!checklistState.loaded) {
    return {
      success: false,
      message: 'Checklist belum selesai dimuat.'
    };
  }

  if (!isValidSemester(checklistState.semester)) {
    return {
      success: false,
      message: 'Semester tidak valid.'
    };
  }

  if (!isValidTahunPelajaranClient(checklistState.tahun)) {
    return {
      success: false,
      message: 'Tahun pelajaran tidak valid.'
    };
  }

  if (!checklistState.metode) {
    return {
      success: false,
      message: 'Metode update belum dipilih.'
    };
  }

  const token = getSessionToken();

  if (!token) {
    return {
      success: false,
      message: 'Sesi tidak ditemukan. Silakan login ulang.'
    };
  }

  autoSaveState.saving = true;

  updateAutoSaveStatus(
    aksi === 'auto'
      ? 'Auto-save: sedang menyimpan...'
      : 'Menyimpan...'
  );

  try {
    const result = await apiRequest(
      'saveProgress',
      {
        semester: checklistState.semester,
        tahunPelajaran: checklistState.tahun,
        metodeUpdate: checklistState.metode,
        aksi: aksi,
        items: items
      },
      true
    );

    if (!result.success) {
      if (result.code === 401 || result.code === 403) {
        clearSession();
        window.location.href = 'login.html?role=operator';
        return {
          success: false,
          message: 'Sesi berakhir. Silakan login ulang.'
        };
      }

      throw new Error(result.message || 'Gagal menyimpan progres.');
    }

    /**
     * Update baseline server setelah sukses
     */
    items.forEach(function (item) {
      checklistState.progress[item.itemID] = {
        checked: item.checked,
        catatan: item.catatan
      };
    });

    /**
     * Bersihkan draft yang sudah tidak berbeda dari server
     */
    Object.keys(checklistState.draftItems).forEach(function (itemID) {
      if (!isItemDirty(itemID)) {
        delete checklistState.draftItems[itemID];
      }
    });

    writeDraft();
    updateSaveStatus();
    updateProgressUI();

    autoSaveState.lastSync = Date.now();

    const successMessage =
      aksi === 'auto'
        ? 'Auto-save berhasil. ' + items.length + ' item tersimpan.'
        : 'Progres berhasil disimpan. Total item terkirim: ' + items.length + '.';

    updateAutoSaveStatus(
      aksi === 'auto'
        ? 'Auto-save: terakhir menyimpan ' + items.length + ' item.'
        : 'Terakhir disimpan manual.'
    );

    return {
      success: true,
      message: successMessage
    };

  } catch (error) {
    /**
     * Jika gagal, tunggu interval berikutnya agar tidak terlalu sering retry.
     */
    autoSaveState.lastSync = Date.now();

    const errorMessage = error.message || String(error);

    updateAutoSaveStatus(
      aksi === 'auto'
        ? 'Auto-save gagal: ' + errorMessage
        : 'Gagal menyimpan: ' + errorMessage
    );

    return {
      success: false,
      message: errorMessage
    };

  } finally {
    autoSaveState.saving = false;
  }
}

/**
 * ============================================================
 * MANUAL SAVE OVERRIDE
 * ============================================================
 */

async function saveNow() {
  hideAuthMessage('checklist-message');

  const period = syncPeriodFromInputs();

  if (!period) {
    return;
  }

  if (!checklistState.metode) {
    showAuthMessage(
      'checklist-message',
      'Pilih metode update terlebih dahulu: Installer atau Patch.',
      'error'
    );
    return;
  }

  const dirtyIds = getDirtyItemIDs();

  if (!dirtyIds.length) {
    showAuthMessage(
      'checklist-message',
      'Tidak ada perubahan yang perlu disimpan.',
      'info'
    );
    return;
  }

  const items = buildItemsFromIDs(dirtyIds);

  const saveButton = document.getElementById('save-checklist-button');

  setButtonLoading(saveButton, true, 'Menyimpan...');

  const result = await performSaveProgress(items, 'manual');

  setButtonLoading(saveButton, false, 'Simpan Sekarang');

  if (result && result.success) {
    showAuthMessage(
      'checklist-message',
      result.message || 'Progres berhasil disimpan.',
      'success'
    );
  } else if (result && result.message) {
    showAuthMessage(
      'checklist-message',
      result.message,
      'error'
    );
  }
}

/**
 * ============================================================
 * FLUSH ON PAGE HIDE / CLOSE
 * ============================================================
 */

function bindPageVisibilityEvents() {
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      flushOnPageHide();
      updateAutoSaveStatus('Auto-save: dijeda karena tab tidak aktif.');
    } else {
      markUserActivity();
      autoSaveTick();
    }
  });
}

function bindPageHideEvents() {
  window.addEventListener('pagehide', function () {
    flushOnPageHide();
  });

  window.addEventListener('beforeunload', function () {
    flushOnPageHide();
  });
}

function flushOnPageHide() {
  if (!checklistState.loaded) {
    return;
  }

  if (autoSaveState.saving) {
    return;
  }

  const dirtyIds = getDirtyItemIDs();

  if (!dirtyIds.length) {
    return;
  }

  const items = buildItemsFromIDs(dirtyIds);
  const payload = buildSavePayload(items, 'auto');

  if (!payload) {
    return;
  }

  try {
    const json = JSON.stringify(payload);

    let sent = false;

    /**
     * sendBeacon lebih andal untuk mengirim data saat halaman ditutup.
     */
    if (navigator.sendBeacon) {
      const blob = new Blob([json], {
        type: 'text/plain;charset=UTF-8'
      });

      sent = navigator.sendBeacon(APP_CONFIG.API_URL, blob);
    }

    /**
     * Fallback jika sendBeacon tidak tersedia atau gagal.
     */
    if (!sent && window.fetch) {
      fetch(APP_CONFIG.API_URL, {
        method: 'POST',
        body: json,
        keepalive: true,
        redirect: 'follow'
      });
    }

  } catch (error) {
    console.error('Gagal flush auto-save saat halaman ditutup.', error);
  }
}

function buildSavePayload(items, aksi) {
  const token = getSessionToken();

  if (!token) {
    return null;
  }

  if (!isValidSemester(checklistState.semester)) {
    return null;
  }

  if (!isValidTahunPelajaranClient(checklistState.tahun)) {
    return null;
  }

  if (!checklistState.metode) {
    return null;
  }

  return {
    action: 'saveProgress',
    token: token,
    semester: checklistState.semester,
    tahunPelajaran: checklistState.tahun,
    metodeUpdate: checklistState.metode,
    aksi: aksi,
    items: items
  };
}

/**
 * ============================================================
 * FLUSH ON STAGE NAVIGATION (THROTTLED)
 * ============================================================
 */

function bindStageNavAutoSaveEvents() {
  const stageNav = document.getElementById('stage-nav');

  if (!stageNav) {
    return;
  }

  stageNav.addEventListener('click', function () {
    markUserActivity();
    maybeFlushOnNavigate();
  });
}

function maybeFlushOnNavigate() {
  if (!checklistState.loaded) {
    return;
  }

  if (autoSaveState.saving) {
    return;
  }

  if (!isPageVisible()) {
    return;
  }

  if (!isUserActive()) {
    return;
  }

  const dirtyIds = getDirtyItemIDs();

  if (!dirtyIds.length) {
    return;
  }

  const now = Date.now();

  if (now - autoSaveState.lastSync < autoSaveState.navigateFlushThrottleMs) {
    return;
  }

  const items = buildItemsFromIDs(dirtyIds);

  performSaveProgress(items, 'auto');
}

/**
 * ============================================================
 * NOTE INPUT AUTO UPDATE
 * ============================================================
 */

function bindNoteInputAutoSave() {
  document.addEventListener('input', function (event) {
    const note = event.target.closest('.checklist-item-note');

    if (!note) {
      return;
    }

    const wrapper = note.closest('.checklist-item');

    if (!wrapper || !wrapper.dataset.itemId) {
      return;
    }

    markUserActivity();

    clearTimeout(note._autoSaveDebounce);

    note._autoSaveDebounce = setTimeout(function () {
      onItemCatatanChange(
        wrapper.dataset.itemId,
        note.value.trim()
      );
    }, 700);
  });
}

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function buildItemsFromIDs(dirtyIds) {
  return dirtyIds.map(function (itemID) {
    const state = getItemState(itemID);

    return {
      itemID: itemID,
      checked: Boolean(state.checked),
      catatan: String(state.catatan || '')
    };
  });
}

function updateAutoSaveStatus(message) {
  const el = document.getElementById('autosave-status');

  if (!el) {
    return;
  }

  el.textContent = message;
}

function formatDurationMs(ms) {
  const totalMinutes = Math.ceil(ms / 60000);

  if (totalMinutes <= 1) {
    return '1 menit';
  }

  return totalMinutes + ' menit';
}

/**
 * ============================================================
 * TEST HELPERS
 * ============================================================
 */

/**
 * Jalankan dari console browser jika ingin melihat auto-save bekerja
 * tanpa menunggu 10 menit.
 *
 * Contoh:
 * testAutoSaveDue()
 */
function testAutoSaveDue() {
  autoSaveState.lastSync = 0;
  autoSaveTick();
}

/**
 * Paksa kirim perubahan saat ini juga sebagai auto-save.
 *
 * Contoh:
 * forceAutoSave()
 */
function forceAutoSave() {
  const dirtyIds = getDirtyItemIDs();

  if (!dirtyIds.length) {
    updateAutoSaveStatus('Auto-save: tidak ada perubahan untuk dikirim.');
    return;
  }

  const items = buildItemsFromIDs(dirtyIds);

  performSaveProgress(items, 'auto');
}

/**
 * ============================================================
 * PATCH 4K-2 - HILANGKAN CATATAN CHECKLIST
 * ============================================================
 */

/**
 * Ambil state item tanpa catatan.
 */
function getItemState(itemID) {
  const draft = checklistState.draftItems[itemID];

  if (draft) {
    return {
      checked: Boolean(draft.checked),
      catatan: ''
    };
  }

  const server = checklistState.progress[itemID];

  if (server) {
    return {
      checked: Boolean(server.checked),
      catatan: ''
    };
  }

  return {
    checked: false,
    catatan: ''
  };
}

/**
 * Render item checklist tanpa textarea catatan.
 */
function createItemElement(item) {
  const state = getItemState(item.itemID);

  const wrapper = document.createElement('div');
  wrapper.className = 'checklist-item';
  wrapper.dataset.itemId = item.itemID;

  if (state.checked) {
    wrapper.classList.add('checked');
  }

  const control = document.createElement('div');
  control.className = 'checklist-item-control';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'chk-' + item.itemID;
  checkbox.checked = state.checked;

  checkbox.addEventListener('change', function () {
    wrapper.classList.toggle('checked', checkbox.checked);

    onItemCheckedChange(item.itemID, checkbox.checked);

    const subsection = wrapper.closest('.checklist-subsection');

    if (subsection && typeof updateSubsectionCount === 'function') {
      updateSubsectionCount(subsection);
    }
  });

  control.appendChild(checkbox);

  const body = document.createElement('div');
  body.className = 'checklist-item-body';

  const label = document.createElement('label');
  label.className = 'checklist-item-title';
  label.htmlFor = checkbox.id;
  label.textContent = item.uraian;

  const help = document.createElement('p');
  help.className = 'checklist-item-help';
  help.textContent = formatBulletText(item.halYangHarusDipastikan || '-');

  body.appendChild(label);
  body.appendChild(help);

  wrapper.appendChild(control);
  wrapper.appendChild(body);

  return wrapper;
}

/**
 * Saat kirim item ke backend, catatan selalu kosong.
 */
function buildItemsFromIDs(dirtyIds) {
  return dirtyIds.map(function (itemID) {
    const state = getItemState(itemID);

    return {
      itemID: itemID,
      checked: Boolean(state.checked),
      catatan: ''
    };
  });
}

/**
 * ============================================================
 * PATCH 5A-1 - ALERT CONTAINER TAHAP 8
 * ============================================================
 */

/**
 * Override renderActiveStage untuk menambahkan alert container
 * pada Tahap 8 (Sekolah, Sarana Prasarana).
 */
const previousRenderActiveStage = renderActiveStage;

renderActiveStage = function () {
  previousRenderActiveStage();

  if (Number(checklistState.activeTahap) !== 8) {
    return;
  }

  const content = document.getElementById('checklist-content');

  if (!content) {
    return;
  }

  const alertBox = document.createElement('div');
  alertBox.className = 'alert alert-info show';
  alertBox.style.marginBottom = '16px';
  alertBox.style.fontSize = '0.95rem';
  alertBox.style.lineHeight = '1.6';

  alertBox.innerHTML =
    '<strong>⚠️ Perhatian:</strong><br />' +
    'Permutakhiran data (Tambah, Ubah, Hapus) Sarana Prasarana ' +
    'memerlukan akses akun Kepala Sekolah, dan Dokumen Pendukung ' +
    'pengajuan pembaruan data.';

  const firstCard = content.querySelector('.checklist-subsection');

  if (firstCard) {
    content.insertBefore(alertBox, firstCard);
  } else {
    content.appendChild(alertBox);
  }
};

/**
 * ============================================================
 * PATCH - FORMAT BULLET "•" MENJADI BARIS TERPISAH
 * ============================================================
 * Memecah teks berdasarkan simbol "•" dan menyusunnya kembali
 * sehingga setiap bullet berada di baris sendiri.
 *
 * Contoh:
 * "• A. • B."  ->  "• A.\n• B."
 */
function formatBulletText(text) {
  const raw = String(text || '');

  /**
   * Jika tidak ada bullet, kembalikan apa adanya.
   */
  if (raw.indexOf('•') === -1) {
    return raw;
  }

  const parts = raw
    .split('•')
    .map(function (p) {
      return p.trim();
    })
    .filter(function (p) {
      return p.length > 0;
    });

  if (parts.length === 0) {
    return raw;
  }

  return parts
    .map(function (p) {
      return '• ' + p;
    })
    .join('\n');
}

/**
 * ============================================================
 * PATCH FIX-SAVE - PASTIKAN items SELALU ARRAY
 * ============================================================
 */

function getDirtyItemIDs() {
  const masterIDs = new Set();

  checklistState.master.forEach(function (item) {
    masterIDs.add(item.itemID);
  });

  const candidateIDs = new Set();

  checklistState.master.forEach(function (item) {
    candidateIDs.add(item.itemID);
  });

  Object.keys(checklistState.draftItems || {}).forEach(function (id) {
    if (masterIDs.has(id)) {
      candidateIDs.add(id);
    }
  });

  return Array.from(candidateIDs).filter(function (id) {
    return isItemDirty(id);
  });
}

function buildItemsFromIDs(dirtyIds) {
  const ids = Array.isArray(dirtyIds) ? dirtyIds : [];

  return ids.map(function (itemID) {
    const state = getItemState(itemID);

    return {
      itemID: itemID,
      checked: Boolean(state.checked),
      catatan: ''
    };
  });
}

async function saveNow() {
  hideAuthMessage('checklist-message');

  const period = syncPeriodFromInputs();

  if (!period) {
    return;
  }

  /**
   * GUARD BARU: jika master gagal dimuat, jangan klaim
   * "tidak ada perubahan" — beri tahu user untuk memuat ulang.
   */
  if (!checklistState.master || !checklistState.master.length) {
    showAuthMessage(
      'checklist-message',
      'Master checklist belum termuat. Klik "Muat Ulang" lalu coba lagi.',
      'error'
    );
    return;
  }

  if (!checklistState.metode) {
    showAuthMessage(
      'checklist-message',
      'Pilih metode update terlebih dahulu: Installer atau Patch.',
      'error'
    );
    return;
  }

  const dirtyIds = getDirtyItemIDs();

  if (!dirtyIds.length) {
    showAuthMessage(
      'checklist-message',
      'Tidak ada perubahan yang perlu disimpan.',
      'info'
    );
    return;
  }

  const items = buildItemsFromIDs(dirtyIds);

  const saveButton = document.getElementById('save-checklist-button');

  setButtonLoading(saveButton, true, 'Menyimpan...');

  try {
    const result = await apiRequest(
      'saveProgress',
      {
        semester: period.semester,
        tahunPelajaran: period.tahun,
        metodeUpdate: checklistState.metode,
        aksi: 'manual',
        items: items
      },
      true
    );

    if (!result.success) {
      if (result.code === 401 || result.code === 403) {
        clearSession();
        window.location.href = 'login.html?role=operator';
        return;
      }

      throw new Error(result.message || 'Gagal menyimpan progres.');
    }

    items.forEach(function (item) {
      checklistState.progress[item.itemID] = {
        checked: item.checked,
        catatan: ''
      };
    });

    Object.keys(checklistState.draftItems || {}).forEach(function (id) {
      if (!isItemDirty(id)) {
        delete checklistState.draftItems[id];
      }
    });

    writeDraft();
    updateSaveStatus();
    updateProgressUI();

    showAuthMessage(
      'checklist-message',
      'Progres berhasil disimpan. Total item terkirim: ' + items.length,
      'success'
    );

  } catch (error) {
    showAuthMessage(
      'checklist-message',
      error.message || String(error),
      'error'
    );

  } finally {
    setButtonLoading(saveButton, false, 'Simpan Sekarang');
  }
}
