/**
 * ============================================================
 * DAPODIK CHECKPOINT - RIWAYAT & PERBANDINGAN PERIODE
 * ============================================================
 * Tahap 4J
 * - Daftar riwayat checklist
 * - Detail progres per tahap
 * - Perbandingan dua periode
 * ============================================================
 */

const riwayatState = {
  history: []
};

const RIWAYAT_STAGE_NAMES = {
  1: 'Persiapan Update Dapodik',
  2: 'Rombel - Guru Sertifikasi',
  3: 'Pembelajaran - Guru Sertifikasi',
  4: 'Validasi Penugasan - Guru Sertifikasi',
  5: 'Pembelajaran - Guru Non Sertifikasi',
  6: 'Validasi Penugasan - Guru Non Sertifikasi',
  7: 'Peserta Didik',
  8: 'Sarana Prasarana',
  9: 'Validasi Data Lokal',
  10: 'Sinkronisasi',
  11: 'Pasca Sinkronisasi',
  12: 'Arsip'
};

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('riwayat-page')) {
    initRiwayat();
  }
});

/**
 * ============================================================
 * INIT
 * ============================================================
 */

async function initRiwayat() {
  bindRiwayatControls();
  bindCompareControls();

  const user = getSessionUser();
  const token = getSessionToken();

  if (!user || !token) {
    window.location.href = 'login.html?role=operator';
    return;
  }

  const sessionValid = await validateRiwayatSession();

  if (!sessionValid) {
    return;
  }

  await loadHistory();
}

function bindRiwayatControls() {
  const reloadButton = document.getElementById('reload-riwayat-button');

  if (reloadButton) {
    reloadButton.addEventListener('click', function () {
      loadHistory();
    });
  }

  const logoutButton = document.getElementById('logout-button');

  if (logoutButton) {
    logoutButton.addEventListener('click', function () {
      clearSession();
      window.location.href = 'index.html';
    });
  }
}

async function validateRiwayatSession() {
  try {
    const result = await apiRequest('validateToken', {}, true);

    if (!result.success) {
      clearSession();
      window.location.href = 'login.html?role=operator';
      return false;
    }

    if (result.data && result.data.user) {
      saveSession(getSessionToken(), result.data.user);
    }

    return true;

  } catch (error) {
    showAuthMessage(
      'riwayat-message',
      error.message || String(error),
      'error'
    );

    return false;
  }
}

/**
 * ============================================================
 * LOAD HISTORY
 * ============================================================
 */

async function loadHistory() {
  hideAuthMessage('riwayat-message');

  const reloadButton = document.getElementById('reload-riwayat-button');

  setButtonLoading(reloadButton, true, 'Memuat...');

  try {
    const result = await apiRequest('getHistory', {}, true);

    if (!result.success) {
      if (result.code === 401 || result.code === 403) {
        clearSession();
        window.location.href = 'login.html?role=operator';
        return;
      }

      throw new Error(result.message || 'Gagal memuat riwayat.');
    }

    riwayatState.history = result.data.history || [];

    renderHistory(riwayatState.history);
    renderCompareOptions();

  } catch (error) {
    showAuthMessage(
      'riwayat-message',
      error.message || String(error),
      'error'
    );

  } finally {
    setButtonLoading(reloadButton, false, 'Muat Ulang');
  }
}

/**
 * ============================================================
 * RENDER HISTORY LIST
 * ============================================================
 */

function renderHistory(history) {
  const list = document.getElementById('riwayat-list');

  if (!list) {
    return;
  }

  list.innerHTML = '';

  if (!history.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.textContent =
      'Belum ada riwayat checklist. Silakan buka halaman checklist dan simpan progres untuk membuat snapshot riwayat.';
    list.appendChild(empty);
    return;
  }

  history.forEach(function (row) {
    list.appendChild(createHistoryCard(row));
  });
}

