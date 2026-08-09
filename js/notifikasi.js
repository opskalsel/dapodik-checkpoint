/**
 * ============================================================
 * DAPODIK CHECKPOINT - NOTIFIKASI GLOBAL
 * ============================================================
 * - Toast notifikasi (sukses / gagal / info)
 * - Dialog konfirmasi pengganti confirm()
 * - Otomatis membungkus showAuthMessage agar setiap pesan
 *   sukses/gagal juga memunculkan toast.
 * ============================================================
 */

(function () {
  'use strict';

  function ensureNotifContainer() {
    let container = document.getElementById('notif-container');

    if (!container) {
      container = document.createElement('div');
      container.id = 'notif-container';
      container.className = 'notif-container';
      document.body.appendChild(container);
    }

    return container;
  }

  function removeNotif(item) {
    if (!item || !item.parentNode) {
      return;
    }

    item.classList.remove('show');
    item.classList.add('hide');

    setTimeout(function () {
      if (item.parentNode) {
        item.parentNode.removeChild(item);
      }
    }, 300);
  }

  function showNotif(type, title, message, duration) {
    const container = ensureNotifContainer();

    const item = document.createElement('div');
    item.className = 'notif-item notif-' + type;

    const icon = type === 'success' ? '✅' : type === 'error' ? '⛔' : 'ℹ️';

    const iconEl = document.createElement('div');
    iconEl.className = 'notif-icon';
    iconEl.textContent = icon;

    const body = document.createElement('div');
    body.className = 'notif-body';

    const titleEl = document.createElement('div');
    titleEl.className = 'notif-title';
    titleEl.textContent = title || 'Informasi';

    const msgEl = document.createElement('div');
    msgEl.className = 'notif-message';
    msgEl.textContent = message || '';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'notif-close';
    closeBtn.type = 'button';
    closeBtn.textContent = '×';

    closeBtn.addEventListener('click', function () {
      removeNotif(item);
    });

    body.appendChild(titleEl);
    body.appendChild(msgEl);

    item.appendChild(iconEl);
    item.appendChild(body);
    item.appendChild(closeBtn);

    container.appendChild(item);

    setTimeout(function () {
      item.classList.add('show');
    }, 10);

    const ms = duration || 6000;

    setTimeout(function () {
      removeNotif(item);
    }, ms);
  }

  /**
   * API publik untuk toast
   */
  window.notifSukses = function (message, title) {
    showNotif('success', title || 'Berhasil', message);
  };

  window.notifGagal = function (message, title) {
    showNotif('error', title || 'Gagal', message);
  };

  window.notifInfo = function (message, title) {
    showNotif('info', title || 'Informasi', message);
  };

  /**
   * Dialog konfirmasi pengganti confirm()
   * Mengembalikan Promise<boolean>
   */
  window.konfirmasi = function (message, title) {
    return new Promise(function (resolve) {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';

      const box = document.createElement('div');
      box.className = 'modal-box';

      const titleEl = document.createElement('div');
      titleEl.className = 'modal-title';
      titleEl.textContent = title || 'Konfirmasi';

      const msgEl = document.createElement('div');
      msgEl.className = 'modal-message';
      msgEl.textContent = message || '';

      const actions = document.createElement('div');
      actions.className = 'modal-actions';

      const btnBatal = document.createElement('button');
      btnBatal.className = 'btn btn-outline';
      btnBatal.type = 'button';
      btnBatal.textContent = 'Batal';

      const btnYa = document.createElement('button');
      btnYa.className = 'btn btn-primary';
      btnYa.type = 'button';
      btnYa.textContent = 'Ya, Lanjutkan';

      function close() {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }

      btnBatal.addEventListener('click', function () {
        close();
        resolve(false);
      });

      btnYa.addEventListener('click', function () {
        close();
        resolve(true);
      });

      actions.appendChild(btnBatal);
      actions.appendChild(btnYa);

      box.appendChild(titleEl);
      box.appendChild(msgEl);
      box.appendChild(actions);

      overlay.appendChild(box);
      document.body.appendChild(overlay);
    });
  };

  /**
   * Bungkus showAuthMessage agar setiap pesan sukses/gagal/info
   * juga memunculkan toast notifikasi.
   */
  function wrapShowAuthMessage() {
    if (
      typeof window.showAuthMessage === 'function' &&
      !window._showAuthMessageWrapped
    ) {
      const orig = window.showAuthMessage;

      window._showAuthMessageWrapped = true;

      window.showAuthMessage = function (elementId, message, type) {
        orig(elementId, message, type);

        if (type === 'success') {
          notifSukses(message);
        } else if (type === 'error') {
          notifGagal(message);
        } else if (type === 'info') {
          notifInfo(message);
        }
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wrapShowAuthMessage);
  } else {
    wrapShowAuthMessage();
  }
})();