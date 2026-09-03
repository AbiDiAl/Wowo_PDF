// js/ui.js - Navigation Jump, Zoom Debounce, Dynamic Header Status & RGB Custom Theme

let activeTab = 'watermark';

window.currentPage = 1;
window.totalPages = 0;
window.currentZoom = 1.0;
window.isProgrammaticScroll = false; // Flag penahan listener scroll

window.addEventListener('DOMContentLoaded', () => {
  updateCustomTheme();
});

function switchTab(tabName) {
  activeTab = tabName;

  const watermarkCtrl = document.getElementById('controls-watermark');
  const esignCtrl = document.getElementById('controls-esign');
  const tabWatermarkBtn = document.getElementById('tab-watermark');
  const tabEsignBtn = document.getElementById('tab-esign');

  if (tabName === 'watermark') {
    if (watermarkCtrl) watermarkCtrl.classList.remove('hidden');
    if (esignCtrl) esignCtrl.classList.add('hidden');
    
    if (tabWatermarkBtn) {
      tabWatermarkBtn.classList.add('active-tab');
    }
    if (tabEsignBtn) {
      tabEsignBtn.classList.remove('active-tab');
    }
  } else if (tabName === 'esign') {
    if (watermarkCtrl) watermarkCtrl.classList.add('hidden');
    if (esignCtrl) esignCtrl.classList.remove('hidden');
    
    if (tabWatermarkBtn) {
      tabWatermarkBtn.classList.remove('active-tab');
    }
    if (tabEsignBtn) {
      tabEsignBtn.classList.add('active-tab');
    }
  }

  window.dispatchEvent(new CustomEvent('tabChanged', { detail: { tab: tabName } }));

  if (tabName === 'esign' && typeof window.refreshEsignOverlayListeners === 'function') {
    window.refreshEsignOverlayListeners();
  }
}

/**
 * Mengontrol status disabled/enabled tombol navigasi dan zoom
 */
function toggleControlsState(hasPdf) {
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');
  const inputPage = document.getElementById('pageJumpInput');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const zoomLabel = document.getElementById('zoomLabel');

  if (hasPdf) {
    if (btnPrev) btnPrev.disabled = false;
    if (btnNext) btnNext.disabled = false;
    if (inputPage) inputPage.disabled = false;
    if (btnZoomOut) btnZoomOut.disabled = false;
    if (btnZoomIn) btnZoomIn.disabled = false;

    if (zoomLabel) {
      zoomLabel.classList.remove('text-rose-300', 'text-slate-400');
      zoomLabel.classList.add('text-rose-700');
    }
  } else {
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    if (inputPage) inputPage.disabled = true;
    if (btnZoomOut) btnZoomOut.disabled = true;
    if (btnZoomIn) btnZoomIn.disabled = true;

    if (zoomLabel) {
      zoomLabel.classList.remove('text-rose-700');
      zoomLabel.classList.add('text-rose-300');
    }
  }
}

function updatePageUI(current, total) {
  window.currentPage = parseInt(current) || 1;
  if (total !== undefined && total !== null) window.totalPages = parseInt(total) || 0;

  const inputPage = document.getElementById('pageJumpInput');
  const totalLabel = document.getElementById('totalPagesLabel');

  const hasPdf = window.totalPages > 0;
  toggleControlsState(hasPdf);

  if (inputPage && !window.isProgrammaticScroll) {
    inputPage.value = hasPdf ? window.currentPage : 1;
    inputPage.max = hasPdf ? window.totalPages : 1;
  }

  if (totalLabel) {
    totalLabel.innerText = `/ ${window.totalPages}`;
  }
}

function changePageNav(delta) {
  if (window.totalPages <= 0) return;

  let targetPage = window.currentPage + delta;
  if (targetPage >= 1 && targetPage <= window.totalPages) {
    jumpToPage(targetPage);
  }
}

function jumpToPage(pageVal) {
  let pageNum = parseInt(pageVal);
  if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
  if (window.totalPages > 0 && pageNum > window.totalPages) pageNum = window.totalPages;

  window.currentPage = pageNum;
  
  const inputPage = document.getElementById('pageJumpInput');
  if (inputPage) inputPage.value = pageNum;

  window.isProgrammaticScroll = true;

  if (typeof scrollToPage === 'function') {
    scrollToPage(pageNum);
  }

  setTimeout(() => {
    window.isProgrammaticScroll = false;
  }, 400);
}

