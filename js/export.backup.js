/**
 * ============================================================
 * DAPODIK CHECKPOINT - EXPORT PAGE
 * ============================================================
 * Tahap 4I
 * - Ekspor Excel (.xlsx)
 * - Ekspor PDF laporan formal
 * ============================================================
 */

const exportState = {
  loaded: false,
  user: null,
  semester: '',
  tahun: '',
  metode: 'Semua',
  master: [],
  stages: [],
  progress: {}
};

let exportLogoDataUrl = null;

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('export-page')) {
    initExport();
  }
});

/**
 * ============================================================
 * INIT
 * ============================================================
 */

async function initExport() {
  preloadExportLogo();
  bindExportControls();

  const user = getSessionUser();
  const token = getSessionToken();

  if (!user || !token) {
    window.location.href = 'login.html?role=operator';
    return;
  }

  exportState.user = user;

  loadExportPeriodFromStorage();

  const sessionValid = await validateExportSession();

  if (!sessionValid) {
    return;
  }

  await loadExportData();
}

function bindExportControls() {
  const loadButton = document.getElementById('load-export-button');
  const excelButton = document.getElementById('export-excel-button');
  const pdfButton = document.getElementById('export-pdf-button');
  const logoutButton = document.getElementById('logout-button');

  if (loadButton) {
    loadButton.addEventListener('click', function () {
      loadExportData();
    });
  }

  if (excelButton) {
    excelButton.addEventListener('click', function () {
      handleExportExcel();
    });
  }

  if (pdfButton) {
    pdfButton.addEventListener('click', function () {
      handleExportPDF();
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', function () {
      clearSession();
      window.location.href = 'index.html';
    });
  }
}

async function validateExportSession() {
  try {
    const result = await apiRequest('validateToken', {}, true);

    if (!result.success) {
      clearSession();
      window.location.href = 'login.html?role=operator';
      return false;
    }

    if (result.data && result.data.user) {
      saveSession(getSessionToken(), result.data.user);
      exportState.user = result.data.user;
    }

    return true;

  } catch (error) {
    showAuthMessage(
      'export-message',
      error.message || String(error),
      'error'
    );

    return false;
  }
}

function loadExportPeriodFromStorage() {
  const uiState = getExportUiState();

  const semesterSelect = document.getElementById('export-semester');
  const tahunInput = document.getElementById('export-tahun');

  if (semesterSelect) {
    semesterSelect.value = uiState.semester || APP_CONFIG.DEFAULT_SEMESTER;
  }

  if (tahunInput) {
  tpInitTahunSelect('export-tahun');
  }
}

function getExportUiState() {
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

/**
 * ============================================================
 * LOAD DATA
 * ============================================================
 */

function syncExportPeriod() {
  const semesterSelect = document.getElementById('export-semester');
  const tahunInput = document.getElementById('export-tahun');

  const semester = semesterSelect
    ? semesterSelect.value
    : APP_CONFIG.DEFAULT_SEMESTER;

  const tahun = normalizeTahunExport(
    tahunInput
      ? tahunInput.value
      : APP_CONFIG.DEFAULT_TAHUN_PELAJARAN
  );

  if (!isValidSemesterExport(semester)) {
    showAuthMessage(
      'export-message',
      'Semester tidak valid. Gunakan Ganjil atau Genap.',
      'error'
    );
    return null;
  }

  if (!isValidTahunExport(tahun)) {
    showAuthMessage(
      'export-message',
      'Tahun pelajaran tidak valid. Gunakan format seperti 2026/2027.',
      'error'
    );
    return null;
  }

  return {
    semester: semester,
    tahun: tahun
  };
}

function getExportMethod() {
  const metodeSelect = document.getElementById('export-metode');

  if (!metodeSelect) {
    return 'Semua';
  }

  return metodeSelect.value;
}

async function loadExportData() {
  hideAuthMessage('export-message');

  const period = syncExportPeriod();

  if (!period) {
    return;
  }

  const loadButton = document.getElementById('load-export-button');

  setButtonLoading(loadButton, true, 'Memuat...');

  exportState.loaded = false;
  exportState.semester = period.semester;
  exportState.tahun = period.tahun;
  exportState.metode = getExportMethod();

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

    exportState.master = masterResult.data.items || [];
    exportState.stages = masterResult.data.stages || [];

    const progressResult = await progressPromise;

    if (progressResult.success) {
      exportState.progress = progressResult.data.progress || {};
    } else {
      if (progressResult.code === 401 || progressResult.code === 403) {
        clearSession();
        window.location.href = 'login.html?role=operator';
        return;
      }

      exportState.progress = {};

      showAuthMessage(
        'export-message',
        'Master checklist dimuat, tetapi progres gagal diambil. Laporan akan menggunakan status kosong.',
        'info'
      );
    }

    exportState.loaded = true;

    renderExportPreview();

  } catch (error) {
    showAuthMessage(
      'export-message',
      error.message || String(error),
      'error'
    );

  } finally {
    setButtonLoading(loadButton, false, 'Muat Data');
  }
}

