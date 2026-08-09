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
  API_URL: 'https://script.google.com/macros/s/AKfycbxgmdoQ9Q6ADQuXvwksvP6rvUIgqsf_G0QzIPN4FrNxoK16H7QBMTlzsS6Yh08LFf0Z/exec',

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