function createHistoryCard(row) {
  const card = document.createElement('section');
  card.className = 'card riwayat-card';

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'riwayat-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'riwayat-title';

  const title = document.createElement('strong');
  title.textContent = row.semester + ' • ' + row.tahunPelajaran;

  const meta = document.createElement('div');
  meta.className = 'riwayat-meta';

  const statusBadge = document.createElement('span');
  statusBadge.className = getStatusBadgeClass(row.statusRingkasan);
  statusBadge.textContent = row.statusRingkasan || 'Belum Diketahui';

  const percentBadge = document.createElement('span');
  percentBadge.className = 'badge badge-blue';
  percentBadge.textContent = formatPercentRiwayat(row.persenTotal);

  const dateBadge = document.createElement('span');
  dateBadge.className = 'badge badge-grey';
  dateBadge.textContent = 'Update: ' + formatDateID(row.tglSnapshot);

  meta.appendChild(statusBadge);
  meta.appendChild(percentBadge);
  meta.appendChild(dateBadge);

  titleWrap.appendChild(title);
  titleWrap.appendChild(meta);

  const chevron = document.createElement('span');
  chevron.className = 'subsection-chevron';
  chevron.textContent = '▾';

  header.appendChild(titleWrap);
  header.appendChild(chevron);

  const body = document.createElement('div');
  body.className = 'riwayat-body hidden';

  header.addEventListener('click', function () {
    body.classList.toggle('hidden');
    card.classList.toggle('collapsed');
  });

  const stages = convertPersenPerTahapToArray(row.persenPerTahap);

  if (!stages.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Detail tahap belum tersedia pada snapshot ini.';
    body.appendChild(empty);
  } else {
    stages.forEach(function (stage) {
      body.appendChild(createRiwayatStageRow(stage));
    });
  }

  card.appendChild(header);
  card.appendChild(body);

  return card;
}

function createRiwayatStageRow(stage) {
  const row = document.createElement('div');
  row.className = 'stage-row';

  const info = document.createElement('div');
  info.className = 'stage-info';

  const title = document.createElement('strong');
  title.textContent =
    stage.tahapID + '. ' + (stage.namaTahap || 'Tahap ' + stage.tahapID);

  const meta = document.createElement('span');
  meta.textContent =
    (stage.checkedItems || 0) +
    '/' +
    (stage.totalItems || 0) +
    ' item • ' +
    formatPercentRiwayat(stage.persen);

  info.appendChild(title);
  info.appendChild(meta);

  const track = document.createElement('div');
  track.className = 'progress-track small';

  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  fill.style.width = Number(stage.persen || 0) + '%';

  track.appendChild(fill);

  row.appendChild(info);
  row.appendChild(track);

  return row;
}

function convertPersenPerTahapToArray(persenPerTahap) {
  if (!persenPerTahap || typeof persenPerTahap !== 'object') {
    return [];
  }

  return Object.keys(persenPerTahap)
    .map(function (key) {
      return Object.assign(
        {
          tahapID: Number(key)
        },
        persenPerTahap[key]
      );
    })
    .sort(function (a, b) {
      return Number(a.tahapID) - Number(b.tahapID);
    });
}

function getStatusBadgeClass(status) {
  if (status === 'Selesai') {
    return 'badge badge-green';
  }

  if (status === 'Hampir Selesai') {
    return 'badge badge-blue';
  }

  if (status === 'Sedang Berjalan') {
    return 'badge badge-yellow';
  }

  if (status === 'Baru Dimulai') {
    return 'badge badge-orange';
  }

  return 'badge badge-grey';
}

/**
 * ============================================================
 * COMPARE PERIODS
 * ============================================================
 */

function bindCompareControls() {
  const compareButton = document.getElementById('compare-button');

  if (compareButton) {
    compareButton.addEventListener('click', function () {
      renderComparison();
    });
  }

  const exportExcelButton = document.getElementById('compare-export-excel-button');

  if (exportExcelButton) {
    exportExcelButton.addEventListener('click', function () {
      handleCompareExportExcel();
    });
  }

  const exportPdfButton = document.getElementById('compare-export-pdf-button');

  if (exportPdfButton) {
    exportPdfButton.addEventListener('click', function () {
      handleCompareExportPDF();
    });
  }
}

function getPeriodKey(row) {
  return row.semester + '|' + row.tahunPelajaran;
}

function getSnapshotByKey(key) {
  return riwayatState.history.find(function (row) {
    return getPeriodKey(row) === key;
  }) || null;
}

