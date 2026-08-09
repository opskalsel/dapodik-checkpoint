/**
 * ============================================================
 * DAPODIK CHECKPOINT - PROFIL PAGE (REVAMPED)
 * ============================================================
 * - Dropdown menu untuk ubah profil
 * - 3 section: Data Operator, Password, Kepala Sekolah
 * ============================================================
 */

/**
 * ============================================================
 * HELPER FUNCTIONS
 * ============================================================
 */

/**
 * Set nilai field form berdasarkan ID elemen.
 */
function setProfileFieldValue(id, value) {
  const el = document.getElementById(id);

  if (el) {
    el.value = value;
  }
}

/**
 * Ambil nilai field form berdasarkan ID elemen.
 */
function getProfileFieldValue(id) {
  const el = document.getElementById(id);

  if (!el) {
    return '';
  }

  return el.value;
}

/**
 * Set text content elemen berdasarkan ID.
 */
function setTextById(id, text) {
  const el = document.getElementById(id);

  if (el) {
    el.textContent = text;
  }
}

/**
 * Get label NIP/NIY berdasarkan status kepegawaian.
 */
function getNIPLabelText(status) {
  if (status === 'PNS') {
    return 'NIP';
  }

  if (status === 'Non-PNS') {
    return 'NIY';
  }

  return 'NIP/NIY';
}

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('profil-page')) {
    initProfil();
  }
});

async function initProfil() {
  bindProfilControls();
  bindDropdownControls();
  bindSectionControls();

  const user = getSessionUser();
  const token = getSessionToken();

  if (!user || !token) {
    window.location.href = 'login.html?role=operator';
    return;
  }

  renderProfile(user);

  const sessionValid = await validateProfilSession();

  if (!sessionValid) {
    return;
  }

  initUserDataForm();
  initPasswordForm();
  initKepsekDataForm();
}

function bindProfilControls() {
  const logoutButton = document.getElementById('logout-button');

  if (logoutButton) {
    logoutButton.addEventListener('click', function () {
      clearSession();
      window.location.href = 'index.html';
    });
  }
}

async function validateProfilSession() {
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
      'profil-message',
      error.message || String(error),
      'error'
    );

    return false;
  }
}

function renderProfile(user) {
  setTextById('profil-nama', user.namaOperator || '-');
  setTextById('profil-sekolah', user.namaSekolah || '-');
  setTextById('profil-npsn', user.npsn || '-');
  setTextById('profil-username', user.username || '-');
  setTextById('profil-email', user.email || '-');
  setTextById('profil-no-hp', user.noHp || '-');

  const statusOperator = user.statusKepegawaianOperator || '';
  const statusKepsek = user.statusKepegawaianKepalaSekolah || '';

  setTextById('profil-status-kepegawaian-operator', statusOperator || '-');
  setTextById('profil-nip-operator', user.nipOperator || '-');

  const nipOperatorLabel = document.getElementById('profil-nip-operator-label');
  if (nipOperatorLabel) {
    nipOperatorLabel.textContent = getNIPLabelText(statusOperator) + ' Operator';
  }

  setTextById('profil-kepsek-nama', user.namaKepalaSekolah || '-');
  setTextById('profil-kepsek-status', statusKepsek || '-');
  setTextById('profil-nip-kepsek', user.nipKepalaSekolah || '-');

  const nipKepsekLabel = document.getElementById('profil-nip-kepsek-label');
  if (nipKepsekLabel) {
    nipKepsekLabel.textContent = getNIPLabelText(statusKepsek) + ' Kepala Sekolah';
  }

  const roleBadge = document.getElementById('profil-role-badge');

  if (roleBadge) {
    if (String(user.role || '').toLowerCase() === 'admin') {
      roleBadge.textContent = 'Admin';
      roleBadge.className = 'badge badge-red';
    } else {
      roleBadge.textContent = 'Operator';
      roleBadge.className = 'badge badge-blue';
    }
  }
}

/**
 * ============================================================
 * DROPDOWN CONTROLS
 * ============================================================
 */