/**
 * ============================================================
 * BUILD EXPORT DATA
 * ============================================================
 */

function getVisibleItemsForExport() {
  const metode = exportState.metode;

  return exportState.master.filter(function (item) {
    if (metode === 'Semua') {
      return true;
    }

    const grup = String(item.grupMetodeUpdate || 'Umum');

    if (grup === 'Umum') {
      return true;
    }

    return grup.toLowerCase() === metode.toLowerCase();
  });
}

function buildExportData() {
  const items = getVisibleItemsForExport();
  const progress = exportState.progress;

  const stageMap = {};

  exportState.stages.forEach(function (stage) {
    stageMap[stage.tahapID] = {
      tahapID: stage.tahapID,
      namaTahap: stage.namaTahap,
      kelompokPrioritas: stage.kelompokPrioritas || '',
      urgensi: stage.urgensi || '',
      warna: stage.warna || '',
      totalItems: 0,
      checkedItems: 0,
      totalWeight: 0,
      checkedWeight: 0,
      persen: 0,
      items: []
    };
  });

  items.forEach(function (item) {
    if (!stageMap[item.tahapID]) {
      stageMap[item.tahapID] = {
        tahapID: item.tahapID,
        namaTahap: item.namaTahap || 'Tahap ' + item.tahapID,
        kelompokPrioritas: '',
        urgensi: '',
        warna: '',
        totalItems: 0,
        checkedItems: 0,
        totalWeight: 0,
        checkedWeight: 0,
        persen: 0,
        items: []
      };
    }

    const stage = stageMap[item.tahapID];

    const itemProgress = progress[item.itemID] || {};

    const checked = Boolean(itemProgress.checked);
    const catatan = String(itemProgress.catatan || '');

    stage.items.push({
      item: item,
      checked: checked,
      catatan: catatan
    });

    stage.totalItems += 1;

    if (checked) {
      stage.checkedItems += 1;
    }

    const weight = Number(item.weight || 0);

    if (weight > 0) {
      stage.totalWeight += weight;

      if (checked) {
        stage.checkedWeight += weight;
      }
    }
  });

  let totalItems = 0;
  let checkedItems = 0;
  let totalWeight = 0;
  let checkedWeight = 0;

  const stages = Object.keys(stageMap)
    .map(function (key) {
      return stageMap[key];
    })
    .sort(function (a, b) {
      return Number(a.tahapID) - Number(b.tahapID);
    });

  stages.forEach(function (stage) {
    stage.persen = stage.totalWeight > 0
      ? roundExport((stage.checkedWeight / stage.totalWeight) * 100, 2)
      : 0;

    totalItems += stage.totalItems;
    checkedItems += stage.checkedItems;
    totalWeight += stage.totalWeight;
    checkedWeight += stage.checkedWeight;
  });

  const totalPersen = totalWeight > 0
    ? roundExport((checkedWeight / totalWeight) * 100, 2)
    : 0;

  return {
    stages: stages,
    totalItems: totalItems,
    checkedItems: checkedItems,
    totalWeight: totalWeight,
    checkedWeight: checkedWeight,
    totalPersen: totalPersen
  };
}

function renderExportPreview() {
  const container = document.getElementById('export-preview');

  if (!container) {
    return;
  }

  if (!exportState.loaded) {
    container.innerHTML = '';
    return;
  }

  const data = buildExportData();

  container.innerHTML =
    '<div class="export-stat">' +
      '<strong>' + exportState.semester + ' ' + escapeHtmlExport(exportState.tahun) + '</strong>' +
      '<span>Periode</span>' +
    '</div>' +

    '<div class="export-stat">' +
      '<strong>' + data.totalPersen + '%</strong>' +
      '<span>Progres Total</span>' +
    '</div>' +

    '<div class="export-stat">' +
      '<strong>' + data.checkedItems + '/' + data.totalItems + '</strong>' +
      '<span>Item Tercentang</span>' +
    '</div>' +

    '<div class="export-stat">' +
      '<strong>' + data.checkedWeight + '/' + data.totalWeight + '</strong>' +
      '<span>Bobot Tercentang</span>' +
    '</div>';
}