let zoomDebounceTimer = null;
function adjustZoom(delta) {
  if (window.totalPages <= 0) return;

  let newZoom = Math.round((window.currentZoom + delta) * 10) / 10;

  if (newZoom < 0.5) newZoom = 0.5;
  if (newZoom > 3.0) newZoom = 3.0;

  if (window.currentZoom === newZoom) return;
  window.currentZoom = newZoom;

  const zoomLabel = document.getElementById('zoomLabel');
  if (zoomLabel) {
    zoomLabel.innerText = `${Math.round(newZoom * 100)}%`;
  }

  clearTimeout(zoomDebounceTimer);
  zoomDebounceTimer = setTimeout(() => {
    if (typeof window.applyZoomScale === 'function') {
      window.applyZoomScale(newZoom);
    }
  }, 100);
}

// ==========================================================================
// DYNAMIC HEADER NOTIFICATION HELPER
// ==========================================================================
let statusBannerTimer = null;

function showHeaderStatus(message, type = 'info', autoHideMs = 3000) {
  const banner = document.getElementById('headerStatusBanner');
  const text = document.getElementById('headerStatusText');
  const icon = document.getElementById('headerStatusIcon');
  const spinner = document.getElementById('headerStatusSpinner');

  if (!banner || !text) return;

  clearTimeout(statusBannerTimer);

  const config = {
    info: { icon: 'ℹ️', border: 'border-blue-200', text: 'text-blue-700', bg: 'bg-blue-50/90' },
    success: { icon: '✨', border: 'border-emerald-300', text: 'text-emerald-700', bg: 'bg-emerald-50/90' },
    warning: { icon: '⚠️', border: 'border-amber-300', text: 'text-amber-700', bg: 'bg-amber-50/90' },
    error: { icon: '💥', border: 'border-rose-300', text: 'text-rose-700', bg: 'bg-rose-50/90' },
    loading: { icon: '', border: 'border-teal-300', text: 'text-slate-800', bg: 'bg-white/95' }
  };

  const currentConfig = config[type] || config.info;

  banner.classList.remove('hidden');
  
  requestAnimationFrame(() => {
    banner.className = `flex items-center gap-2.5 px-4 py-1.5 rounded-full border shadow-sm backdrop-blur-md transition-all duration-300 ease-out transform translate-y-0 opacity-100 ${currentConfig.bg} ${currentConfig.border}`;
  });

  text.className = `text-xs font-bold tracking-wide ${currentConfig.text}`;
  text.innerText = message;

  if (type === 'loading') {
    if (spinner) spinner.classList.remove('hidden');
    if (icon) icon.classList.add('hidden');
  } else {
    if (spinner) spinner.classList.add('hidden');
    if (icon) {
      icon.classList.remove('hidden');
      icon.innerText = currentConfig.icon;
    }
  }

  if (autoHideMs > 0) {
    statusBannerTimer = setTimeout(() => {
      hideHeaderStatus();
    }, autoHideMs);
  }
}

function hideHeaderStatus() {
  const banner = document.getElementById('headerStatusBanner');
  if (banner) {
    banner.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => {
      banner.classList.add('hidden');
    }, 300);
  }
}

// ==========================================================================
// DYNAMIC RGB CUSTOM THEME HELPER
// ==========================================================================
function updateCustomTheme() {
  const rInput = document.getElementById('rgbR');
  const gInput = document.getElementById('rgbG');
  const bInput = document.getElementById('rgbB');

  if (!rInput || !gInput || !bInput) return;

  const r = rInput.value;
  const g = gInput.value;
  const b = bInput.value;

  const valR = document.getElementById('valR');
  const valG = document.getElementById('valG');
  const valB = document.getElementById('valB');
  const hexDisplay = document.getElementById('rgbHexDisplay');

  if (valR) valR.innerText = r;
  if (valG) valG.innerText = g;
  if (valB) valB.innerText = b;

  const hexR = parseInt(r).toString(16).padStart(2, '0').toUpperCase();
  const hexG = parseInt(g).toString(16).padStart(2, '0').toUpperCase();
  const hexB = parseInt(b).toString(16).padStart(2, '0').toUpperCase();

  if (hexDisplay) hexDisplay.innerText = `#${hexR}${hexG}${hexB}`;

  const rgbColor = `rgb(${r}, ${g}, ${b})`;
  document.documentElement.style.setProperty('--primary-theme-rgb', rgbColor);
}