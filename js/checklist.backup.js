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
    tahunInput.value =
      uiState.tahunPelajaran || APP_CONFIG.DEFAULT_TAHUN_PELAJARAN;
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

  /**
   * Muat draft lokal untuk periode ini.
   * Draft lokal dipakai agar perubahan yang belum disimpan tetap ada.
   */
  const draft = loadDraft();

  checklistState.draftItems = draft.items || {};
  checklistState.dirty = draft.dirty || {};

  if (draft.metodeUpdate) {
    checklistState.metode = draft.metodeUpdate;
  } else {
    checklistState.metode = checklistState.metode || 'Installer';
  }

  setMetodeRadio(checklistState.metode);

  try {
    const masterPromise = apiRequest(
      'getMaster',
      {
        semester: period.semester
      },
      true
    );

    const progressPromise = apiRequest(
      'getProgress',
      {
        semester: period.semester,
        tahunPelajaran: period.tahun
      },
      true
    );

    const masterResult = await masterPromise;

    if (!masterResult.success) {
      if (masterResult.code === 401 || masterResult.code === 403) {
        clearSession();
        window.location.href = 'login.html?role=operator';
        return;
      }

      throw new Error(masterResult.message || 'Gagal memuat master checklist.');
    }

    checklistState.master = masterResult.data.items || [];
    checklistState.stages = masterResult.data.stages || [];

    const progressResult = await progressPromise;

    if (!progressResult.success) {
      if (progressResult.code === 401 || progressResult.code === 403) {
        clearSession();
        window.location.href = 'login.html?role=operator';
        return;
      }

      /**
       * Jika progres gagal dimuat, tetap tampilkan checklist
       * dengan progres kosong.
       */
      checklistState.progress = {};

      showAuthMessage(
        'checklist-message',
        'Checklist berhasil dimuat, tetapi progres tersimpan gagal diambil. ' +
        (progressResult.message || ''),
        'info'
      );

    } else {
      checklistState.progress = progressResult.data.progress || {};
    }

    checklistState.activeTahap = 1;
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
  help.textContent = item.halYangHarusDipastikan || '-';

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