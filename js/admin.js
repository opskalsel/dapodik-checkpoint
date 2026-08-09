/**
 * ============================================================
 * DAPODIK CHECKPOINT - ADMIN PAGE (REVAMPED)
 * ============================================================
 */

const adminState = {
  users: [],
  filteredUsers: [],
  stats: {},
  rekap: []
};

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('admin-page')) {
    initAdmin();
  }
});

/**
 * ============================================================
 * INIT
 * ============================================================
 */

async function initAdmin() {
  bindAdminControls();
  bindCreateUserForm();
  bindExportButtons();

  const user = getSessionUser();
  const token = getSessionToken();

  if (!user || !token) {
    window.location.href = 'login.html?role=admin';
    return;
  }

  const valid = await validateAdminSession();

  if (!valid) {
    return;
  }

  await loadAdminData();
}

function bindAdminControls() {
  const reloadButton = document.getElementById('reload-admin-button');

  if (reloadButton) {
    reloadButton.addEventListener('click', function () {
      loadAdminData();
    });
  }

  const searchInput = document.getElementById('admin-search');

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      applyAdminFilter();
    });
  }

  const tableWrap = document.querySelector('.table-wrap');

  if (tableWrap) {
    tableWrap.addEventListener('click', function (event) {
      const resetPasswordBtn = event.target.closest('button[data-action="reset-password"]');
      const resetChecklistBtn = event.target.closest('button[data-action="reset-checklist"]');
      const resetDatabaseBtn = event.target.closest('button[data-action="reset-database"]');

      if (resetPasswordBtn) {
        handleResetPassword(resetPasswordBtn);
      }

      if (resetChecklistBtn) {
        handleResetChecklist(resetChecklistBtn);
      }

      if (resetDatabaseBtn) {
        handleResetDatabase(resetDatabaseBtn);
      }
    });
  }

  const logoutButton = document.getElementById('logout-button');

  if (logoutButton) {
    logoutButton.addEventListener('click', function () {
      clearSession();
      window.location.href = 'index.html';
    });
  }

  /**
   * Toggle form tambah user
   */
  const toggleCreateUser = document.getElementById('toggle-create-user');
  const createUserContainer = document.getElementById('create-user-container');

  if (toggleCreateUser && createUserContainer) {
    toggleCreateUser.addEventListener('click', function () {
      const isVisible = createUserContainer.style.display !== 'none';
      createUserContainer.style.display = isVisible ? 'none' : 'block';
      toggleCreateUser.textContent = isVisible ? '▼' : '▲';
    });
  }
}

async function validateAdminSession() {
  try {
    const result = await apiRequest('validateToken', {}, true);

    if (!result.success) {
      clearSession();
      window.location.href = 'login.html?role=admin';
      return false;
    }

    if (result.data && result.data.user) {
      saveSession(getSessionToken(), result.data.user);

      if (result.data.user.role !== 'admin') {
        window.location.href = 'dashboard.html';
        return false;
      }
    }

    return true;

  } catch (error) {
    showAuthMessage(
      'admin-message',
      error.message || String(error),
      'error'
    );

    return false;
  }
}

/**
 * ============================================================
 * LOAD DATA
 * ============================================================
 */

async function loadAdminData() {
  hideAuthMessage('admin-message');

  const reloadButton = document.getElementById('reload-admin-button');

  setButtonLoading(reloadButton, true, 'Memuat...');

  try {
    const result = await apiRequest('getAdminRekap', {}, true);

    if (!result.success) {
      if (result.code === 401) {
        clearSession();
        window.location.href = 'login.html?role=admin';
        return;
      }

      if (result.code === 403) {
        window.location.href = 'dashboard.html';
        return;
      }

      throw new Error(result.message || 'Gagal memuat data admin.');
    }

    adminState.stats = result.data.stats || {};
    adminState.rekap = result.data.rekap || [];
    adminState.users = result.data.rekap || [];

    renderAdminStats(adminState.stats);
    applyAdminFilter();

  } catch (error) {
    showAuthMessage(
      'admin-message',
      error.message || String(error),
      'error'
    );

  } finally {
    setButtonLoading(reloadButton, false, 'Muat Ulang');
  }
}

