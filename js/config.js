/**
 * ============================================================
 * DAPODIK CHECKPOINT - FRONTEND CONFIG
 * ============================================================
 */

const APP_CONFIG = {
  /**
   * Ganti nilai ini dengan URL Web App Google Apps Script Anda.
   * Contoh:
   * https://script.google.com/macros/s/xxxx/exec
   */
  API_URL: 'https://script.google.com/macros/s/AKfycbyuK3Eeza_Q0acDG1bOz2aORHbtv-VwqSpvF6OzVvjQC-Kp1t6FGuNU0Q46dBIn3M_9/exec',

  APP_NAME: 'Dapodik Checkpoint',
  DEFAULT_SEMESTER: 'Ganjil',
  DEFAULT_TAHUN_PELAJARAN: '2026/2027',
  SYNC_INTERVAL_MINUTES: 5,

  STORAGE_KEYS: {
    token: 'dapodik_checkpoint_token',
    user: 'dapodik_checkpoint_user',
    draftProgress: 'dapodik_checkpoint_draft_progress',
    uiState: 'dapodik_checkpoint_ui_state'
  }
};