function bindDropdownControls() {
  const toggle = document.getElementById('profil-dropdown-toggle');
  const menu = document.getElementById('profil-dropdown-menu');

  if (!toggle || !menu) {
    return;
  }

  toggle.addEventListener('click', function (event) {
    event.stopPropagation();
    const isVisible = menu.style.display !== 'none';
    menu.style.display = isVisible ? 'none' : 'grid';
  });

  document.addEventListener('click', function (event) {
    if (!menu.contains(event.target) && event.target !== toggle) {
      menu.style.display = 'none';
    }
  });

  /**
   * Jika user adalah admin, sembunyikan menu Data Kepala Sekolah
   */
  const currentUser = getSessionUser() || {};

  if (String(currentUser.role || '').toLowerCase() === 'admin') {
    const kepsekMenuItem = menu.querySelector('.dropdown-item[data-section="kepsek-data"]');

    if (kepsekMenuItem) {
      kepsekMenuItem.style.display = 'none';
    }
  }

  const items = menu.querySelectorAll('.dropdown-item');

  items.forEach(function (item) {
    item.addEventListener('click', function () {
      const section = item.dataset.section;
      showSection(section);
      menu.style.display = 'none';
    });
  });
}

function showSection(sectionName) {
  const sections = ['user-data', 'password', 'kepsek-data'];

  sections.forEach(function (name) {
    const section = document.getElementById('section-' + name);

    if (section) {
      section.style.display = name === sectionName ? 'block' : 'none';
    }
  });

  if (sectionName) {
    const section = document.getElementById('section-' + sectionName);

    if (section) {
      setTimeout(function () {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }
}

function bindSectionControls() {
  const closeButtons = document.querySelectorAll('.btn-close-section');

  closeButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      const section = button.dataset.section;
      const sectionEl = document.getElementById('section-' + section);

      if (sectionEl) {
        sectionEl.style.display = 'none';
      }
    });
  });
}

/**
 * ============================================================
 * SECTION 1: USER DATA FORM
 * ============================================================
 */

