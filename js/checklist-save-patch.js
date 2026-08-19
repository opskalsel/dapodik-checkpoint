/**
 * ============================================================
 * PATCH SAVE AMAN - DIMUAT SETELAH checklist.js
 * ============================================================
 * Menimpa seluruh alur simpan (manual + auto-save)
 * agar `items` SELALU berupa array.
 * ============================================================
 */

function getDirtyItemIDs() {
  const master = Array.isArray(checklistState.master) ? checklistState.master : [];

  const masterIDs = new Set();
  master.forEach(function (item) {
    masterIDs.add(item.itemID);
  });

  const candidateIDs = new Set();
  master.forEach(function (item) {
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

async function performSaveProgress(items, aksi) {
  const safeItems = Array.isArray(items) ? items : [];

  if (!safeItems.length) {
    return {
      success: true,
      code: 200,
      message: 'Tidak ada item yang perlu disimpan.',
      data: { totalItemsValid: 0 }
    };
  }

  const period = syncPeriodFromInputs();

  if (!period) {
    throw new Error('Periode tidak valid.');
  }

  const result = await apiRequest(
    'saveProgress',
    {
      semester: period.semester,
      tahunPelajaran: period.tahun,
      metodeUpdate: checklistState.metode,
      aksi: aksi || 'manual',
      items: safeItems
    },
    true
  );

  if (result && result.success) {
    safeItems.forEach(function (item) {
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

    if (typeof updateSaveStatus === 'function') updateSaveStatus();
    if (typeof updateProgressUI === 'function') updateProgressUI();
  }

  return result;
}

async function saveNow() {
  hideAuthMessage('checklist-message');

  const period = syncPeriodFromInputs();

  if (!period) {
    return;
  }

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

  if (saveButton) setButtonLoading(saveButton, true, 'Menyimpan...');

  try {
    const result = await performSaveProgress(items, 'manual');

    if (!result) {
      throw new Error('Respons kosong dari server.');
    }

    if (!result.success) {
      if (result.code === 401 || result.code === 403) {
        clearSession();
        window.location.href = 'login.html?role=operator';
        return;
      }

      throw new Error(result.message || 'Gagal menyimpan progres.');
    }

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
    if (saveButton) setButtonLoading(saveButton, false, 'Simpan Sekarang');
  }
}
