// js/app.js - Rose Pink (Online) & Slate Gray (Offline) Theme Controller

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

window.pdfDocBytes = null;
window.pdfPagesCount = 0;
window.currentPage = 1;
window.currentZoom = 1.0;
let isRendering = false;
let currentRenderTask = null;

window.addEventListener('DOMContentLoaded', () => {
  updateNetworkStatusUI();
  setupScrollListener();
});

window.addEventListener('online', () => {
  updateNetworkStatusUI();
  if (typeof showHeaderStatus === 'function') {
    showHeaderStatus('Koneksi terhubung kembali - Mode Online Rose Pink', 'info', 2500);
  }
});

window.addEventListener('offline', () => {
  updateNetworkStatusUI();
  if (typeof showHeaderStatus === 'function') {
    showHeaderStatus('Mode Offline Aktif - Tampilan Berubah Abu-abu (Slate)', 'warning', 3000);
  }
});

function updateNetworkStatusUI() {
  const track = document.getElementById('statusToggleTrack');
  const circle = document.getElementById('statusToggleCircle');
  const text = document.getElementById('statusToggleText');
  const appContainer = document.getElementById('appContainer');

  if (!track || !circle || !text) return;

  if (navigator.onLine) {
    // Mode ONLINE: Dominan Rose Pink
    track.className = 'w-9 h-5 bg-rose-500 rounded-full p-0.5 flex items-center cursor-default';
    circle.className = 'w-3.5 h-3.5 bg-white rounded-full shadow-md transform translate-x-4';
    text.innerText = 'Online Mode';
    text.className = 'text-[11px] font-semibold text-rose-700 select-none';

    if (appContainer) appContainer.classList.remove('offline-theme');
    document.body.classList.remove('offline-mode');
  } else {
    // Mode OFFLINE: Dominan Abu-Abu (Slate Gray)
    track.className = 'w-9 h-5 bg-slate-400 rounded-full p-0.5 flex items-center cursor-default';
    circle.className = 'w-3.5 h-3.5 bg-white rounded-full shadow-md transform translate-x-0';
    text.innerText = 'Offline Mode';
    text.className = 'text-[11px] font-semibold text-slate-600 select-none';

    if (appContainer) appContainer.classList.add('offline-theme');
    document.body.classList.add('offline-mode');
  }

  // Smooth Animation
  setTimeout(() => {
    track.classList.add('transition-colors', 'duration-300', 'ease-in-out');
    circle.classList.add('transition-transform', 'duration-300', 'ease-in-out');
    track.classList.remove('no-init-transition');
    circle.classList.remove('no-init-transition');
  }, 100);
}

/**
 * Render PDF dengan Zoom & Penataan Wrapper Presisi
 */