function initUserDataForm() {
  const form = document.getElementById('profile-user-data-form');

  if (!form) {
    return;
  }

  const npsnInput = document.getElementById('profile-npsn');
  const noHpInput = document.getElementById('profile-no-hp');
  const statusSelect = document.getElementById('profile-status-kepegawaian-operator');

  if (npsnInput) {
    npsnInput.addEventListener('input', function (event) {
      const value = event.target.value;
      const digitsOnly = value.replace(/\D/g, '').slice(0, 8);

      if (event.target.value !== digitsOnly) {
        event.target.value = digitsOnly;
      }
    });

    npsnInput.addEventListener('keydown', function (event) {
      const allowed = [
        'Backspace',
        'Delete',
        'ArrowLeft',
        'ArrowRight',
        'Tab',
        'Home',
        'End'
      ];

      if (allowed.indexOf(event.key) !== -1) {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        return;
      }

      if (!/^[0-9]$/.test(event.key)) {
        event.preventDefault();
      }
    });
  }

  if (noHpInput) {
    noHpInput.addEventListener('input', function (event) {
      const value = event.target.value;
      const cleaned = value.replace(/[^0-9+]/g, '');

      if (event.target.value !== cleaned) {
        event.target.value = cleaned;
      }
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener('change', updateNIPLabels);
  }

  form.addEventListener('submit', handleUpdateUserData);

  loadUserDataFields();
}

function loadUserDataFields() {
  const user = getSessionUser() || {};

  setProfileFieldValue('profile-nama-operator', user.namaOperator || '');
  setProfileFieldValue('profile-nama-sekolah', user.namaSekolah || '');
  setProfileFieldValue('profile-npsn', user.npsn || '');
  setProfileFieldValue('profile-email', user.email || '');
  setProfileFieldValue('profile-no-hp', user.noHp || '');
  setProfileFieldValue('profile-status-kepegawaian-operator', user.statusKepegawaianOperator || '');
  setProfileFieldValue('profile-nip-operator-input', user.nipOperator || '');

  updateNIPLabels();
}

function updateNIPLabels() {
  const statusSelect = document.getElementById('profile-status-kepegawaian-operator');
  const nipLabel = document.getElementById('profile-nip-operator-form-label');

  if (!statusSelect || !nipLabel) {
    return;
  }

  const status = statusSelect.value;
  nipLabel.textContent = getNIPLabelText(status) + ' Operator';
}

async function handleUpdateUserData(event) {
  event.preventDefault();

  hideAuthMessage('profile-user-data-message');

  const submitButton = document.getElementById('profile-user-data-submit');

  const namaOperator = getValueById('profile-nama-operator');
  const namaSekolah = getValueById('profile-nama-sekolah');
  const npsn = getValueById('profile-npsn');
  const email = getValueById('profile-email');
  const noHp = getValueById('profile-no-hp');
  const statusKepegawaianOperator = getValueById('profile-status-kepegawaian-operator');
  const nipOperator = getValueById('profile-nip-operator-input');

  const errors = [];

  if (!namaOperator) {
    errors.push('Nama operator wajib diisi.');
  }

  if (!namaSekolah) {
    errors.push('Nama sekolah wajib diisi.');
  }

  if (!/^\d{8}$/.test(npsn)) {
    errors.push('NPSN harus terdiri dari 8 digit angka.');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Format email tidak valid.');
  }

  if (!noHp) {
    errors.push('No. HP/WA wajib diisi.');
  }

  if (errors.length > 0) {
    showAuthMessage(
      'profile-user-data-message',
      errors.join(' '),
      'error'
    );
    return;
  }

  setButtonLoading(submitButton, true, 'Menyimpan...');

  try {
    const result = await apiRequest(
      'updateUserData',
      {
        namaOperator: namaOperator,
        namaSekolah: namaSekolah,
        npsn: npsn,
        email: email,
        noHp: noHp,
        statusKepegawaianOperator: statusKepegawaianOperator,
        nipOperator: nipOperator
      },
      true
    );

    if (!result.success) {
      if (result.code === 401 || result.code === 403) {
        clearSession();
        window.location.href = 'login.html?role=operator';
        return;
      }

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.join(' '));
      }

      throw new Error(result.message || 'Gagal menyimpan Data operator.');
    }

    if (result.data && result.data.user) {
      saveSession(getSessionToken(), result.data.user);
      renderProfile(result.data.user);
    }

    loadUserDataFields();

    showAuthMessage(
      'profile-user-data-message',
      result.message || 'Data operator berhasil diperbarui.',
      'success'
    );

  } catch (error) {
    showAuthMessage(
      'profile-user-data-message',
      error.message || String(error),
      'error'
    );

  } finally {
    setButtonLoading(submitButton, false, 'Simpan Data Operator');
  }
}

/**
 * ============================================================
 * SECTION 2: PASSWORD FORM
 * ============================================================
 */

function initPasswordForm() {
  const form = document.getElementById('profil-change-password-form');

  if (form) {
    form.addEventListener('submit', handleChangePassword);
  }
}

