/**
 * ============================================================
 * DAPODIK CHECKPOINT - FRONTEND APP
 * ============================================================
 * Tahap 4B
 * - Inisialisasi landing page
 * - Navigasi ke login/register
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', function () {
  initApp();
});

function initApp() {
  setFooterYear();
  bindLandingActions();

  console.log(
    APP_CONFIG.APP_NAME + ' siap. API URL: ' + APP_CONFIG.API_URL
  );
}

/**
 * Set tahun di footer
 */
function setFooterYear() {
  const el = document.getElementById('footer-year');

  if (!el) {
    return;
  }

  el.textContent = ' © ' + new Date().getFullYear();
}

/**
 * Binding seluruh tombol landing page
 */
function bindLandingActions() {
  const buttons = document.querySelectorAll('[data-action]');

  buttons.forEach(function (button) {
    button.addEventListener('click', handleLandingAction);
  });
}

/**
 * Handler tombol landing page
 */
function handleLandingAction(event) {
  const action = event.currentTarget.dataset.action;

  const routes = {
    'open-login-operator': 'login.html?role=operator',
    'open-login-admin': 'login.html?role=admin',
    'open-register': 'register.html',
    'start-checklist': 'login.html?role=operator'
  };

  const route = routes[action];

  if (!route) {
    return;
  }

  window.location.href = route;
}