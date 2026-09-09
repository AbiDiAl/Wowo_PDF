// js/modules/pdf-merger.js

if (!window.selectedPdfFiles) {
  window.selectedPdfFiles = [];
}

/**
 * Helper Fungsi Download Blob
 */
function downloadBlob(data, fileName, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Handle Add Multiple PDF Files
 */
async function handleMergeFiles(files) {
  if (!files || files.length === 0) return;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
      window.selectedPdfFiles.push(f);
    }
  }

  const mergeInput = document.getElementById('mergeFiles');
  if (mergeInput) mergeInput.value = '';

  updateFileListUI();
  await updateMergedPreview();
}

/**
 * Update UI Urutan PDF pada Sidebar Kanan
 */
function updateFileListUI() {
  const container = document.getElementById('rightSidebarOrder');
  if (!container) return;

  if (!window.selectedPdfFiles || window.selectedPdfFiles.length === 0) {
    container.innerHTML = `<p class="text-slate-400 italic text-[10px]">Belum ada file dipilih</p>`;
    return;
  }

  let html = '';
  window.selectedPdfFiles.forEach((file, index) => {
    html += `
      <div class="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-xs mb-1">
        <span class="truncate font-medium text-slate-700 w-36" title="${file.name}">
          ${index + 1}. ${file.name}
        </span>
        <div class="flex items-center space-x-1">
          <button onclick="moveFileOrder(${index}, -1)" class="px-1 text-slate-500 hover:text-slate-800 font-bold" ${index === 0 ? 'disabled style="opacity:0.3;"' : ''}>▲</button>
          <button onclick="moveFileOrder(${index}, 1)" class="px-1 text-slate-500 hover:text-slate-800 font-bold" ${index === window.selectedPdfFiles.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>▼</button>
          <button onclick="removePdfFile(${index})" class="px-1 text-red-400 hover:text-red-600 font-bold">✕</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

async function moveFileOrder(index, direction) {
  if (!window.selectedPdfFiles) return;
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= window.selectedPdfFiles.length) return;

  const temp = window.selectedPdfFiles[index];
  window.selectedPdfFiles[index] = window.selectedPdfFiles[newIndex];
  window.selectedPdfFiles[newIndex] = temp;

  updateFileListUI();
  await updateMergedPreview();
}

/**
 * Hapus PDF dari List & Update Preview
 */
async function removePdfFile(index) {
  if (!window.selectedPdfFiles) return;

  window.selectedPdfFiles.splice(index, 1);
  updateFileListUI();

  await updateMergedPreview();
}

/**
 * Render Ulang Gabungan PDF + BG & Tampilkan di Canvas
 */
async function updateMergedPreview() {
  // PAKSA CLEAR JIKA LIST PDF KOSONG
  if (!window.selectedPdfFiles || window.selectedPdfFiles.length === 0) {
    window.pdfDocBytes = null;
    window.pdfPagesCount = 0;
    window.currentPage = 1;

    // Direct DOM Clear untuk memastikan canvas terhapus seketika
    const zoomContainer = document.getElementById('zoomContainer');
    if (zoomContainer) {
      zoomContainer.innerHTML = `
        <div id="previewPlaceholder" class="m-auto text-xs text-slate-400 text-center animate-pulse py-12">
          Upload PDF & Gambar Background di panel kanan untuk melihat preview langsung
        </div>`;
    }

    if (typeof updatePageUI === 'function') {
      updatePageUI(1, 0);
    }

    if (typeof window.refreshEsignOverlayListeners === 'function') {
      window.refreshEsignOverlayListeners();
    }
    return;
  }

  try {
    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();

    let bgImageEmbed = null;

    if (window.bgImageFile) {
      try {
        const bgArrayBuffer = await window.bgImageFile.arrayBuffer();
        const isPng = window.bgImageFile.type === 'image/png' || window.bgImageFile.name.toLowerCase().endsWith('.png');

        if (isPng) {
          bgImageEmbed = await mergedPdf.embedPng(bgArrayBuffer);
        } else {
          bgImageEmbed = await mergedPdf.embedJpg(bgArrayBuffer);
        }
      } catch (bgErr) {
        console.warn("Gagal embed background image:", bgErr);
      }
    }

    for (const file of window.selectedPdfFiles) {
      const fileArrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(fileArrayBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

      for (const page of copiedPages) {
        const { width, height } = page.getSize();

        if (bgImageEmbed) {
          const newPage = mergedPdf.addPage([width, height]);

          newPage.drawImage(bgImageEmbed, {
            x: 0,
            y: 0,
            width: width,
            height: height,
          });

          const embeddedPageRef = await mergedPdf.embedPage(page);
          newPage.drawPage(embeddedPageRef, {
            x: 0,
            y: 0,
            width: width,
            height: height,
          });
        } else {
          mergedPdf.addPage(page);
        }
      }
    }

    const pdfBytes = await mergedPdf.save({ useObjectStreams: true });
    window.pdfDocBytes = pdfBytes;

    if (typeof window.applyZoomScale === 'function') {
      await window.applyZoomScale(window.currentZoom || 1.0);
    }

    if (typeof window.refreshEsignOverlayListeners === 'function') {
      window.refreshEsignOverlayListeners();
    }
  } catch (err) {
    console.error("Gagal menggabungkan PDF:", err);
  }
}

/**
 * Simpan & Unduh Dokumen
 */
async function processMergeAndBg() {
  if (!window.pdfDocBytes) {
    alert('Silakan upload minimal 1 file PDF terlebih dahulu.');
    return;
  }

  if (window.placedEsignElements && window.placedEsignElements.length > 0) {
    if (typeof window.processEsignDownload === 'function') {
      await window.processEsignDownload();
      return;
    }
  }

  const fileNameInput = document.getElementById('outputFileName');
  let fileName = fileNameInput ? fileNameInput.value.trim() : 'FLOMO_PDF_Document.pdf';
  if (!fileName.toLowerCase().endsWith('.pdf')) fileName += '.pdf';

  downloadBlob(window.pdfDocBytes, fileName, 'application/pdf');
}

window.downloadBlob = downloadBlob;
window.handleMergeFiles = handleMergeFiles;
window.moveFileOrder = moveFileOrder;
window.removePdfFile = removePdfFile;
window.updateMergedPreview = updateMergedPreview;
window.processMergeAndBg = processMergeAndBg;