/**
 * ============================================================
 * RENDER STATS
 * ============================================================
 */

function renderAdminStats(stats) {
  const container = document.getElementById('admin-stats');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  const items = [
    {
      label: 'Total Pengguna',
      value: stats.totalUsers || 0
    },
    {
      label: 'Total Operator',
      value: stats.totalOperators || 0
    },
    {
      label: 'Sekolah Unik',
      value: stats.totalSchools || 0
    },
    {
      label: 'Snapshot History',
      value: stats.totalSnapshots || 0
    },
    {
      label: 'Sudah Mulai',
      value: stats.totalSudahMulai || 0
    },
    {
      label: 'Belum Mulai',
      value: stats.totalBelumMulai || 0
    }
  ];

  items.forEach(function (item) {
    const card = document.createElement('div');
    card.className = 'card stat-card';

    const value = document.createElement('div');
    value.className = 'stat-value';
    value.textContent = item.value;

    const label = document.createElement('div');
    label.className = 'stat-label';
    label.textContent = item.label;

    card.appendChild(value);
    card.appendChild(label);

    container.appendChild(card);
  });
}

/**
 * ============================================================
 * FILTER & TABLE
 * ============================================================
 */

function applyAdminFilter() {
  const searchInput = document.getElementById('admin-search');

  const query = searchInput
    ? searchInput.value.trim().toLowerCase()
    : '';

  if (!query) {
    adminState.filteredUsers = adminState.users.slice();
    renderAdminUserTable(adminState.filteredUsers);
    return;
  }

  adminState.filteredUsers = adminState.users.filter(function (user) {
    const targets = [
      user.namaOperator,
      user.namaSekolah,
      user.npsn,
      user.username,
      user.email
    ];

    return targets.some(function (value) {
      return String(value || '').toLowerCase().indexOf(query) !== -1;
    });
  });

  renderAdminUserTable(adminState.filteredUsers);
}

function renderAdminUserTable(users) {
  const tbody = document.getElementById('admin-user-tbody');

  if (!tbody) {
    return;
  }

  tbody.innerHTML = '';

  if (!users.length) {
    const tr = document.createElement('tr');

    const td = document.createElement('td');
    td.colSpan = 12;
    td.textContent = 'Tidak ada pengguna yang cocok.';

    tr.appendChild(td);
    tbody.appendChild(tr);

    return;
  }

  users.forEach(function (user, index) {
    const tr = document.createElement('tr');

    const roleBadge = user.role === 'admin'
      ? '<span class="badge badge-red">Admin</span>'
      : '<span class="badge badge-blue">Operator</span>';

    const statusBadge = user.statusAktif
      ? '<span class="badge badge-green">Aktif</span>'
      : '<span class="badge badge-grey">Nonaktif</span>';

    const progressText = user.persenTotal > 0
      ? formatPercentRiwayat(user.persenTotal) + ' (' + user.statusRingkasan + ')'
      : '<span class="muted">Belum mulai</span>';

    const loginText = user.terakhirLogin
      ? formatLoginLast(user.terakhirLogin)
      : '<span class="muted">Belum pernah</span>';

    const actionButtons =
      '<button class="btn btn-outline btn-small" ' +
        'data-action="reset-password" ' +
        'data-user-id="' + escapeHtmlRiwayat(user.userId) + '" ' +
        'data-username="' + escapeHtmlRiwayat(user.username) + '">' +
        '🔑 Reset Password' +
      '</button> ' +
      '<button class="btn btn-outline btn-small" ' +
        'data-action="reset-checklist" ' +
        'data-user-id="' + escapeHtmlRiwayat(user.userId) + '" ' +
        'data-username="' + escapeHtmlRiwayat(user.username) + '">' +
        '🗑️ Reset Checklist' +
      '</button> ' +
      '<button class="btn btn-outline btn-small" ' +
        'data-action="reset-database" ' +
        'data-user-id="' + escapeHtmlRiwayat(user.userId) + '" ' +
        'data-username="' + escapeHtmlRiwayat(user.username) + '">' +
        '💣 Reset Database' +
      '</button>';

    tr.innerHTML =
      '<td>' + (index + 1) + '</td>' +
      '<td>' + escapeHtmlRiwayat(user.namaOperator || '-') + '</td>' +
      '<td>' + escapeHtmlRiwayat(user.namaSekolah || '-') + '</td>' +
      '<td>' + escapeHtmlRiwayat(user.npsn || '-') + '</td>' +
      '<td>' + escapeHtmlRiwayat(user.username || '-') + '</td>' +
      '<td>' + roleBadge + '</td>' +
      '<td>' + escapeHtmlRiwayat(user.semester || '-') + '</td>' +
      '<td>' + escapeHtmlRiwayat(user.tahunPelajaran || '-') + '</td>' +
      '<td>' + progressText + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td>' + loginText + '</td>' +
      '<td>' + actionButtons + '</td>';

    tbody.appendChild(tr);
  });
}