function renderCompareOptions() {
  const selectA = document.getElementById('compare-period-a');
  const selectB = document.getElementById('compare-period-b');
  const compareButton = document.getElementById('compare-button');

  if (!selectA || !selectB) {
    return;
  }

  selectA.innerHTML = '';
  selectB.innerHTML = '';

  const history = riwayatState.history;

  if (!history.length) {
    addPlaceholderOption(selectA, 'Belum ada periode');
    addPlaceholderOption(selectB, 'Belum ada periode');

    selectA.disabled = true;
    selectB.disabled = true;

    if (compareButton) {
      compareButton.disabled = true;
    }

    const result = document.getElementById('compare-result');

    if (result) {
      result.innerHTML = '';
    }

    return;
  }

  if (history.length >= 2) {
    history.forEach(function (row) {
      addPeriodOption(selectA, row);
      addPeriodOption(selectB, row);
    });

    selectA.disabled = false;
    selectB.disabled = false;

    if (compareButton) {
      compareButton.disabled = false;
    }

    /**
     * Default:
     * Periode A = snapshot lebih lama
     * Periode B = snapshot lebih baru
     *
     * History diasumsikan terurut dari yang terbaru.
     */
    selectA.value = getPeriodKey(history[1]);
    selectB.value = getPeriodKey(history[0]);

    renderComparison();

  } else {
    addPeriodOption(selectA, history[0]);
    addPlaceholderOption(selectB, 'Butuh periode kedua');

    selectA.disabled = false;
    selectB.disabled = true;

    if (compareButton) {
      compareButton.disabled = true;
    }

    const result = document.getElementById('compare-result');

    if (result) {
      result.innerHTML =
        '<div class="muted">Perbandingan membutuhkan minimal dua periode riwayat.</div>';
    }
  }
}

function addPlaceholderOption(select, text) {
  const option = document.createElement('option');

  option.value = '';
  option.textContent = text;

  select.appendChild(option);
}

function addPeriodOption(select, row) {
  const option = document.createElement('option');

  option.value = getPeriodKey(row);

  option.textContent =
    row.semester +
    ' ' +
    row.tahunPelajaran +
    ' • ' +
    formatPercentRiwayat(row.persenTotal) +
    ' • ' +
    formatDateID(row.tglSnapshot);

  select.appendChild(option);
}

function renderComparison() {
  hideAuthMessage('compare-message');
  hideCompareExportActions();

  const selectA = document.getElementById('compare-period-a');
  const selectB = document.getElementById('compare-period-b');

  if (!selectA || !selectB) {
    return;
  }

  const keyA = selectA.value;
  const keyB = selectB.value;

  if (!keyA || !keyB) {
    showAuthMessage(
      'compare-message',
      'Pilih dua periode yang akan dibandingkan.',
      'error'
    );
    return;
  }

  if (keyA === keyB) {
    showAuthMessage(
      'compare-message',
      'Pilih dua periode yang berbeda untuk membandingkan.',
      'error'
    );
    return;
  }

  const snapshotA = getSnapshotByKey(keyA);
  const snapshotB = getSnapshotByKey(keyB);

  if (!snapshotA || !snapshotB) {
    showAuthMessage(
      'compare-message',
      'Snapshot periode tidak ditemukan.',
      'error'
    );
    return;
  }

  const data = buildComparisonData(snapshotA, snapshotB);

  renderComparisonResult(data);
}

function buildComparisonData(a, b) {
  const rows = [];

  for (let tahapID = 1; tahapID <= 12; tahapID++) {
    const stageA = (a.persenPerTahap || {})[tahapID] || {};
    const stageB = (b.persenPerTahap || {})[tahapID] || {};

    const persenA = Number(stageA.persen || 0);
    const persenB = Number(stageB.persen || 0);

    const diff = roundRiwayat(persenB - persenA, 2);

    rows.push({
      tahapID: tahapID,
      namaTahap: getStageName(tahapID, stageA, stageB),
      persenA: persenA,
      persenB: persenB,
      diff: diff,
      status: getStatusFromDiff(diff),
      itemsA: (stageA.checkedItems || 0) + '/' + (stageA.totalItems || 0),
      itemsB: (stageB.checkedItems || 0) + '/' + (stageB.totalItems || 0)
    });
  }

  const totalA = Number(a.persenTotal || 0);
  const totalB = Number(b.persenTotal || 0);
  const totalDiff = roundRiwayat(totalB - totalA, 2);

  return {
    a: a,
    b: b,
    rows: rows,
    totalA: totalA,
    totalB: totalB,
    totalDiff: totalDiff
  };
}

