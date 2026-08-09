/**
 * ============================================================
 * DAPODIK CHECKPOINT - AUTH
 * ============================================================
 * Tahap 4B
 * - Halaman login
 * - Halaman register
 * - Penyimpanan sesi
 * - Dashboard placeholder
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('login-form')) {
    initLoginPage();
  }

  if (document.getElementById('register-form')) {
    initRegisterPage();
  }

  if (document.getElementById('dashboard-placeholder')) {
    initDashboardPlaceholder();
  }
});

/**
 * ============================================================
 * SESSION STORAGE HELPERS
 * ============================================================
 */

function saveSession(token, user) {
  sessionStorage.setItem(APP_CONFIG.STORAGE_KEYS.token, token);
  sessionStorage.setItem(APP_CONFIG.STORAGE_KEYS.user, JSON.stringify(user));
}

function getSessionToken() {
  return sessionStorage.getItem(APP_CONFIG.STORAGE_KEYS.token) || '';
}

function getSessionUser() {
  try {
    const user = sessionStorage.getItem(APP_CONFIG.STORAGE_KEYS.user);

    if (!user) {
      return null;
    }

    return JSON.parse(user);
  } catch (error) {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(APP_CONFIG.STORAGE_KEYS.token);
  sessionStorage.removeItem(APP_CONFIG.STORAGE_KEYS.user);
}

function isLoggedIn() {
  return Boolean(getSessionToken());
}

/**
 * ============================================================
 * UI HELPERS
 * ============================================================
 */

function showAuthMessage(elementId, message, type) {
  const el = document.getElementById(elementId);

  if (!el) {
    console.warn('showAuthMessage: elemen "' + elementId + '" tidak ditemukan.');
    return;
  }

  el.textContent = message;
  el.className = 'alert show alert-' + type;

  /**
   * Pastikan elemen terlihat
   */
  el.style.display = 'block';
  el.style.whiteSpace = 'pre-wrap';

  /**
   * Scroll ke elemen agar pesan terlihat
   */
  setTimeout(function () {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

function hideAuthMessage(elementId) {
  const el = document.getElementById(elementId);

  if (!el) {
    return;
  }

  el.textContent = '';
  el.className = 'alert';
}

function setButtonLoading(button, isLoading, loadingText) {
  if (!button) {
    return;
  }

  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText || 'Memproses...';
  } else {
    button.disabled = false;

    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
  }
}

/**
 * ============================================================
 * LOGIN PAGE
 * ============================================================
 */

function initLoginPage() {
  const params = new URLSearchParams(window.location.search);
  const role = params.get('role') === 'admin' ? 'admin' : 'operator';

  document.body.dataset.expectedRole = role;

  const title = document.getElementById('login-title');
  const subtitle = document.getElementById('login-subtitle');
  const badge = document.getElementById('login-role-badge');

  if (role === 'admin') {
    if (title) {
      title.textContent = 'Masuk sebagai Admin';
    }

    if (subtitle) {
      subtitle.textContent = 'Gunakan akun admin untuk memantau seluruh operator sekolah.';
    }

    if (badge) {
      badge.textContent = 'Admin';
      badge.className = 'badge badge-red';
    }
  } else {
    if (title) {
      title.textContent = 'Masuk sebagai Operator';
    }

    if (subtitle) {
      subtitle.textContent = 'Gunakan akun operator sekolah Anda untuk melanjutkan checklist.';
    }

    if (badge) {
      badge.textContent = 'Operator';
      badge.className = 'badge badge-blue';
    }
  }

  const form = document.getElementById('login-form');

  if (form) {
    form.addEventListener('submit', handleLogin);
  }

  /**
   * Jika sudah login, langsung arahkan ke dashboard.
   */
  if (isLoggedIn()) {
    const user = getSessionUser();

    if (user && user.role === role) {
      window.location.href = 'dashboard.html';
      return;
    }
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const expectedRole = document.body.dataset.expectedRole || 'operator';
  const submitButton = document.getElementById('login-submit');
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');

  hideAuthMessage('login-message');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!username || !password) {
    showAuthMessage('login-message', 'Username dan password wajib diisi.', 'error');
    return;
  }

  setButtonLoading(submitButton, true, 'Memproses...');

  try {
    const result = await apiRequest(
      'login',
      {
        username: username,
        password: password
      },
      false
    );

    if (!result.success) {
      throw new Error(result.message || 'Login gagal.');
    }

    const user = result.data.user;
    const token = result.data.token;

    if (expectedRole === 'admin' && user.role !== 'admin') {
      throw new Error('Akun ini bukan admin. Silakan gunakan Masuk Operator.');
    }

    if (expectedRole === 'operator' && user.role !== 'operator') {
      throw new Error('Akun ini adalah admin. Silakan gunakan Masuk Admin.');
    }

    saveSession(token, user);

    showAuthMessage(
      'login-message',
      'Login berhasil. Mengalihkan ke dashboard...',
      'success'
    );

    setTimeout(function () {
      window.location.href = 'dashboard.html';
    }, 800);

  } catch (error) {
    showAuthMessage(
      'login-message',
      error.message || String(error),
      'error'
    );
  } finally {
    setButtonLoading(submitButton, false, 'Masuk');
  }
}

/**
 * ============================================================
 * REGISTER PAGE
 * ============================================================
 */

function initRegisterPage() {
  const form = document.getElementById('register-form');

  if (form) {
    form.addEventListener('submit', handleRegister);
  }

  /**
   * Jika sudah login, tidak perlu mendaftar lagi.
   */
  if (isLoggedIn()) {
    window.location.href = 'dashboard.html';
  }
}

async function handleRegister(event) {
  event.preventDefault();

  const submitButton = document.getElementById('register-submit');

  hideAuthMessage('register-message');

  const namaOperator = getValueById('register-nama-operator');
  const namaSekolah = getValueById('register-nama-sekolah');
  const npsn = getValueById('register-npsn');
  const noHp = getValueById('register-no-hp');
  const email = getValueById('register-email');
  const username = getValueById('register-username').toLowerCase();
  const password = getValueById('register-password');
  const confirmPassword = getValueById('register-confirm-password');

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

  if (!noHp) {
    errors.push('No. HP/WA wajib diisi.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Format email tidak valid.');
  }

  if (!/^[a-z0-9_.\-]{4,30}$/.test(username)) {
    errors.push('Username hanya boleh huruf kecil, angka, underscore, titik, atau minus (-), dengan panjang 4-30 karakter.');
  }

  if (password.length < 8) {
    errors.push('Password minimal 8 karakter.');
  }

  if (password !== confirmPassword) {
    errors.push('Konfirmasi password tidak sama.');
  }

  if (errors.length > 0) {
    showAuthMessage('register-message', errors.join(' '), 'error');
    return;
  }

  setButtonLoading(submitButton, true, 'Mendaftar...');

  try {
    const result = await apiRequest(
      'register',
      {
        namaOperator: namaOperator,
        namaSekolah: namaSekolah,
        npsn: npsn,
        noHp: noHp,
        email: email,
        username: username,
        password: password
      },
      false
    );

    if (!result.success) {
      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.join(' '));
      }

      throw new Error(result.message || 'Registrasi gagal.');
    }

    showAuthMessage(
      'register-message',
      'Registrasi berhasil. Mengalihkan ke halaman login...',
      'success'
    );

    setTimeout(function () {
      window.location.href = 'login.html?role=operator';
    }, 1200);

  } catch (error) {
    showAuthMessage(
      'register-message',
      error.message || String(error),
      'error'
    );
  } finally {
    setButtonLoading(submitButton, false, 'Daftar Akun');
  }
}

function getValueById(id) {
  const el = document.getElementById(id);

  if (!el) {
    return '';
  }

  return el.value.trim();
}

/**
 * ============================================================
 * DASHBOARD PLACEHOLDER
 * ============================================================
 */

function initDashboardPlaceholder() {
  const user = getSessionUser();
  const token = getSessionToken();

  if (!user || !token) {
    window.location.href = 'login.html?role=operator';
    return;
  }

  setTextById('dashboard-nama', user.namaOperator || '-');
  setTextById('dashboard-sekolah', user.namaSekolah || '-');
  setTextById('dashboard-npsn', user.npsn || '-');
  setTextById('dashboard-username', user.username || '-');
  setTextById('dashboard-role', user.role || '-');
  setTextById('dashboard-token', token.substring(0, 18) + '...');

  const logoutButton = document.getElementById('logout-button');

  if (logoutButton) {
    logoutButton.addEventListener('click', function () {
      clearSession();
      window.location.href = 'index.html';
    });
  }
}

function setTextById(id, text) {
  const el = document.getElementById(id);

  if (el) {
    el.textContent = text;
  }
}

/**
 * ============================================================
 * PATCH 4H-2 - LOGIN REDIRECT FOR ADMIN & WAJIB GANTI PASSWORD
 * ============================================================
 */

async function handleLogin(event) {
  event.preventDefault();

  const expectedRole = document.body.dataset.expectedRole || 'operator';
  const submitButton = document.getElementById('login-submit');
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');

  hideAuthMessage('login-message');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!username || !password) {
    showAuthMessage('login-message', 'Username dan password wajib diisi.', 'error');
    return;
  }

  setButtonLoading(submitButton, true, 'Memproses...');

  try {
    const result = await apiRequest(
      'login',
      {
        username: username,
        password: password
      },
      false
    );

    if (!result.success) {
      throw new Error(result.message || 'Login gagal.');
    }

    const user = result.data.user;
    const token = result.data.token;

    if (expectedRole === 'admin' && user.role !== 'admin') {
      throw new Error('Akun ini bukan admin. Silakan gunakan Masuk Operator.');
    }

    if (expectedRole === 'operator' && user.role !== 'operator') {
      throw new Error('Akun ini adalah admin. Silakan gunakan Masuk Admin.');
    }

    saveSession(token, user);

    showAuthMessage(
      'login-message',
      'Login berhasil. Mengalihkan...',
      'success'
    );

    setTimeout(function () {
      if (user.wajibGantiPassword) {
        window.location.href = 'profil.html';
        return;
      }

      if (user.role === 'admin') {
        window.location.href = 'admin.html';
        return;
      }

      window.location.href = 'dashboard.html';
    }, 800);

  } catch (error) {
    showAuthMessage(
      'login-message',
      error.message || String(error),
      'error'
    );
  } finally {
    setButtonLoading(submitButton, false, 'Masuk');
  }
}

/**
 * ============================================================
 * PATCH 5C-2 - VALIDASI REGISTRASI REAL-TIME
 * ============================================================
 */

(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRegisterValidation);
  } else {
    initRegisterValidation();
  }
})();

function initRegisterValidation() {
  const form = document.getElementById('register-form');

  if (!form) {
    return;
  }

  const npsnInput = document.getElementById('register-npsn');
  const usernameInput = document.getElementById('register-username');
  const noHpInput = document.getElementById('register-no-hp');

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
}

