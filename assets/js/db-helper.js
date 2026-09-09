// js/db-helper.js - IndexedDB Store for Wowo_PDF

const DB_NAME = 'WowoPDF_DB';
const DB_VERSION = 1;
const STORE_NAME = 'app_assets';

/**
 * Inisialisasi Database
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Simpan File/Data ke IndexedDB
 */
async function setStoredItem(key, data) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, key);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error(`Gagal menyimpan ${key} ke IndexedDB:`, err);
  }
}

/**
 * Ambil File/Data dari IndexedDB
 */
async function getStoredItem(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error(`Gagal mengambil ${key} dari IndexedDB:`, err);
    return null;
  }
}

/**
 * Hapus Data dari IndexedDB
 */
async function removeStoredItem(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error(`Gagal menghapus ${key} dari IndexedDB:`, err);
  }
}

// Export Helper ke Window Global
window.DBHelper = {
  set: setStoredItem,
  get: getStoredItem,
  remove: removeStoredItem
};