function ensureExportReady() {
  if (!exportState.loaded) {
    showAuthMessage(
      'export-message',
      'Klik tombol Muat Data terlebih dahulu.',
      'error'
    );
    return false;
  }

  return true;
}

/**
 * ============================================================
 * EXPORT EXCEL
 * ============================================================
 */

function handleExportExcel() {
  hideAuthMessage('export-message');

  if (!ensureExportReady()) {
    return;
  }

  if (typeof XLSX === 'undefined') {
    showAuthMessage(
      'export-message',
      'Library Excel (SheetJS) belum termuat. Periksa koneksi internet dan CDN.',
      'error'
    );
    return;
  }

  const excelButton = document.getElementById('export-excel-button');

  setButtonLoading(excelButton, true, 'Menyiapkan...');

  try {
    const data = buildExportData();
    const user = exportState.user || {};

    const summaryRows = [
      ['DAPODIK CHECKPOINT - LAPORAN PROGRES UPDATE DAPODIK'],
      [],
      ['Nama Operator', user.namaOperator || '-'],
      ['Nama Sekolah', user.namaSekolah || '-'],
      ['NPSN', user.npsn || '-'],
      ['Username', user.username || '-'],
      ['Semester', exportState.semester],
      ['Tahun Pelajaran', exportState.tahun],
      ['Metode Laporan', exportState.metode],
      ['Tanggal Cetak', formatDateExport(new Date().toISOString())],
      ['Nama Kepala Sekolah', user.namaKepalaSekolah || '-'],
      [getNIPLabelExport(user.statusKepegawaianKepalaSekolah) + ' Kepala Sekolah', user.nipKepalaSekolah || '-'],
      [getNIPLabelExport(user.statusKepegawaianOperator) + ' Operator', user.nipOperator || '-'],
      [],
      ['Total Item', data.totalItems],
      ['Item Tercentang', data.checkedItems],
      ['Total Bobot', data.totalWeight],
      ['Bobot Tercentang', data.checkedWeight],
      ['Progres Total', data.totalPersen + '%'],
      [],
      ['RINGKASAN PER TAHAP'],
      [
        'No',
        'Tahap',
        'Kelompok Prioritas',
        'Total Item',
        'Tercentang',
        'Total Bobot',
        'Bobot Tercentang',
        'Persen'
      ]
    ];

    data.stages.forEach(function (stage) {
      summaryRows.push([
        stage.tahapID,
        stage.namaTahap,
        stage.kelompokPrioritas,
        stage.totalItems,
        stage.checkedItems,
        stage.totalWeight,
        stage.checkedWeight,
        stage.persen + '%'
      ]);
    });

    const detailRows = [
      [
        'No',
        'Tahap',
        'Sub Bagian',
        'No Item',
        'Uraian',
        'Hal yang Harus Dipastikan',
        'Status',
      ]
    ];

    let nomor = 1;

    data.stages.forEach(function (stage) {
      stage.items.forEach(function (entry) {
        detailRows.push([
          nomor,
          stage.namaTahap,
          entry.item.subBagian || '',
          entry.item.no === null || entry.item.no === undefined
            ? ''
            : entry.item.no,
          entry.item.uraian || '',
          entry.item.halYangHarusDipastikan || '',
          entry.checked ? 'Sudah' : 'Belum',
        ]);

        nomor += 1;
      });
    });

    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Checklist');

    const filename = buildReportFilename('xlsx');

    XLSX.writeFile(wb, filename);

    showAuthMessage(
      'export-message',
      'File Excel berhasil dibuat: ' + filename,
      'success'
    );

  } catch (error) {
    showAuthMessage(
      'export-message',
      'Gagal membuat Excel: ' + (error.message || String(error)),
      'error'
    );

  } finally {
    setButtonLoading(excelButton, false, 'Export Excel');
  }
}

/**
 * ============================================================
 * EXPORT PDF
 * ============================================================
 */