async function handleChangePassword(event) {
  event.preventDefault();

  hideAuthMessage('profil-message-password');

  const submitButton = document.getElementById('profil-submit');

  const currentPassword = getValueById('profil-current-password');
  const newPassword = getValueById('profil-new-password');
  const confirmPassword = getValueById('profil-confirm-password');

  const errors = [];

  if (!currentPassword) {
    errors.push('Password lama wajib diisi.');
  }

  if (newPassword.length < 8) {
    errors.push('Password baru minimal 8 karakter.');
  }

  if (newPassword !== confirmPassword) {
    errors.push('Konfirmasi password baru tidak sama.');
  }

  if (newPassword && newPassword === currentPassword) {
    errors.push('Password baru tidak boleh sama dengan password lama.');
  }

  if (errors.length > 0) {
    showAuthMessage('profil-message-password', errors.join(' '), 'error');
    return;
  }

  setButtonLoading(submitButton, true, 'Memproses...');

  try {
    const result = await apiRequest(
      'changePassword',
      {
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmNewPassword: confirmPassword
      },
      true
    );

    if (!result.success) {
      if (result.code === 401 || result.code === 403) {
        if (
          result.message &&
          result.message.toLowerCase().indexOf('password lama') !== -1
        ) {
          throw new Error(result.message);
        }

        clearSession();
        window.location.href = 'login.html?role=operator';
        return;
      }

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.join(' '));
      }

      throw new Error(result.message || 'Gagal mengganti password.');
    }

    showAuthMessage(
      'profil-message-password',
      result.message || 'Password berhasil diganti.',
      'success'
    );

    const form = document.getElementById('profil-change-password-form');

    if (form) {
      form.reset();
    }

    if (result.data && result.data.user) {
      saveSession(getSessionToken(), result.data.user);
      renderProfile(result.data.user);
    }

  } catch (error) {
    showAuthMessage(
      'profil-message-password',
      error.message || String(error),
      'error'
    );

  } finally {
    setButtonLoading(submitButton, false, 'Simpan Password');
  }
}

/**
 * ============================================================
 * SECTION 3: KEPSEK DATA FORM
 * ============================================================
 */

function initKepsekDataForm() {
  const form = document.getElementById('profile-data-form');

  if (!form) {
    return;
  }

  const kepsekStatus = document.getElementById('profile-kepsek-status-input');

  if (kepsekStatus) {
    kepsekStatus.addEventListener('change', updateKepsekNIPLabels);
  }

  form.addEventListener('submit', handleUpdateKepsekData);

  loadKepsekDataFields();
}

function loadKepsekDataFields() {
  const user = getSessionUser() || {};

  setProfileFieldValue('profile-kepsek-nama-input', user.namaKepalaSekolah || '');
  setProfileFieldValue('profile-kepsek-status-input', user.statusKepegawaianKepalaSekolah || '');
  setProfileFieldValue('profile-kepsek-nip-input', user.nipKepalaSekolah || '');

  updateKepsekNIPLabels();
}

function updateKepsekNIPLabels() {
  const kepsekStatusEl = document.getElementById('profile-kepsek-status-input');
  const kepsekStatusLabel = document.getElementById('profile-kepsek-nip-form-label');

  if (!kepsekStatusEl || !kepsekStatusLabel) {
    return;
  }

  const kepsekStatus = kepsekStatusEl.value;
  kepsekStatusLabel.textContent = getNIPLabelText(kepsekStatus) + ' Kepala Sekolah';
}

async function handleUpdateKepsekData(event) {
  event.preventDefault();

  hideAuthMessage('profile-data-message');

  const submitButton = document.getElementById('profile-data-submit');

  const payload = {
    namaKepalaSekolah: getValueById('profile-kepsek-nama-input'),
    statusKepegawaianKepalaSekolah: getValueById('profile-kepsek-status-input'),
    nipKepalaSekolah: getValueById('profile-kepsek-nip-input')
  };

  setButtonLoading(submitButton, true, 'Menyimpan...');

  try {
    const result = await apiRequest('updateProfile', payload, true);

    if (!result.success) {
      if (result.code === 401 || result.code === 403) {
        clearSession();
        window.location.href = 'login.html?role=operator';
        return;
      }

      throw new Error(result.message || 'Gagal menyimpan data Kepala Sekolah.');
    }

    if (result.data && result.data.user) {
      saveSession(getSessionToken(), result.data.user);
      renderProfile(result.data.user);
    }

    loadKepsekDataFields();

    showAuthMessage(
      'profile-data-message',
      result.message || 'Data Kepala Sekolah berhasil disimpan.',
      'success'
    );

  } catch (error) {
    showAuthMessage(
      'profile-data-message',
      error.message || String(error),
      'error'
    );

  } finally {
    setButtonLoading(submitButton, false, 'Simpan Data Kepala Sekolah');
  }
}