function getStageName(tahapID, stageA, stageB) {
  if (stageA && stageA.namaTahap) {
    return stageA.namaTahap;
  }

  if (stageB && stageB.namaTahap) {
    return stageB.namaTahap;
  }

  return RIWAYAT_STAGE_NAMES[tahapID] || 'Tahap ' + tahapID;
}

function renderComparisonResult(data) {
  const container = document.getElementById('compare-result');

  if (!container) {
    return;
  }

  container.innerHTML = '';
  riwayatState.lastComparisonData = data;

  const exportActions = document.getElementById('compare-export-actions');

  if (exportActions) {
    exportActions.style.display = 'flex';
  }

  const labelA = data.a.semester + ' ' + data.a.tahunPelajaran;
  const labelB = data.b.semester + ' ' + data.b.tahunPelajaran;

  const summary = document.createElement('div');
  summary.className = 'compare-summary';

  const totalDeltaClass = getDeltaClass(data.totalDiff);

  summary.innerHTML =
    '<div class="compare-card">' +
      '<span class="compare-card-label">Periode A</span>' +
      '<strong>' + escapeHtmlRiwayat(labelA) + '</strong>' +
      '<span class="muted">' +
        formatPercentRiwayat(data.totalA) +
        ' • Update ' +
        formatDateID(data.a.tglSnapshot) +
      '</span>' +
    '</div>' +

    '<div class="compare-card">' +
      '<span class="compare-card-label">Periode B</span>' +
      '<strong>' + escapeHtmlRiwayat(labelB) + '</strong>' +
      '<span class="muted">' +
        formatPercentRiwayat(data.totalB) +
        ' • Update ' +
        formatDateID(data.b.tglSnapshot) +
      '</span>' +
    '</div>' +

    '<div class="compare-card">' +
      '<span class="compare-card-label">Selisih Total (B - A)</span>' +
      '<strong class="' + totalDeltaClass + '">' +
        formatDeltaRiwayat(data.totalDiff) +
      '</strong>' +
      '<span class="muted">' + getStatusFromDiff(data.totalDiff) + '</span>' +
    '</div>';

  container.appendChild(summary);

  let tableHtml =
    '<table class="compare-table">' +
      '<thead>' +
        '<tr>' +
          '<th>Tahap</th>' +
          '<th>' + escapeHtmlRiwayat(labelA) + '</th>' +
          '<th>' + escapeHtmlRiwayat(labelB) + '</th>' +
          '<th>Selisih</th>' +
          '<th>Status</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>';

  data.rows.forEach(function (row) {
    const deltaClass = getDeltaClass(row.diff);
    const statusBadge = getStatusBadgeFromDiff(row.diff);

    tableHtml +=
      '<tr>' +
        '<td title="Periode A: ' + row.itemsA + ' • Periode B: ' + row.itemsB + '">' +
          row.tahapID + '. ' + escapeHtmlRiwayat(row.namaTahap) +
        '</td>' +
        '<td>' + formatPercentRiwayat(row.persenA) + '</td>' +
        '<td>' + formatPercentRiwayat(row.persenB) + '</td>' +
        '<td class="' + deltaClass + '">' + formatDeltaRiwayat(row.diff) + '</td>' +
        '<td><span class="' + statusBadge + '">' + row.status + '</span></td>' +
      '</tr>';
  });

  tableHtml +=
        '<tr class="compare-total">' +
          '<td>Total</td>' +
          '<td>' + formatPercentRiwayat(data.totalA) + '</td>' +
          '<td>' + formatPercentRiwayat(data.totalB) + '</td>' +
          '<td class="' + getDeltaClass(data.totalDiff) + '">' +
            formatDeltaRiwayat(data.totalDiff) +
          '</td>' +
          '<td>' +
            '<span class="' + getStatusBadgeFromDiff(data.totalDiff) + '">' +
              getStatusFromDiff(data.totalDiff) +
            '</span>' +
          '</td>' +
        '</tr>' +
      '</tbody>' +
    '</table>';

  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';
  tableWrap.innerHTML = tableHtml;

  container.appendChild(tableWrap);
}

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function formatPercentRiwayat(value) {
  const num = Number(value || 0);

  return (Math.round(num * 100) / 100).toLocaleString('id-ID') + '%';
}