/**
 * ============================================================
 * CREATE USER
 * ============================================================
 */

function bindCreateUserForm() {
  const form = document.getElementById('create-user-form');

  if (!form) {
    return;
  }

  const npsnInput = document.getElementById('create-npsn');
  const noHpInput = document.getElementById('create-no-hp');
  const usernameInput = document.getElementById('create-username');

  /**
   * NPSN: hanya angka, maksimal 8 digit.
   */
  if (npsnInput) {
    npsnInput.addEventListener('input', function (event) {
      const value = event.target.value;
      const digitsOnly = value.replace(/\D/g, '').slice(0, 8);

      if (event.target.value !== digitsOnly) {
        event.target.value = digitsOnly;
      }
    });
  }

  /**
   * No HP: hanya angka dan +.
   */
  if (noHpInput) {
    noHpInput.addEventListener('input', function (event) {
      const value = event.target.value;
      const cleaned = value.replace(/[^0-9+]/g, '');

      if (event.target.value !== cleaned) {
        event.target.value = cleaned;
      }
    });
  }

  /**
   * Username: otomatis lowercase, spasi jadi minus.
   */
  if (usernameInput) {
    usernameInput.addEventListener('input', function (event) {
      const value = event.target.value;

      const cleaned = value
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-_.]/g, '');

      if (event.target.value !== cleaned) {
        event.target.value = cleaned;
      }
    });
  }

  form.addEventListener('submit', handleCreateUser);
}

async function handleCreateUser(event) {
  event.preventDefault();

  hideAuthMessage('create-user-message');

  const submitButton = document.getElementById('create-user-submit');

  const payload = {
    namaOperator: getValueById('create-nama-operator'),
    namaSekolah: getValueById('create-nama-sekolah'),
    npsn: getValueById('create-npsn'),
    noHp: getValueById('create-no-hp'),
    email: getValueById('create-email'),
    username: getValueById('create-username'),
    password: getValueById('create-password'),
    role: getValueById('create-role')
  };

  const errors = [];

  if (!payload.namaOperator) errors.push('Nama operator wajib diisi.');
  if (!payload.namaSekolah) errors.push('Nama sekolah wajib diisi.');
  if (!/^\d{8}$/.test(payload.npsn)) errors.push('NPSN harus 8 digit angka.');
  if (!payload.noHp) errors.push('No. HP/WA wajib diisi.');
  if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    errors.push('Format email tidak valid.');
  }
  if (!payload.username || !/^[a-z0-9_.\-]{4,30}$/.test(payload.username)) {
    errors.push('Username tidak valid.');
  }
  if (payload.password.length < 8) errors.push('Password minimal 8 karakter.');

  if (errors.length > 0) {
    showAuthMessage('create-user-message', errors.join(' '), 'error');
    return;
  }

  setButtonLoading(submitButton, true, 'Membuat...');

  try {
    const result = await apiRequest('createUserByAdmin', payload, true);

    if (!result.success) {
      if (result.code === 401) {
        clearSession();
        window.location.href = 'login.html?role=admin';
        return;
      }

      if (result.code === 403) {
        window.location.href = 'dashboard.html';
        return;
      }

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.join(' '));
      }

      throw new Error(result.message || 'Gagal membuat user baru.');
    }

    showAuthMessage(
      'create-user-message',
      result.message || 'User baru berhasil dibuat.',
      'success'
    );

    document.getElementById('create-user-form').reset();

    await loadAdminData();

  } catch (error) {
    showAuthMessage(
      'create-user-message',
      error.message || String(error),
      'error'
    );

  } finally {
    setButtonLoading(submitButton, false, 'Buat User Baru');
  }
}

