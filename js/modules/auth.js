// js/modules/auth.js - Authentication & Auto-Logout Session Management (7-Day Midnight Expire)

const AUTH_KEY = 'wowo_pdf_auth_session';
const DEFAULT_PASS = 'sayasukambg';

/**
 * Menghitung timestamp 7 hari ke depan tepat pukul 00:00:00 (Tengah Malam)
 */
function get7DaysMidnightTimestamp() {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + 7);
  targetDate.setHours(0, 0, 0, 0); // Reset jam, menit, detik ke 00:00:00
  return targetDate.getTime();
}

/**
 * Memeriksa apakah sesi pengguna masih valid
 */
function isAuthenticated() {
  const sessionData = localStorage.getItem(AUTH_KEY);
  if (!sessionData) return false;

  try {
    const { token, expiry } = JSON.parse(sessionData);
    const now = Date.now();

    if (token === 'AUTH_GRANTED' && now < expiry) {
      return true;
    } else {
      // Sesi sudah kadaluwarsa (lewat dari 7 hari / 00:00)
      logoutUser();
      return false;
    }
  } catch (e) {
    logoutUser();
    return false;
  }
}

/**
 * Memverifikasi input password pengguna
 */
function loginUser(password) {
  if (password === DEFAULT_PASS) {
    const expiryTimestamp = get7DaysMidnightTimestamp();
    const sessionObj = {
      token: 'AUTH_GRANTED',
      expiry: expiryTimestamp
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(sessionObj));
    return { success: true };
  } else {
    return { success: false, message: 'Password salah! Silakan coba lagi.' };
  }
}

/**
 * Menghapus sesi login
 */
function logoutUser() {
  localStorage.removeItem(AUTH_KEY);
}

/**
 * Menampilkan / Mengatur Tampilan Layar Authentication dengan Transisi Halus
 */
function checkAuthAndRenderUI() {
  const authModal = document.getElementById('authModal');
  const appContainer = document.getElementById('appContainer');
  const isAuth = isAuthenticated();

  if (isAuth) {
    document.documentElement.classList.add('is-authenticated');

    if (authModal && !authModal.classList.contains('hidden')) {
      // Hilangkan blur awal sebelum transisi berjalan
      if (appContainer) {
        appContainer.classList.remove('pointer-events-none', 'blur-sm');
        appContainer.classList.add('app-unlock-enter');
        setTimeout(() => {
          appContainer.classList.remove('app-unlock-enter');
        }, 600);
      }

      // Animasi exit pada modal
      authModal.classList.add('auth-modal-exit');
      setTimeout(() => {
        authModal.classList.add('hidden');
        authModal.classList.remove('auth-modal-exit');
      }, 400);
    } else {
      if (appContainer) {
        appContainer.classList.remove('pointer-events-none', 'blur-sm');
      }
    }
  } else {
    document.documentElement.classList.remove('is-authenticated');
    if (authModal) {
      authModal.classList.remove('hidden', 'auth-modal-exit');
    }
    if (appContainer) {
      appContainer.classList.add('pointer-events-none', 'blur-sm');
    }
    setTimeout(() => {
      const passInput = document.getElementById('authPasswordInput');
      if (passInput) passInput.focus();
    }, 100);
  }
}

// Eksekusi pemeriksaan langsung secara parsial sebelum siklus render penuh untuk mencegah flicker
(function applyImmediateAuthCheck() {
  try {
    const sessionData = localStorage.getItem(AUTH_KEY);
    if (sessionData) {
      const { token, expiry } = JSON.parse(sessionData);
      if (token === 'AUTH_GRANTED' && Date.now() < expiry) {
        document.documentElement.classList.add('is-authenticated');
      }
    }
  } catch (e) {}
})();

// Export ke Window Global
window.AuthModule = {
  check: checkAuthAndRenderUI,
  login: loginUser,
  logout: logoutUser,
  isAuthenticated: isAuthenticated
};