function formatDeltaRiwayat(diff) {
  const num = Number(diff || 0);

  if (num > 0) {
    return '+' + formatPercentRiwayat(num);
  }

  return formatPercentRiwayat(num);
}

function formatDateID(isoString) {
  if (!isoString) {
    return '-';
  }

  try {
    const date = new Date(isoString);

    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });

  } catch (error) {
    return isoString;
  }
}

function roundRiwayat(value, decimals) {
  const factor = Math.pow(10, decimals);

  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function getDeltaClass(diff) {
  if (diff > 0) {
    return 'compare-delta-up';
  }

  if (diff < 0) {
    return 'compare-delta-down';
  }

  return 'compare-delta-flat';
}

function getStatusFromDiff(diff) {
  if (diff > 0) {
    return 'Naik';
  }

  if (diff < 0) {
    return 'Turun';
  }

  return 'Tetap';
}

function getStatusBadgeFromDiff(diff) {
  if (diff > 0) {
    return 'badge badge-green';
  }

  if (diff < 0) {
    return 'badge badge-red';
  }

  return 'badge badge-grey';
}

function escapeHtmlRiwayat(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * ============================================================
 * PATCH 4K-1 - EXPORT PERBANDINGAN PERIODE
 * ============================================================
 */

/**
 * Sembunyikan tombol ekspor perbandingan
 */
function hideCompareExportActions() {
  const el = document.getElementById('compare-export-actions');

  if (el) {
    el.style.display = 'none';
  }
}

/**
 * ============================================================
 * EXPORT EXCEL PERBANDINGAN
 * ============================================================
 */

function handleCompareExportExcel() {
  hideAuthMessage('compare-message');

  const data = riwayatState.lastComparisonData;

  if (!data) {
    showAuthMessage(
      'compare-message',
      'Lakukan perbandingan terlebih dahulu sebelum ekspor.',
      'error'
    );
    return;
  }

  if (typeof XLSX === 'undefined') {
    showAuthMessage(
      'compare-message',
      'Library Excel (SheetJS) belum termuat. Periksa koneksi internet dan CDN.',
      'error'
    );
    return;
  }

  const exportExcelButton = document.getElementById('compare-export-excel-button');

  setButtonLoading(exportExcelButton, true, 'Menyiapkan...');

  try {
    const user = getSessionUser() || {};

    const labelA = data.a.semester + ' ' + data.a.tahunPelajaran;
    const labelB = data.b.semester + ' ' + data.b.tahunPelajaran;

    const rows = [
      ['DAPODIK CHECKPOINT - LAPORAN PERBANDINGAN'],
      [],
      ['Nama Sekolah', user.namaSekolah || '-'],
      ['NPSN', user.npsn || '-'],
      ['Periode A', labelA],
      ['Periode B', labelB],
      ['Tanggal Unduh', formatDateID(new Date().toISOString())],
      ['Nama Operator', user.namaOperator || '-'],
      [],
      ['Total Progres Periode A', formatPercentRiwayat(data.totalA)],
      ['Total Progres Periode B', formatPercentRiwayat(data.totalB)],
      ['Selisih Total', formatDeltaRiwayat(data.totalDiff)],
      ['Status Total', getStatusFromDiff(data.totalDiff)],
      [],
      ['PERBANDINGAN PER TAHAP'],
      [
        'No',
        'Tahap',
        '% Periode A',
        '% Periode B',
        'Selisih',
        'Status',
        'Item Periode A',
        'Item Periode B'
      ]
    ];

    data.rows.forEach(function (row) {
      rows.push([
        row.tahapID,
        row.namaTahap,
        formatPercentRiwayat(row.persenA),
        formatPercentRiwayat(row.persenB),
        formatDeltaRiwayat(row.diff),
        row.status,
        row.itemsA,
        row.itemsB
      ]);
    });

    const wb = XLSX.utils.book_new();

    const ws = XLSX.utils.aoa_to_sheet(rows);

    XLSX.utils.book_append_sheet(wb, ws, 'Perbandingan');

    const filename = buildCompareFilename('xlsx');

    XLSX.writeFile(wb, filename);

    showAuthMessage(
      'compare-message',
      'File Excel perbandingan berhasil dibuat: ' + filename,
      'success'
    );

  } catch (error) {
    showAuthMessage(
      'compare-message',
      'Gagal membuat Excel: ' + (error.message || String(error)),
      'error'
    );

  } finally {
    setButtonLoading(exportExcelButton, false, 'Export Excel Perbandingan');
  }
}

/**
 * ============================================================
 * EXPORT PDF PERBANDINGAN
 * ============================================================
 */

function handleCompareExportPDF() {
  hideAuthMessage('compare-message');

  const data = riwayatState.lastComparisonData;

  if (!data) {
    showAuthMessage(
      'compare-message',
      'Lakukan perbandingan terlebih dahulu sebelum ekspor.',
      'error'
    );
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showAuthMessage(
      'compare-message',
      'Library PDF (jsPDF) belum termuat. Periksa koneksi internet dan CDN.',
      'error'
    );
    return;
  }

  const exportPdfButton = document.getElementById('compare-export-pdf-button');

  setButtonLoading(exportPdfButton, true, 'Menyiapkan...');

  try {
    const jsPDFClass = window.jspdf.jsPDF;

    const doc = new jsPDFClass({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    if (typeof doc.autoTable !== 'function') {
      throw new Error('Plugin jspdf-autotable belum termuat.');
    }

    const user = getSessionUser() || {};

    const labelA = data.a.semester + ' ' + data.a.tahunPelajaran;
    const labelB = data.b.semester + ' ' + data.b.tahunPelajaran;

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    let y = margin;

    /**
     * Header laporan
     */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);

    doc.text(
      'LAPORAN PERBANDINGAN CHECKPOINT DAPODIK',
      pageWidth / 2,
      y + 6,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    doc.text(
      'Periode A: ' + labelA + '  |  Periode B: ' + labelB,
      pageWidth / 2,
      y + 12,
      { align: 'center' }
    );

    doc.setFontSize(8);

    y += 24;

    /**
     * Identitas
     */
    doc.autoTable({
      startY: y,
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: 1.8
      },
      columnStyles: {
        0: {
          fontStyle: 'bold',
          cellWidth: 45
        }
      },
      body: [
        ['Nama Sekolah', user.namaSekolah || '-'],
        ['NPSN', user.npsn || '-'],
        ['Tanggal Unduh', formatDateID(new Date().toISOString())],
        ['Nama Operator', user.namaOperator || '-']
      ]
    });

    y = doc.lastAutoTable.finalY + 4;

    /**
     * Ringkasan total
     */
    doc.autoTable({
      startY: y,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [11, 60, 93]
      },
      head: [
        ['Total Periode A', 'Total Periode B', 'Selisih Total', 'Status Total']
      ],
      body: [
        [
          formatPercentRiwayat(data.totalA),
          formatPercentRiwayat(data.totalB),
          formatDeltaRiwayat(data.totalDiff),
          getStatusFromDiff(data.totalDiff)
        ]
      ]
    });

    y = doc.lastAutoTable.finalY + 6;

    /**
     * Tabel perbandingan per tahap
     */
    doc.autoTable({
      startY: y,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 1.8
      },
      headStyles: {
        fillColor: [31, 111, 178]
      },
      columnStyles: {
        0: {
          cellWidth: 10
        }
      },
      head: [
        ['No', 'Tahap', labelA, labelB, 'Selisih', 'Status']
      ],
      body: data.rows.map(function (row) {
        return [
          row.tahapID,
          row.namaTahap,
          formatPercentRiwayat(row.persenA),
          formatPercentRiwayat(row.persenB),
          formatDeltaRiwayat(row.diff),
          row.status
        ];
      })
    });

    y = doc.lastAutoTable.finalY + 8;

    /**
     * Tanda tangan
     */
    if (y > pageHeight - 55) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const sigY = y + 6;

    const operatorLabel = getNIPLabelRiwayat(user.statusKepegawaianOperator);
    const kepsekLabel = getNIPLabelRiwayat(user.statusKepegawaianKepalaSekolah);

    doc.text('Operator Sekolah,', margin, sigY);
    doc.text('Kepala Sekolah,', pageWidth - margin - 55, sigY);

    doc.text(
      user.namaOperator || '(..................................)',
      margin,
      sigY + 20
    );

    doc.text(
      user.namaKepalaSekolah || '(..................................)',
      pageWidth - margin - 55,
      sigY + 20
    );

    if (user.nipOperator) {
      doc.text(
        operatorLabel + ' ' + user.nipOperator,
        margin,
        sigY + 24
      );
    }

    if (user.nipKepalaSekolah) {
      doc.text(
        kepsekLabel + ' ' + user.nipKepalaSekolah,
        pageWidth - margin - 55,
        sigY + 24
      );
    }

    /**
     * Footer semua halaman
     */
    const totalPages = doc.internal.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120);

      doc.text(
        'Dapodik Checkpoint - alat bantu pemantauan progres, bukan aplikasi resmi Dapodik Kemendikdasmen.',
        margin,
        pageHeight - 8
      );

      doc.text(
        'Halaman ' + i + ' dari ' + totalPages,
        pageWidth - margin,
        pageHeight - 8,
        { align: 'right' }
      );
    }

    const filename = buildCompareFilename('pdf');

    doc.save(filename);

    showAuthMessage(
      'compare-message',
      'File PDF perbandingan berhasil dibuat: ' + filename,
      'success'
    );

  } catch (error) {
    showAuthMessage(
      'compare-message',
      'Gagal membuat PDF: ' + (error.message || String(error)),
      'error'
    );

  } finally {
    setButtonLoading(exportPdfButton, false, 'Export PDF Perbandingan');
  }
}