function handleExportPDF() {
  hideAuthMessage('export-message');

  if (!ensureExportReady()) {
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showAuthMessage(
      'export-message',
      'Library PDF (jsPDF) belum termuat. Periksa koneksi internet dan CDN.',
      'error'
    );
    return;
  }

  const pdfButton = document.getElementById('export-pdf-button');

  setButtonLoading(pdfButton, true, 'Menyiapkan...');

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

    const data = buildExportData();
    const user = exportState.user || {};

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    let y = margin;

    /**
     * Header laporan
     */
    if (exportLogoDataUrl) {
      try {
        doc.addImage(exportLogoDataUrl, 'PNG', margin, y, 18, 18);
      } catch (error) {
        // Jika logo gagal dimasukkan, lanjut tanpa logo
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(
      'LAPORAN PROGRES PEMUTAKHIRAN DAPODIK',
      pageWidth / 2,
      y + 6,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(
      'Semester ' + exportState.semester + ' - Tahun Pelajaran ' + exportState.tahun,
      pageWidth / 2,
      y + 12,
      { align: 'center' }
    );

    doc.setFontSize(8);
     doc.text(
      'Alat bantu pemantauan progres update Dapodik, bukan aplikasi resmi Dapodik Kemendikdasmen.',
      pageWidth / 2,
      y + 17,
      { align: 'center' }
    );
    
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
        ['Nama Operator', user.namaOperator || '-'],
        ['Nama Sekolah', user.namaSekolah || '-'],
        ['NPSN', user.npsn || '-'],
        ['Username', user.username || '-'],
        ['Nama Kepala Sekolah', user.namaKepalaSekolah || '-'],
        [getNIPLabelExport(user.statusKepegawaianKepalaSekolah) + ' Kepala Sekolah', user.nipKepalaSekolah || '-'],
        [getNIPLabelExport(user.statusKepegawaianOperator) + ' Operator', user.nipOperator || '-'],
        ['Semester', exportState.semester],
        ['Tahun Pelajaran', exportState.tahun],
        ['Metode Laporan', exportState.metode],
        ['Tanggal Cetak', formatDateExport(new Date().toISOString())]
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
        ['Total Item', 'Tercentang', 'Total Bobot', 'Bobot Tercentang', 'Progres Total']
      ],
      body: [
        [
          data.totalItems,
          data.checkedItems,
          data.totalWeight,
          data.checkedWeight,
          data.totalPersen + '%'
        ]
      ]
    });

    y = doc.lastAutoTable.finalY + 6;

    /**
     * Ringkasan per tahap
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
        ['No', 'Tahap', 'Total Item', 'Tercentang', 'Bobot', 'Bobot Tercentang', 'Persen']
      ],
      body: data.stages.map(function (stage) {
        return [
          stage.tahapID,
          stage.namaTahap,
          stage.totalItems,
          stage.checkedItems,
          stage.totalWeight,
          stage.checkedWeight,
          stage.persen + '%'
        ];
      })
    });

    y = doc.lastAutoTable.finalY + 8;

    /**
     * Detail per tahap
     */
    data.stages.forEach(function (stage) {
      if (y > pageHeight - 45) {
        doc.addPage();
        y = margin;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(
        stage.tahapID + '. ' + stage.namaTahap + ' - ' + stage.persen + '%',
        margin,
        y
      );

      doc.autoTable({
        startY: y + 3,
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
          },
          3: {
            cellWidth: 16
          }
        },
        head: [
          ['No', 'Uraian', 'Hal yang Harus Dipastikan', 'Status']
        ],
        body: stage.items.map(function (entry, index) {
          return [
            index + 1,
            entry.item.uraian || '',
            entry.item.halYangHarusDipastikan || '',
            entry.checked ? 'Sudah' : 'Belum',
          ];
        })
      });

      y = doc.lastAutoTable.finalY + 6;
    });

    /**
     * Tanda tangan
     */
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    doc.text(
      'Dicetak pada: ' + formatDateExport(new Date().toISOString()),
      margin,
      y + 8
    );

    const sigY = y + 18;

    const operatorLabel = getNIPLabelExport(user.statusKepegawaianOperator);
    const kepsekLabel = getNIPLabelExport(user.statusKepegawaianKepalaSekolah);

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
        sigY + 26
      );
    }

    if (user.nipKepalaSekolah) {
      doc.text(
        kepsekLabel + ' ' + user.nipKepalaSekolah,
        pageWidth - margin - 55,
        sigY + 26
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

    const filename = buildReportFilename('pdf');

    doc.save(filename);

    showAuthMessage(
      'export-message',
      'File PDF berhasil dibuat: ' + filename,
      'success'
    );

  } catch (error) {
    showAuthMessage(
      'export-message',
      'Gagal membuat PDF: ' + (error.message || String(error)),
      'error'
    );

  } finally {
    setButtonLoading(pdfButton, false, 'Export PDF');
  }
}