/**
 * ============================================================
 * RESET PASSWORD
 * ============================================================
 */

async function handleResetPassword(button) {
  const userId = button.dataset.userId;
  const username = button.dataset.username;

  const confirmed = await konfirmasi(
    'Reset password untuk pengguna "' + username + '"?\n\n' +
    'Sistem akan membuat password sementara dan pengguna wajib ' +
    'menggantinya saat login berikutnya.'
  );

  if (!confirmed) {
    return;
  }

  setButtonLoading(button, true, 'Reset...');

  try {
    const result = await apiRequest(
      'resetPassword',
      {
        targetUserId: userId
      },
      true
    );

    console.log('Reset Password Response:', result);

    if (!result) {
      throw new Error('Response dari server kosong.');
    }

    if (!result.success) {
      if (result.code === 401) {
        clearSession();
        window.location.href = 'login.html?role=admin';
        return;
      }

      if (result.code === 403) {
        window.location.href = 'dashboard.html';
        return;
      }

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.join(' '));
      }

      throw new Error(result.message || 'Gagal mereset password.');
    }

    /**
     * Baca data dengan defensive check
     */
    const data = result.data || {};

    const tempPassword = data.temporaryPassword
      ? data.temporaryPassword
      : '(password tidak tersedia - periksa response)';

    const targetUsername = data.username
      ? data.username
      : username;

    /**
     * Tampilkan pesan dengan format yang jelas
     */
    const message =
      'PASSWORD SEMENTARA BERHASIL DIBUAT\n\n' +
      'Username: ' + targetUsername + '\n' +
      'Password: ' + tempPassword + '\n\n' +
      'Sampaikan password ini secara aman ke pengguna.\n' +
      'Pengguna wajib mengganti password saat login berikutnya.';

    await loadAdminData();

    showAuthMessage('admin-message', message, 'success');

  } catch (error) {
    console.error('Reset Password Error:', error);

    showAuthMessage(
      'admin-message',
      'Gagal mereset password: ' + (error.message || String(error)),
      'error'
    );

  } finally {
    setButtonLoading(button, false, '🔑 Reset Password');
  }
}

/**
 * ============================================================
 * RESET CHECKLIST
 * ============================================================
 */

async function handleResetChecklist(button) {
  const userId = button.dataset.userId;
  const username = button.dataset.username;

  const confirmed = await konfirmasi(
    'Reset CHECKLIST untuk pengguna "' + username + '"?\n\n' +
    'Tindakan ini akan menghapus SEMUA progres checklist dan ' +
    'history pengguna tersebut.\n\n' +
    'Tindakan ini TIDAK BISA dibatalkan.'
  );

  if (!confirmed) {
    return;
  }

  const doubleConfirm = await konfirmasi(
    'Apakah Anda benar-benar yakin?\n\n' +
    'Semua data checklist "' + username + '" akan dihapus permanen.'
  );

  if (!doubleConfirm) {
    return;
  }

  setButtonLoading(button, true, 'Reset...');

  try {
    const result = await apiRequest(
      'resetUserChecklist',
      {
        targetUserId: userId
      },
      true
    );

    if (!result.success) {
      if (result.code === 401) {
        clearSession();
        window.location.href = 'login.html?role=admin';
        return;
      }

      if (result.code === 403) {
        window.location.href = 'dashboard.html';
        return;
      }

      throw new Error(result.message || 'Gagal mereset checklist.');
    }

    const deletedProgress = result.data && result.data.deletedProgress !== undefined
      ? result.data.deletedProgress
      : 0;

    const deletedHistory = result.data && result.data.deletedHistory !== undefined
      ? result.data.deletedHistory
      : 0;

    await loadAdminData();

    showAuthMessage(
      'admin-message',
      'Checklist "' + username + '" berhasil direset. ' +
      '(' + result.data.deletedProgress + ' progress, ' +
      result.data.deletedHistory + ' history dihapus)',
      'success'
    );

  } catch (error) {
    showAuthMessage(
      'admin-message',
      error.message || String(error),
      'error'
    );

  } finally {
    setButtonLoading(button, false, '🗑️ Reset Checklist');
  }
}