/**
 * ============================================================
 * HELPERS FILENAME PERBANDINGAN
 * ============================================================
 */

/**
 * Buat kode periode untuk nama file.
 *
 * Contoh:
 * Ganjil 2026/2027 -> 20261
 * Genap 2026/2027  -> 20262
 */
function buildComparePeriodCode(snapshot) {
  if (!snapshot) {
    return '00000';
  }

  const match = String(snapshot.tahunPelajaran || '').match(/^(\d{4})\/(\d{4})$/);

  const tahunAwal = match
    ? match[1]
    : String(new Date().getFullYear());

  const kodeSemester = snapshot.semester === 'Genap' ? '2' : '1';

  return tahunAwal + kodeSemester;
}

/**
 * Bersihkan nama sekolah agar aman sebagai nama file
 */
function sanitizeCompareFilenamePart(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tanggal unduh format dd-mm-yyyy
 */
function formatCompareDownloadDate() {
  const now = new Date();

  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();

  return dd + '-' + mm + '-' + yyyy;
}

/**
 * Nama file perbandingan:
 * Nama Sekolah-Dapo_Checkpoint-Perbandingan-20261_vs_20262-dd-mm-yyyy.pdf
 */
function buildCompareFilename(extension) {
  const user = getSessionUser();

  const school =
    sanitizeCompareFilenamePart(user ? user.namaSekolah : '') ||
    'Sekolah';

  const data = riwayatState.lastComparisonData;

  const codeA = data ? buildComparePeriodCode(data.a) : 'periode-a';
  const codeB = data ? buildComparePeriodCode(data.b) : 'periode-b';

  return (
    school +
    '-Dapo_Checkpoint-Perbandingan-' +
    codeA +
    '_vs_' +
    codeB +
    '-' +
    formatCompareDownloadDate() +
    '.' +
    extension
  );
}

/**
 * ============================================================
 * PATCH 4K-2 - NIP/NIY COMPARE EXPORT
 * ============================================================
 */

function getNIPLabelRiwayat(status) {
  if (status === 'PNS') {
    return 'NIP';
  }

  if (status === 'Non-PNS') {
    return 'NIY';
  }

  return 'NIP/NIY';
}

