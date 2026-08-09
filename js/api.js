/**
 * ============================================================
 * DAPODIK CHECKPOINT - API HELPER
 * ============================================================
 * Fungsi utama untuk memanggil backend Google Apps Script.
 *
 * Catatan penting:
 * - Kita TIDAK mengirim header Content-Type application/json.
 * - Body dikirim sebagai string JSON.
 * - fetch secara default akan mengirim Content-Type text/plain.
 * - Ini membantu menghindari masalah CORS/preflight pada
 *   Google Apps Script Web App.
 * ============================================================
 */

async function apiRequest(action, data, includeToken) {
  if (!APP_CONFIG || !APP_CONFIG.API_URL) {
    throw new Error('APP_CONFIG.API_URL belum tersedia.');
  }

  if (APP_CONFIG.API_URL.indexOf('GANTI_DENGAN_URL_APPS_SCRIPT') !== -1) {
    throw new Error('API_URL belum diisi. Silakan update js/config.js dengan URL Apps Script Anda.');
  }

  const payload = Object.assign(
    {
      action: action
    },
    data || {}
  );

  if (includeToken) {
    const token = getSessionToken();

    if (token) {
      payload.token = token;
    }
  }

  let response;

  try {
    response = await fetch(APP_CONFIG.API_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      redirect: 'follow'
    });
  } catch (error) {
    throw new Error(
      'Tidak dapat terhubung ke server. Periksa koneksi internet, URL Apps Script, dan pastikan backend sudah di-deploy sebagai Web App.'
    );
  }

  const text = await response.text();

  let result;

  try {
    result = JSON.parse(text);
  } catch (error) {
    throw new Error(
      'Respons server tidak valid. Pastikan Apps Script mengembalikan JSON dan deployment sudah diperbarui.'
    );
  }

  return result;
}