window.applyZoomScale = async function(zoomLevel) {
  const zoom = zoomLevel || window.currentZoom || 1.0;
  window.currentZoom = zoom;

  const zoomContainer = document.getElementById('zoomContainer');

  if (currentRenderTask) {
    try {
      await currentRenderTask.destroy();
    } catch (e) {}
    currentRenderTask = null;
  }

  if (!window.pdfDocBytes || (window.selectedPdfFiles && window.selectedPdfFiles.length === 0)) {
    isRendering = false;
    window.pdfPagesCount = 0;
    window.currentPage = 1;

    if (zoomContainer) {
      zoomContainer.innerHTML = `
        <div id="previewPlaceholder" class="m-auto text-xs text-rose-400 text-center animate-pulse py-12">
          Upload PDF & Gambar Background di panel kanan untuk melihat preview langsung
        </div>`;
    }

    if (typeof updatePageUI === 'function') updatePageUI(1, 0);
    return;
  }

  if (isRendering) return;
  isRendering = true;

  if (!zoomContainer) {
    isRendering = false;
    return;
  }

  if (typeof showHeaderStatus === 'function') {
    showHeaderStatus('Memuat & merender preview PDF...', 'loading', 0);
  }

  try {
    zoomContainer.innerHTML = '';

    currentRenderTask = pdfjsLib.getDocument({ data: window.pdfDocBytes.slice(0) });
    const pdf = await currentRenderTask.promise;

    window.pdfPagesCount = pdf.numPages;
    const totalPages = pdf.numPages;

    const baseScale = 1.1;
    const finalScale = baseScale * zoom;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (!window.selectedPdfFiles || window.selectedPdfFiles.length === 0) {
        zoomContainer.innerHTML = `
          <div id="previewPlaceholder" class="m-auto text-xs text-rose-400 text-center animate-pulse py-12">
            Upload PDF & Gambar Background di panel kanan untuk melihat preview langsung
          </div>`;
        if (typeof updatePageUI === 'function') updatePageUI(1, 0);
        break;
      }

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: finalScale });
      const baseViewport = page.getViewport({ scale: baseScale });

      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdf-page-wrapper relative mb-6 shadow-lg rounded bg-white shrink-0 mx-auto';
      pageWrapper.id = `page-wrapper-${pageNum}`;
      pageWrapper.dataset.pageNumber = pageNum;
      pageWrapper.dataset.baseWidth = baseViewport.width;
      pageWrapper.dataset.baseHeight = baseViewport.height;

      pageWrapper.style.width = `${Math.floor(viewport.width)}px`;
      pageWrapper.style.height = `${Math.floor(viewport.height)}px`;

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      pageWrapper.appendChild(canvas);
      zoomContainer.appendChild(pageWrapper);

      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport: viewport }).promise;
    }

    if (typeof window.refreshEsignOverlayListeners === 'function') {
      window.refreshEsignOverlayListeners();
    }

    if (typeof updatePageUI === 'function') {
      updatePageUI(window.currentPage || 1, totalPages);
    }

    if (typeof showHeaderStatus === 'function') {
      showHeaderStatus('Dokumen siap diproses', 'success', 2000);
    }

  } catch (err) {
    if (err && err.name !== 'RenderingCancelledException') {
      console.error("Gagal merender PDF:", err);
      if (typeof showHeaderStatus === 'function') {
        showHeaderStatus('Gagal memuat pratinjau PDF', 'error', 3500);
      }
    }
  } finally {
    isRendering = false;
    currentRenderTask = null;
  }
};

window.scrollToPage = function(pageNum) {
  const wrapper = document.getElementById(`page-wrapper-${pageNum}`);
  const viewport = document.getElementById('previewViewport');

  if (wrapper && viewport) {
    const topPos = wrapper.offsetTop - viewport.offsetTop - 10;
    viewport.scrollTo({ top: topPos, behavior: 'smooth' });
  }
};

function setupScrollListener() {
  const viewport = document.getElementById('previewViewport');
  if (!viewport) return;

  viewport.addEventListener('scroll', () => {
    if (window.isProgrammaticScroll) return;

    const pageWrappers = document.querySelectorAll('.pdf-page-wrapper');
    if (!pageWrappers.length) return;

    let currentVisiblePage = 1;
    const viewportTop = viewport.scrollTop + viewport.offsetTop;

    pageWrappers.forEach((wrapper) => {
      const wrapperTop = wrapper.offsetTop;
      const wrapperHeight = wrapper.offsetHeight;

      if (wrapperTop <= viewportTop + 150 && wrapperTop + wrapperHeight > viewportTop) {
        currentVisiblePage = parseInt(wrapper.dataset.pageNumber);
      }
    });

    if (window.currentPage !== currentVisiblePage) {
      window.currentPage = currentVisiblePage;
      const inputPage = document.getElementById('pageJumpInput');
      if (inputPage) inputPage.value = currentVisiblePage;
    }
  });
}

function downloadBlob(bytes, filename, type) {
  try {
    const blob = new Blob([bytes], { type: type });
    const link = document.createElement('a');
    const blobUrl = URL.createObjectURL(blob);
    
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

    if (typeof showHeaderStatus === 'function') {
      showHeaderStatus('File PDF berhasil diunduh!', 'success', 3500);
    }
  } catch (err) {
    console.error("Gagal mengunduh file:", err);
    if (typeof showHeaderStatus === 'function') {
      showHeaderStatus('Gagal mengunduh file PDF', 'error', 4000);
    }
  }
}