/**
 * ============================================================
 * LOGO PRELOAD
 * ============================================================
 */

function preloadExportLogo() {
  try {
    const img = new Image();

    img.onload = function () {
      try {
        const canvas = document.createElement('canvas');

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);

        exportLogoDataUrl = canvas.toDataURL('image/png');

      } catch (error) {
        exportLogoDataUrl = null;
      }
    };

    img.onerror = function () {
      exportLogoDataUrl = null;
    };

    img.src = 'assets/logo-dapodik.png';

  } catch (error) {
    exportLogoDataUrl = null;
  }
}

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function buildExportFilename(extension) {
  const base =
    'Dapodik_Checkpoint_' +
    exportState.semester + '_' +
    String(exportState.tahun || '').replace(/[^0-9]/g, '-');

  return base + '.' + extension;
}

/**
 * ============================================================
 * PATCH 4I-1 - FORMAT NAMA FILE LAPORAN
 * Format: Nama Sekolah-Dapo_Checkpoint-20261-dd-mm-yyyy.pdf
 * ============================================================
 */

/**
 * Kode periode:
 * tahun awal tahun pelajaran + kode semester (1 = Ganjil, 2 = Genap)
 *
 * Contoh:
 * 2026/2027 Ganjil -> 20261
 * 2026/2027 Genap  -> 20262
 */
function buildPeriodCode() {
  const tahun = String(exportState.tahun || '');
  const match = tahun.match(/^(\d{4})\/(\d{4})$/);

  const tahunAwal = match
    ? match[1]
    : String(new Date().getFullYear());

  const kodeSemester = exportState.semester === 'Genap' ? '2' : '1';

  return tahunAwal + kodeSemester;
}

/**
 * Tanggal unduh dengan format dd-mm-yyyy
 */
function formatDownloadDate() {
  const now = new Date();

  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();

  return dd + '-' + mm + '-' + yyyy;
}

/**
 * Bersihkan nama sekolah agar aman sebagai nama file
 */
function sanitizeFilenamePart(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nama file laporan:
 * Nama Sekolah-Dapo_Checkpoint-20261-dd-mm-yyyy.pdf
 */
function buildReportFilename(extension) {
  const school =
    sanitizeFilenamePart(
      exportState.user ? exportState.user.namaSekolah : ''
    ) || 'Sekolah';

  return (
    school +
    '-Dapo_Checkpoint-' +
    buildPeriodCode() +
    '-' +
    formatDownloadDate() +
    '.' +
    extension
  );
}

function isValidSemesterExport(value) {
  return value === 'Ganjil' || value === 'Genap';
}

function normalizeTahunExport(value) {
  let v = String(value || '').trim();

  v = v.replace(/\s+/g, '');
  v = v.replace(/\\/g, '/');
  v = v.replace(/-/g, '/');

  return v;
}

function isValidTahunExport(value) {
  const v = normalizeTahunExport(value);

  const match = v.match(/^(\d{4})\/(\d{4})$/);

  if (!match) {
    return false;
  }

  const tahunAwal = Number(match[1]);
  const tahunAkhir = Number(match[2]);

  return tahunAkhir === tahunAwal + 1;
}

function roundExport(value, decimals) {
  const factor = Math.pow(10, decimals);

  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatDateExport(isoString) {
  if (!isoString) {
    return '-';
  }

  try {
    const date = new Date(isoString);

    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });

  } catch (error) {
    return isoString;
  }
}

function escapeHtmlExport(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * ============================================================
 * PATCH 4K-2 - NIP/NIY EXPORT
 * ============================================================
 */

function getNIPLabelExport(status) {
  if (status === 'PNS') {
    return 'NIP';
  }

  if (status === 'Non-PNS') {
    return 'NIY';
  }

  return 'NIP/NIY';
}