/**
 * ============================================================
 * RESET DATABASE
 * ============================================================
 */

async function handleResetDatabase(button) {
  const userId = button.dataset.userId;
  const username = button.dataset.username;

  const confirmed = await konfirmasi(
    'Reset DATABASE untuk pengguna "' + username + '"?\n\n' +
    'Tindakan ini akan menghapus:\n' +
    '- Semua progres checklist\n' +
    '- Semua history\n' +
    '- Data Kepala Sekolah & Operator\n\n' +
    'Tindakan ini TIDAK BISA dibatalkan.'
  );

  if (!confirmed) {
    return;
  }

  const doubleConfirm = await konfirmasi(
    'PERINGATAN AKHIR!\n\n' +
    'Semua data "' + username + '" akan dihapus permanen.\n\n' +
    'Apakah Anda benar-benar yakin?'
  );

  if (!doubleConfirm) {
    return;
  }

  setButtonLoading(button, true, 'Reset...');

  try {
    const result = await apiRequest(
      'resetUserDatabase',
      {
        targetUserId: userId
      },
      true
    );

    if (!result.success) {
      if (result.code === 401) {
        clearSession();
        window.location.href = 'login.html?role=admin';
        return;
      }

      if (result.code === 403) {
        window.location.href = 'dashboard.html';
        return;
      }

      throw new Error(result.message || 'Gagal mereset database.');
    }

    const deletedProgress = result.data && result.data.deletedProgress !== undefined
      ? result.data.deletedProgress
      : 0;

    const deletedHistory = result.data && result.data.deletedHistory !== undefined
      ? result.data.deletedHistory
      : 0;

    await loadAdminData();

    showAuthMessage(
      'admin-message',
      'Database "' + username + '" berhasil direset.\n\n' +
      'Data yang dihapus:\n' +
      '- ' + deletedProgress + ' baris progress\n' +
      '- ' + deletedHistory + ' baris history\n' +
      '- Data Kepala Sekolah & Operator',
      'success'
    );

  } catch (error) {
    showAuthMessage(
      'admin-message',
      error.message || String(error),
      'error'
    );

  } finally {
    setButtonLoading(button, false, '💣 Reset Database');
  }
}

/**
 * ============================================================
 * EXPORT REKAP
 * ============================================================
 */

function bindExportButtons() {
  const excelButton = document.getElementById('export-rekap-excel');
  const pdfButton = document.getElementById('export-rekap-pdf');

  if (excelButton) {
    excelButton.addEventListener('click', function () {
      handleExportRekapExcel();
    });
  }

  if (pdfButton) {
    pdfButton.addEventListener('click', function () {
      handleExportRekapPDF();
    });
  }
}

