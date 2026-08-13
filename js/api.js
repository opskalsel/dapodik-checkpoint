/**
 * ============================================================
 * DAPODIK CHECKPOINT - API HELPER (TAHAN ERROR)
 * ============================================================
 * - Timeout 30 detik per percobaan
 * - Retry otomatis (maks 2x) untuk gagal jaringan / respons HTML
 * - Pesan error yang informatif
 * - Helper diagnostik testKoneksi()
 * ============================================================
 */

const API_CONFIG = {
  maxRetries: 2,
  retryDelayMs: 1200,
  timeoutMs: 30000
};

function apiDelay_(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout_(url, options, timeoutMs) {
  const controller = new AbortController();

  const timer = setTimeout(function () {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(
      url,
      Object.assign({}, options, { signal: controller.signal })
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Request utama ke backend. Kontrak tetap:
 * apiRequest(action, data, includeToken)
 */
async function apiRequest(action, data, includeToken) {
  if (!APP_CONFIG || !APP_CONFIG.API_URL) {
    throw new Error('APP_CONFIG.API_URL belum tersedia.');
  }

  if (APP_CONFIG.API_URL.indexOf('GANTI_DENGAN_URL_APPS_SCRIPT') !== -1) {
    throw new Error('API_URL belum diisi. Update js/config.js dengan URL Apps Script Anda.');
  }

  const payload = Object.assign({ action: action }, data || {});

  if (includeToken) {
    const token = getSessionToken();
    if (token) {
      payload.token = token;
    }
  }

  let lastError = null;

  for (let attempt = 0; attempt <= API_CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      await apiDelay_(API_CONFIG.retryDelayMs * attempt);
    }

    let response;

    try {
      response = await fetchWithTimeout_(
        APP_CONFIG.API_URL,
        {
          method: 'POST',
          body: JSON.stringify(payload),
          redirect: 'follow'
        },
        API_CONFIG.timeoutMs
      );
    } catch (networkError) {
      lastError = new Error(
        'Tidak dapat terhubung ke server (percobaan ' + (attempt + 1) +
        '/' + (API_CONFIG.maxRetries + 1) + '). Periksa koneksi internet.'
      );
      continue;
    }

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch (parseError) {
      /**
       * Respons bukan JSON = biasanya halaman error HTML dari Google
       * (cold start / kuota sesaat). Retry dulu sebelum menyerah.
       */
      console.warn(
        'apiRequest: respons non-JSON (percobaan ' + (attempt + 1) + '):',
        text.slice(0, 200)
      );

      lastError = new Error(
        'Respons server tidak valid (percobaan ' + (attempt + 1) +
        '/' + (API_CONFIG.maxRetries + 1) + '). Server sesaat mengembalikan HTML.'
      );
      continue;
    }

    return result;
  }

  throw lastError || new Error('Gagal menghubungi server setelah beberapa percobaan.');
}

/**
 * Diagnostik: jalankan dari Console browser (F12):
 *    testKoneksi()
 */
async function testKoneksi() {
  try {
    const response = await fetchWithTimeout_(
      APP_CONFIG.API_URL + '?action=ping',
      { method: 'GET' },
      15000
    );

    const text = await response.text();

    console.log('Status HTTP:', response.status);
    console.log('Isi respons (300 karakter pertama):', text.slice(0, 300));

    try {
      console.log('JSON valid:', JSON.parse(text));
    } catch (e) {
      console.log('>>> RESPON BUKAN JSON. Jika halaman login Google → akses deployment belum "Anyone".');
    }
  } catch (error) {
    console.error('Gagal terhubung:', error);
  }
}
