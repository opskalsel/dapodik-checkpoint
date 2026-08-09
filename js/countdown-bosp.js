/**
 * ============================================================
 * DAPODIK CHECKPOINT - COUNTDOWN BOSP
 * ============================================================
 * Batas Akhir Pengiriman Data untuk BOSP
 * 31 Agustus 2026 pukul 23.59 WIB (UTC+7)
 * ============================================================
 */

(function () {
  'use strict';

  /**
   * Deadline dalam zona waktu WIB (UTC+7)
   */
  const BOSP_DEADLINE = new Date('2026-08-31T23:59:00+07:00');

  let timerId = null;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function tick() {
    const hariEl = document.getElementById('bosp-hari');
    const jamEl = document.getElementById('bosp-jam');
    const menitEl = document.getElementById('bosp-menit');
    const detikEl = document.getElementById('bosp-detik');
    const timerEl = document.getElementById('bosp-timer');
    const expiredEl = document.getElementById('bosp-expired');

    if (!hariEl || !jamEl || !menitEl || !detikEl) {
      return;
    }

    const now = new Date();
    const diff = BOSP_DEADLINE - now;

    if (diff <= 0) {
      if (timerEl) {
        timerEl.style.display = 'none';
      }

      if (expiredEl) {
        expiredEl.style.display = 'block';
      }

      if (timerId) {
        clearInterval(timerId);
      }

      return;
    }

    const hari = Math.floor(diff / 86400000);
    const jam = Math.floor((diff % 86400000) / 3600000);
    const menit = Math.floor((diff % 3600000) / 60000);
    const detik = Math.floor((diff % 60000) / 1000);

    hariEl.textContent = hari;
    jamEl.textContent = pad(jam);
    menitEl.textContent = pad(menit);
    detikEl.textContent = pad(detik);
  }

  function init() {
    if (!document.getElementById('bosp-countdown')) {
      return;
    }

    tick();

    timerId = setInterval(tick, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();