function handleExportRekapExcel() {
  hideAuthMessage('admin-message');

  if (!adminState.rekap.length) {
    showAuthMessage(
      'admin-message',
      'Tidak ada data untuk diekspor.',
      'error'
    );
    return;
  }

  if (typeof XLSX === 'undefined') {
    showAuthMessage(
      'admin-message',
      'Library Excel (SheetJS) belum termuat. Periksa koneksi internet.',
      'error'
    );
    return;
  }

  const user = getSessionUser() || {};

  const rows = [
    ['DAPODIK CHECKPOINT - REKAP OPERATOR & SEKOLAH'],
    [],
    ['Diekspor oleh', user.namaOperator || '-'],
    ['Tanggal Ekspor', formatDateID(new Date().toISOString())],
    [],
    ['RINGKASAN'],
    ['Total Operator', adminState.stats.totalOperators || 0],
    ['Sekolah Unik', adminState.stats.totalSchools || 0],
    ['Sudah Mulai', adminState.stats.totalSudahMulai || 0],
    ['Belum Mulai', adminState.stats.totalBelumMulai || 0],
    [],
    ['REKAP DETAIL'],
    [
      'No',
      'Nama Operator',
      'Nama Sekolah',
      'NPSN',
      'Email',
      'No HP',
      'Semester',
      'Tahun Pelajaran',
      'Progres (%)',
      'Status',
      'Terakhir Login',
      'Status Akun'
    ]
  ];

  adminState.rekap.forEach(function (item, index) {
    rows.push([
      index + 1,
      item.namaOperator || '-',
      item.namaSekolah || '-',
      item.npsn || '-',
      item.email || '-',
      item.noHp || '-',
      item.semester || '-',
      item.tahunPelajaran || '-',
      item.persenTotal || 0,
      item.statusRingkasan || '-',
      item.terakhirLogin || '-',
      item.statusAktif ? 'Aktif' : 'Nonaktif'
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  XLSX.utils.book_append_sheet(wb, ws, 'Rekap');

  const filename =
    'Dapodik_Checkpoint_Rekap_' +
    formatCompareDownloadDate() +
    '.xlsx';

  XLSX.writeFile(wb, filename);

  showAuthMessage(
    'admin-message',
    'File Excel rekap berhasil dibuat: ' + filename,
    'success'
  );
}

function handleExportRekapPDF() {
  hideAuthMessage('admin-message');

  if (!adminState.rekap.length) {
    showAuthMessage(
      'admin-message',
      'Tidak ada data untuk diekspor.',
      'error'
    );
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showAuthMessage(
      'admin-message',
      'Library PDF (jsPDF) belum termuat. Periksa koneksi internet.',
      'error'
    );
    return;
  }

  const jsPDFClass = window.jspdf.jsPDF;

  const doc = new jsPDFClass({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  if (typeof doc.autoTable !== 'function') {
    showAuthMessage(
      'admin-message',
      'Plugin jspdf-autotable belum termuat.',
      'error'
    );
    return;
  }

  const user = getSessionUser() || {};
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  let y = margin;

  /**
   * Header
   */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);

  doc.text(
    'DAPODIK CHECKPOINT - REKAP OPERATOR & SEKOLAH',
    pageWidth / 2,
    y + 6,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  doc.text(
    'Diekspor oleh: ' + (user.namaOperator || '-') +
    ' | Tanggal: ' + formatDateID(new Date().toISOString()),
    pageWidth / 2,
    y + 12,
    { align: 'center' }
  );

  y += 18;

  /**
   * Ringkasan
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
      ['Total Operator', 'Sekolah Unik', 'Sudah Mulai', 'Belum Mulai']
    ],
    body: [
      [
        adminState.stats.totalOperators || 0,
        adminState.stats.totalSchools || 0,
        adminState.stats.totalSudahMulai || 0,
        adminState.stats.totalBelumMulai || 0
      ]
    ]
  });

  y = doc.lastAutoTable.finalY + 6;

  /**
   * Tabel detail
   */
  doc.autoTable({
    startY: y,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5
    },
    headStyles: {
      fillColor: [31, 111, 178]
    },
    columnStyles: {
      0: { cellWidth: 8 },
      8: { cellWidth: 15 },
      9: { cellWidth: 20 }
    },
    head: [
      [
        'No',
        'Nama Operator',
        'Nama Sekolah',
        'NPSN',
        'Email',
        'No HP',
        'Semester',
        'Tahun',
        'Progres',
        'Status',
        'Login Terakhir',
        'Akun'
      ]
    ],
    body: adminState.rekap.map(function (item, index) {
      return [
        index + 1,
        item.namaOperator || '-',
        item.namaSekolah || '-',
        item.npsn || '-',
        item.email || '-',
        item.noHp || '-',
        item.semester || '-',
        item.tahunPelajaran || '-',
        (item.persenTotal || 0) + '%',
        item.statusRingkasan || '-',
        item.terakhirLogin || '-',
        item.statusAktif ? 'Aktif' : 'Nonaktif'
      ];
    })
  });

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

  const filename =
    'Dapodik_Checkpoint_Rekap_' +
    formatCompareDownloadDate() +
    '.pdf';

  doc.save(filename);

  showAuthMessage(
    'admin-message',
    'File PDF rekap berhasil dibuat: ' + filename,
    'success'
  );
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

function formatLoginLast(isoString) {
  return formatDateID(isoString);
}

function formatCompareDownloadDate() {
  const now = new Date();

  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();

  return dd + '-' + mm + '-' + yyyy;
}

function escapeHtmlRiwayat(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getValueById(id) {
  const el = document.getElementById(id);

  if (!el) {
    return '';
  }

  return el.value;
}