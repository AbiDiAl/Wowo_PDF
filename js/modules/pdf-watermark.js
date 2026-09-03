// js/modules/pdf-watermark.js

window.bgImageFile = null;

/**
 * Restore Background File dari IndexedDB saat aplikasi pertama dimuat
 */
async function restoreCachedBg() {
  if (!window.DBHelper) return;
  const cachedData = await window.DBHelper.get('cached_bg_image');
  
  if (cachedData && cachedData.file) {
    // Re-construct File object
    const file = new File([cachedData.file], cachedData.name, { type: cachedData.type });
    window.bgImageFile = file;

    const bgWrapper = document.getElementById('bgStatusWrapper');
    const bgDisplay = document.getElementById('bgFileDisplay');

    if (bgWrapper && bgDisplay) {
      bgDisplay.innerText = `🖼️ ${file.name}`;
      bgWrapper.classList.remove('hidden');
    }
  }
}

/**
 * Handle Upload Gambar Background
 */
async function handleBgFile(file, isRestoring = false) {
  if (!file) return;

  window.bgImageFile = file;

  const bgWrapper = document.getElementById('bgStatusWrapper');
  const bgDisplay = document.getElementById('bgFileDisplay');

  if (bgWrapper && bgDisplay) {
    bgDisplay.innerText = `🖼️ ${file.name}`;
    bgWrapper.classList.remove('hidden');
  }

  // Simpan ke IndexedDB (Jika bukan hasil restoring otomatis)
  if (!isRestoring && window.DBHelper) {
    window.DBHelper.set('cached_bg_image', {
      name: file.name,
      type: file.type,
      file: file
    });
  }

  // Hanya jalankan render jika ada file PDF yang aktif
  if (window.selectedPdfFiles && window.selectedPdfFiles.length > 0) {
    if (typeof updateMergedPreview === 'function') {
      await updateMergedPreview();
    }
  } else {
    // Jika belum ada PDF, tetap bersihkan viewer agar tidak menampilkan cache PDF lama
    window.pdfDocBytes = null;
    if (typeof window.applyZoomScale === 'function') {
      await window.applyZoomScale(window.currentZoom || 1.0);
    }
  }
}

/**
 * Hapus Gambar Background
 */
async function removeBgFile() {
  window.bgImageFile = null;

  // Hapus dari IndexedDB
  if (window.DBHelper) {
    await window.DBHelper.remove('cached_bg_image');
  }

  const bgInput = document.getElementById('bgFile');
  if (bgInput) bgInput.value = '';

  const bgWrapper = document.getElementById('bgStatusWrapper');
  if (bgWrapper) bgWrapper.classList.add('hidden');

  if (window.selectedPdfFiles && window.selectedPdfFiles.length > 0) {
    if (typeof updateMergedPreview === 'function') {
      await updateMergedPreview();
    }
  } else {
    window.pdfDocBytes = null;
    if (typeof window.applyZoomScale === 'function') {
      await window.applyZoomScale(window.currentZoom || 1.0);
    }
  }
}

// Restore BG otomatis saat modul siap
document.addEventListener('DOMContentLoaded', () => {
  restoreCachedBg();
});

window.handleBgFile = handleBgFile;
window.removeBgFile = removeBgFile;