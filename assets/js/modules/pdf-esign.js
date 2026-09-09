// js/modules/pdf-esign.js - Full Interactive E-Sign Overlay & Persistence

let esignAssets = [];
let placedEsignElements = [];
let selectedEsignId = null;

// Track status drag/resize/rotate
let isDragging = false;
let isResizing = false;
let isRotating = false;
let activeElement = null;
let startX = 0, startY = 0;
let startWidth = 0, startHeight = 0;
let startAngle = 0;

/**
 * Helper: Konversi Image DataURL / Src ke Clean PNG ArrayBuffer via Canvas
 * Menghapus background putih/terang agar E-Sign/stempel transparan murni dan tidak menutupi teks PDF
 */
function cleanImageToPngBuffer(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0);

      // Ambil data piksel gambar
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Ambang batas warna putih/dekat putih (RGB > 230)
      const threshold = 230;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Jika piksel berwarna putih atau mendekati putih, ubah alpha menjadi 0 (transparan)
        if (r > threshold && g > threshold && b > threshold) {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Gagal mengonversi gambar ke blob'));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      }, 'image/png');
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Handle Upload E-Sign (Persist ke IndexedDB + Render UI)
 */
function handleEsignUpload(inputSource, isRestoring = false) {
  let files = [];

  if (inputSource && inputSource.target && inputSource.target.files) {
    files = Array.from(inputSource.target.files);
  } else if (inputSource && inputSource.files) {
    files = Array.from(inputSource.files);
  } else if (inputSource instanceof FileList || Array.isArray(inputSource)) {
    files = Array.from(inputSource);
  }

  if (!files || files.length === 0) return;

  let loadedCount = 0;

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const asset = {
        id: 'esign-asset-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        name: file.name,
        type: file.type || 'image/png',
        src: e.target.result
      };
      
      esignAssets.push(asset);

      loadedCount++;
      if (loadedCount === files.length) {
        renderEsignAssetsUI();
        saveEsignAssetsToDB();
        
        const inputElem = document.getElementById('esignImgInput');
        if (inputElem) inputElem.value = '';
      }
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Render Daftar Aset E-Sign / Stempel pada Sidebar Kanan
 */
function renderEsignAssetsUI() {
  const container = document.getElementById('esignAssetsList');
  if (!container) return;

  if (!esignAssets || esignAssets.length === 0) {
    container.innerHTML = `<p class="text-rose-400 italic text-[10px]">Belum ada E-Sign/stempel diunggah</p>`;
    return;
  }

  let html = '';
  esignAssets.forEach((asset) => {
    html += `
      <div class="flex items-center justify-between p-2 bg-white border border-rose-200 rounded-lg shadow-sm hover:border-rose-300 transition group">
        <div class="flex items-center space-x-2.5 overflow-hidden">
          <div class="w-8 h-8 rounded border border-rose-200 bg-rose-50 flex items-center justify-center overflow-hidden shrink-0">
            <img src="${asset.src}" alt="${asset.name}" class="max-w-full max-h-full object-contain">
          </div>
          <span class="text-xs font-medium text-rose-900 truncate w-24" title="${asset.name}">${asset.name}</span>
        </div>
        <div class="flex items-center space-x-1">
          <button onclick="addEsignToCanvas('${asset.id}')" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded transition" title="Tambah ke Canvas">
            + Tempel
          </button>
          <button onclick="removeEsignAsset('${asset.id}')" class="p-1 text-rose-400 hover:text-red-500 transition font-bold text-xs" title="Hapus Aset">
            ✕
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Menempelkan E-Sign ke PDF Preview (Canvas Wrapper Halaman Aktif)
 */
function addEsignToCanvas(assetId, targetPage = null) {
  const asset = esignAssets.find(a => a.id === assetId);
  if (!asset) return;

  const pageNum = targetPage || (typeof window.currentPage !== 'undefined' && window.currentPage > 0 ? window.currentPage : 1);
  const wrapper = document.getElementById(`page-wrapper-${pageNum}`);
  
  if (!wrapper) {
    if (typeof showHeaderStatus === 'function') {
      showHeaderStatus('Upload file PDF terlebih dahulu untuk menempel E-Sign!', 'warning', 3000);
    } else {
      alert('Upload file PDF terlebih dahulu!');
    }
    return;
  }

  const elemId = 'esign-placed-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);

  const relativeWidth = 0.25; 
  const relativeHeight = 0.15;
  const relativeX = 0.375;
  const relativeY = 0.4;

  const placedObj = {
    id: elemId,
    assetId: assetId,
    src: asset.src,
    page: pageNum,
    relX: relativeX,
    relY: relativeY,
    relW: relativeWidth,
    relH: relativeHeight,
    rotation: 0
  };

  placedEsignElements.push(placedObj);
  
  window.placedEsignElements = placedEsignElements;

  renderPlacedEsign(placedObj, wrapper);
  selectEsignElement(elemId);

  if (typeof scrollToPage === 'function') {
    scrollToPage(pageNum);
  }
}

/**
 * Render DOM Overlay E-Sign ke dalam Page Wrapper
 */
function renderPlacedEsign(obj, wrapper) {
  const existingDom = document.getElementById(obj.id);
  if (existingDom) existingDom.remove();

  wrapper.style.position = 'relative';

  const wrapperWidth = wrapper.clientWidth || parseFloat(wrapper.style.width) || 300;
  const wrapperHeight = wrapper.clientHeight || parseFloat(wrapper.style.height) || 400;

  const currentX = obj.relX * wrapperWidth;
  const currentY = obj.relY * wrapperHeight;
  const currentW = obj.relW * wrapperWidth;
  const currentH = obj.relH * wrapperHeight;

  const esignBox = document.createElement('div');
  esignBox.id = obj.id;
  esignBox.className = `esign-box ${selectedEsignId === obj.id ? 'selected' : ''}`;
  esignBox.style.position = 'absolute';
  esignBox.style.left = `${currentX}px`;
  esignBox.style.top = `${currentY}px`;
  esignBox.style.width = `${currentW}px`;
  esignBox.style.height = `${currentH}px`;
  esignBox.style.transform = `rotate(${obj.rotation || 0}deg)`;
  esignBox.style.zIndex = '50';
  esignBox.style.cursor = 'move';
  esignBox.style.boxSizing = 'border-box';

  esignBox.innerHTML = `
    <img src="${obj.src}" alt="E-Sign" style="width:100%; height:100%; object-fit:contain; pointer-events:none; user-select:none;">
    <div class="esign-handle-rotate" title="Putar">🔄</div>
    <div class="esign-handle-resize" title="Ubah Ukuran">↘</div>
    <div class="esign-delete-btn" title="Hapus">✕</div>
  `;

  esignBox.addEventListener('mousedown', (e) => onEsignMouseDown(e, obj, wrapper));
  
  const deleteBtn = esignBox.querySelector('.esign-delete-btn');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deletePlacedEsign(obj.id);
  });

  wrapper.appendChild(esignBox);
}

/**
 * Tangani Aktivitas Mousedown (Drag, Resize, Rotate, Select)
 */
function onEsignMouseDown(e, obj, wrapper) {
  e.stopPropagation();
  selectEsignElement(obj.id);

  activeElement = obj;
  const domElem = document.getElementById(obj.id);
  if (!domElem) return;

  if (e.target.classList.contains('esign-handle-resize')) {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = domElem.offsetWidth;
    startHeight = domElem.offsetHeight;
  } else if (e.target.classList.contains('esign-handle-rotate')) {
    isRotating = true;
    const rect = domElem.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI) - (obj.rotation || 0);
  } else if (!e.target.classList.contains('esign-delete-btn')) {
    isDragging = true;
    const rect = domElem.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
  }

  document.addEventListener('mousemove', onEsignMouseMove);
  document.addEventListener('mouseup', onEsignMouseUp);
}

function onEsignMouseMove(e) {
  if (!activeElement) return;

  const domElem = document.getElementById(activeElement.id);
  if (!domElem) return;

  if (isDragging) {
    const currentWrapper = domElem.parentElement;
    const wrapperRect = currentWrapper.getBoundingClientRect();

    let newLeft = e.clientX - wrapperRect.left - startX;
    let newTop = e.clientY - wrapperRect.top - startY;

    domElem.style.left = `${newLeft}px`;
    domElem.style.top = `${newTop}px`;

    activeElement.relX = newLeft / currentWrapper.clientWidth;
    activeElement.relY = newTop / currentWrapper.clientHeight;
  } else if (isResizing) {
    const wrapper = domElem.parentElement;
    let newW = Math.max(30, startWidth + (e.clientX - startX));
    let newH = Math.max(30, startHeight + (e.clientY - startY));

    domElem.style.width = `${newW}px`;
    domElem.style.height = `${newH}px`;

    activeElement.relW = newW / wrapper.clientWidth;
    activeElement.relH = newH / wrapper.clientHeight;
  } else if (isRotating) {
    const rect = domElem.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI) - startAngle;

    angle = (angle % 360 + 360) % 360;

    domElem.style.transform = `rotate(${angle}deg)`;
    activeElement.rotation = angle;
  }
}

function onEsignMouseUp(e) {
  if (isDragging && activeElement) {
    const domElem = document.getElementById(activeElement.id);
    if (domElem && e) {
      const pageWrappers = document.querySelectorAll('.pdf-page-wrapper');
      let targetWrapper = null;

      pageWrappers.forEach(wrapper => {
        const rect = wrapper.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          targetWrapper = wrapper;
        }
      });

      if (targetWrapper && targetWrapper !== domElem.parentElement) {
        const newPageNum = parseInt(targetWrapper.dataset.pageNumber);
        const targetRect = targetWrapper.getBoundingClientRect();

        const newLeft = e.clientX - targetRect.left - startX;
        const newTop = e.clientY - targetRect.top - startY;

        activeElement.page = newPageNum;
        activeElement.relX = newLeft / targetWrapper.clientWidth;
        activeElement.relY = newTop / targetWrapper.clientHeight;

        renderPlacedEsign(activeElement, targetWrapper);
      }
    }
  }

  isDragging = false;
  isResizing = false;
  isRotating = false;
  activeElement = null;

  document.removeEventListener('mousemove', onEsignMouseMove);
  document.removeEventListener('mouseup', onEsignMouseUp);
}

function selectEsignElement(id) {
  selectedEsignId = id;
  document.querySelectorAll('.esign-box').forEach(el => {
    if (el.id === id) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });
}

function deletePlacedEsign(id) {
  placedEsignElements = placedEsignElements.filter(e => e.id !== id);
  window.placedEsignElements = placedEsignElements;

  const domElem = document.getElementById(id);
  if (domElem) domElem.remove();
  if (selectedEsignId === id) selectedEsignId = null;
}

/**
 * Merender Ulang Semua E-Sign yang Terpasang Saat Zoom/Page Di-refresh
 */
function refreshEsignOverlayListeners() {
  if (!placedEsignElements || placedEsignElements.length === 0) return;

  placedEsignElements.forEach(obj => {
    const wrapper = document.getElementById(`page-wrapper-${obj.page}`);
    if (wrapper) {
      renderPlacedEsign(obj, wrapper);
    }
  });
}

/**
 * Hapus Aset E-Sign
 */
function removeEsignAsset(id) {
  esignAssets = esignAssets.filter(a => a.id !== id);
  
  if (placedEsignElements && Array.isArray(placedEsignElements)) {
    const toDelete = placedEsignElements.filter(e => e.assetId === id);
    toDelete.forEach(e => deletePlacedEsign(e.id));
  }
  
  renderEsignAssetsUI();
  saveEsignAssetsToDB();
}

/**
 * Simpan Daftar Aset E-Sign ke IndexedDB
 */
async function saveEsignAssetsToDB() {
  if (!window.DBHelper) return;
  const serializedAssets = esignAssets.map(a => ({
    name: a.name,
    type: a.type,
    src: a.src
  }));
  await window.DBHelper.set('cached_esign_assets', serializedAssets);
}

/**
 * Load E-Sign Assets dari IndexedDB saat Startup
 */
async function restoreCachedEsignAssets() {
  if (!window.DBHelper) return;
  const cachedList = await window.DBHelper.get('cached_esign_assets');
  if (cachedList && Array.isArray(cachedList) && cachedList.length > 0) {
    esignAssets = cachedList.map(item => ({
      id: 'esign-asset-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      name: item.name,
      type: item.type,
      src: item.src
    }));
    renderEsignAssetsUI();
  }
}

/**
 * Proses Download PDF Beserta E-Sign (FIXED ASPECT RATIO, POSITIONING & CLEAN ALPHA)
 */
async function processEsignDownload() {
  if (!window.pdfDocBytes) {
    alert('Silakan upload file PDF terlebih dahulu.');
    return;
  }

  try {
    const { PDFDocument, degrees } = PDFLib;
    const pdfDoc = await PDFDocument.load(window.pdfDocBytes);
    const pages = pdfDoc.getPages();

    for (const obj of placedEsignElements) {
      const pageIndex = obj.page - 1;
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex];
        
        const pageRotationAngle = page.getRotation().angle || 0;
        const normalizedPageRot = (pageRotationAngle % 360 + 360) % 360;

        const rawWidth = page.getWidth();
        const rawHeight = page.getHeight();

        const isRotated90or270 = (normalizedPageRot === 90 || normalizedPageRot === 270);
        const visualWidth = isRotated90or270 ? rawHeight : rawWidth;
        const visualHeight = isRotated90or270 ? rawWidth : rawHeight;

        // Render ulang ke Canvas agar transparansi ter-normalize sempurna
        const cleanPngBuffer = await cleanImageToPngBuffer(obj.src);
        const embeddedImg = await pdfDoc.embedPng(cleanPngBuffer);

        // 1. Dapatkan Ukuran Asli Gambar (Intrinsic Size)
        const imgOriginalWidth = embeddedImg.width;
        const imgOriginalHeight = embeddedImg.height;
        const imgAspectRatio = imgOriginalWidth / imgOriginalHeight;

        // 2. Dapatkan Ukuran Box UI di PDF
        const boxW = obj.relW * visualWidth;
        const boxH = obj.relH * visualHeight;
        const boxAspectRatio = boxW / boxH;

        // 3. Hitung Ukuran Gambar yang Proporsional (Simulasi object-fit: contain)
        let elemVisualW, elemVisualH;
        if (imgAspectRatio > boxAspectRatio) {
          elemVisualW = boxW;
          elemVisualH = boxW / imgAspectRatio;
        } else {
          elemVisualH = boxH;
          elemVisualW = boxH * imgAspectRatio;
        }

        const userRotation = obj.rotation || 0;

        // 4. Tentukan Posisi Tengah (Center Alignment)
        const boxCenterX = (obj.relX * visualWidth) + (boxW / 2);
        const boxCenterY = visualHeight - ((obj.relY * visualHeight) + (boxH / 2));

        const rad = (-userRotation * Math.PI) / 180;

        const localX = -elemVisualW / 2;
        const localY = -elemVisualH / 2;

        const rotatedLocalX = localX * Math.cos(rad) - localY * Math.sin(rad);
        const rotatedLocalY = localX * Math.sin(rad) + localY * Math.cos(rad);

        let finalPdfX = boxCenterX + rotatedLocalX;
        let finalPdfY = boxCenterY + rotatedLocalY;
        let totalDrawRotation = -userRotation;

        if (normalizedPageRot === 90) {
          const tempX = finalPdfX;
          finalPdfX = finalPdfY;
          finalPdfY = rawHeight - tempX;
          totalDrawRotation += 90;
        } else if (normalizedPageRot === 180) {
          finalPdfX = rawWidth - finalPdfX;
          finalPdfY = rawHeight - finalPdfY;
          totalDrawRotation += 180;
        } else if (normalizedPageRot === 270) {
          const tempX = finalPdfX;
          finalPdfX = rawWidth - finalPdfY;
          finalPdfY = tempX;
          totalDrawRotation += 270;
        }

        page.drawImage(embeddedImg, {
          x: finalPdfX,
          y: finalPdfY,
          width: elemVisualW,
          height: elemVisualH,
          rotate: degrees(totalDrawRotation)
        });
      }
    }

    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    
    const fileNameInput = document.getElementById('outputFileName');
    let fileName = fileNameInput ? fileNameInput.value.trim() : 'FLOMO_PDF_Signed.pdf';
    if (!fileName.toLowerCase().endsWith('.pdf')) fileName += '.pdf';

    if (typeof window.downloadBlob === 'function') {
      window.downloadBlob(pdfBytes, fileName, 'application/pdf');
    }
  } catch (err) {
    console.error("Gagal menyimpan PDF dengan E-Sign:", err);
    alert('Gagal memproses E-Sign ke dalam PDF.');
  }
}

// Global Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
  if (selectedEsignId && (e.key === 'Delete' || e.key === 'Backspace')) {
    if (document.activeElement.tagName !== 'INPUT') {
      deletePlacedEsign(selectedEsignId);
    }
  }
});

// Deselect jika klik di luar
document.addEventListener('click', (e) => {
  if (!e.target.closest('.esign-box') && !e.target.closest('#controls-esign')) {
    selectEsignElement(null);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  restoreCachedEsignAssets();
});

// Bind Global Window
window.handleEsignUpload = handleEsignUpload;
window.removeEsignAsset = removeEsignAsset;
window.renderEsignAssetsUI = renderEsignAssetsUI;
window.addEsignToCanvas = addEsignToCanvas;
window.refreshEsignOverlayListeners = refreshEsignOverlayListeners;
window.processEsignDownload = processEsignDownload;
window.placedEsignElements = placedEsignElements;