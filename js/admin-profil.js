/**
 * ============================================================
 * DAPODIK CHECKPOINT - ADMIN PROFIL PAGE
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('admin-profil-page')) {
    initAdminProfil();
  }
});

async function initAdminProfil() {
  bindAdminProfilControls();
  bindAdminDropdownControls();
  bindAdminSectionControls();

  const user = getSessionUser();
  const token = getSessionToken();

  if (!user || !token) {
    window.location.href = 'login.html?role=admin';
    return;
  }

  /**
   * Pastikan user adalah admin
   */
  if (String(user.role || '').toLowerCase() !== 'admin') {
    window.location.href = 'dashboard.html';
    return;
  }

  renderAdminProfile(user);

  const sessionValid = await validateAdminProfilSession();

  if (!sessionValid) {
    return;
  }

  initAdminDataForm();
  initAdminPasswordForm();
}

function bindAdminProfilControls() {
  const logoutButton = document.getElementById('logout-button');

  if (logoutButton) {
    logoutButton.addEventListener('click', function () {
      clearSession();
      window.location.href = 'index.html';
    });
  }
}

async function validateAdminProfilSession() {
  try {
    const result = await apiRequest('validateToken', {}, true);

    if (!result.success) {
      clearSession();
      window.location.href = 'login.html?role=admin';
      return false;
    }

    if (result.data && result.data.user) {
      if (String(result.data.user.role || '').toLowerCase() !== 'admin') {
        window.location.href = 'dashboard.html';
        return false;
      }

      saveSession(getSessionToken(), result.data.user);
      renderAdminProfile(result.data.user);
    }

    return true;

  } catch (error) {
    showAuthMessage(
      'admin-profil-message',
      error.message || String(error),
      'error'
    );

    return false;
  }
}

function renderAdminProfile(user) {
  setTextById('admin-profil-nama', user.namaOperator || '-');
  setTextById('admin-profil-username', user.username || '-');
  setTextById('admin-profil-email', user.email || '-');
  setTextById('admin-profil-no-hp', user.noHp || '-');
}

function setTextById(id, text) {
  const el = document.getElementById(id);

  if (el) {
    el.textContent = text;
  }
}

/**
 * ============================================================
 * DROPDOWN CONTROLS
 * ============================================================
 */

function bindAdminDropdownControls() {
  const toggle = document.getElementById('admin-profil-dropdown-toggle');
  const menu = document.getElementById('admin-profil-dropdown-menu');

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

  const items = menu.querySelectorAll('.dropdown-item');

  items.forEach(function (item) {
    item.addEventListener('click', function () {
      const section = item.dataset.section;
      showAdminSection(section);
      menu.style.display = 'none';
    });
  });
}

function showAdminSection(sectionName) {
  const sections = ['admin-data', 'admin-password'];

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

function bindAdminSectionControls() {
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
 * ADMIN DATA FORM
 * ============================================================
 */

function initAdminDataForm() {
  const form = document.getElementById('admin-data-form');

  if (!form) {
    return;
  }

  const noHpInput = document.getElementById('admin-no-hp');

  if (noHpInput) {
    noHpInput.addEventListener('input', function (event) {
      const value = event.target.value;
      const cleaned = value.replace(/[^0-9+]/g, '');

      if (event.target.value !== cleaned) {
        event.target.value = cleaned;
      }
    });
  }

  form.addEventListener('submit', handleUpdateAdminData);

  loadAdminDataFields();
}

function loadAdminDataFields() {
  const user = getSessionUser() || {};

  setAdminFieldValue('admin-nama-operator', user.namaOperator || '');
  setAdminFieldValue('admin-email', user.email || '');
  setAdminFieldValue('admin-no-hp', user.noHp || '');
}

function setAdminFieldValue(id, value) {
  const el = document.getElementById(id);

  if (el) {
    el.value = value;
  }
}

function getAdminFieldValue(id) {
  const el = document.getElementById(id);

  if (!el) {
    return '';
  }

  return el.value;
}

async function handleUpdateAdminData(event) {
  event.preventDefault();

  hideAuthMessage('admin-data-message');

  const submitButton = document.getElementById('admin-data-submit');

  const namaOperator = getAdminFieldValue('admin-nama-operator');
  const email = getAdminFieldValue('admin-email');
  const noHp = getAdminFieldValue('admin-no-hp');

  const errors = [];

  if (!namaOperator) {
    errors.push('Nama wajib diisi.');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Format email tidak valid.');
  }

  if (!noHp) {
    errors.push('No. HP/WA wajib diisi.');
  }

  if (errors.length > 0) {
    showAuthMessage('admin-data-message', errors.join(' '), 'error');
    return;
  }

  setButtonLoading(submitButton, true, 'Menyimpan...');

  try {
    const result = await apiRequest(
      'updateUserData',
      {
        namaOperator: namaOperator,
        email: email,
        noHp: noHp,
        namaSekolah: '-',
        npsn: '00000000'
      },
      true
    );

    if (!result.success) {
      if (result.code === 401 || result.code === 403) {
        clearSession();
        window.location.href = 'login.html?role=admin';
        return;
      }

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.join(' '));
      }

      throw new Error(result.message || 'Gagal menyimpan data admin.');
    }

    if (result.data && result.data.user) {
      saveSession(getSessionToken(), result.data.user);
      renderAdminProfile(result.data.user);
    }

    loadAdminDataFields();

    showAuthMessage(
      'admin-data-message',
      result.message || 'Data admin berhasil diperbarui.',
      'success'
    );

  } catch (error) {
    showAuthMessage(
      'admin-data-message',
      error.message || String(error),
      'error'
    );

  } finally {
    setButtonLoading(submitButton, false, 'Simpan Data Admin');
  }
}

/**
 * ============================================================
 * ADMIN PASSWORD FORM
 * ============================================================
 */

function initAdminPasswordForm() {
  const form = document.getElementById('admin-password-form');

  if (form) {
    form.addEventListener('submit', handleUpdateAdminPassword);
  }
}

async function handleUpdateAdminPassword(event) {
  event.preventDefault();

  hideAuthMessage('admin-password-message');

  const submitButton = document.getElementById('admin-password-submit');

  const currentPassword = getAdminFieldValue('admin-current-password');
  const newPassword = getAdminFieldValue('admin-new-password');
  const confirmPassword = getAdminFieldValue('admin-confirm-password');

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
    showAuthMessage('admin-password-message', errors.join(' '), 'error');
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
        window.location.href = 'login.html?role=admin';
        return;
      }

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.join(' '));
      }

      throw new Error(result.message || 'Gagal mengganti password.');
    }

    showAuthMessage(
      'admin-password-message',
      result.message || 'Password berhasil diganti.',
      'success'
    );

    const form = document.getElementById('admin-password-form');

    if (form) {
      form.reset();
    }

    if (result.data && result.data.user) {
      saveSession(getSessionToken(), result.data.user);
      renderAdminProfile(result.data.user);
    }

  } catch (error) {
    showAuthMessage(
      'admin-password-message',
      error.message || String(error),
      'error'
    );

  } finally {
    setButtonLoading(submitButton, false, 'Simpan Password');
  }
}