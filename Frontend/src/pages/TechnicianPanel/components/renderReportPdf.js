// Builds the report PDF one page at a time.
//
// html2pdf draws the whole report onto a single canvas and then slices it into
// pages, and browsers cap a canvas at about 65,000px tall (34 pages at our
// scale in Edge, far fewer on phones), so long reports came out blank or
// failed. Here the report is laid out once off-screen (same layout and page
// breaks as before, via paginateForPdf), then each page is drawn on its own
// small canvas. Only the photos on the page being drawn are loaded, so memory
// stays flat however many pages and photos the report has.
import { PDF_MARGIN, PDF_SCALE, imagesLoaded, paginateForPdf, pdfPageGeometry } from "./paginateReport"

const JPEG_QUALITY = 0.85
const BLANK_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

// The off-screen copy sits outside the app's themed containers, so CSS custom
// properties (var(--tp-navy) etc.) and the webfont stack are pinned here.
const PDF_CSS = `
  .ir-pdf-render { background: #fff; }
  .ir-pdf-render .ir-page, .ir-pdf-render .ir-page * {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  }
  .ir-pdf-render .ir-header { display: none !important; }
  .ir-pdf-render .ir-title { color: #141c2e !important; margin-top: 0 !important; }
  .ir-pdf-render .ir-section-title { color: #1a56db !important; }
  .ir-pdf-render .ir-table, .ir-pdf-render .ir-table th, .ir-pdf-render .ir-table td {
    border: 1px solid #c7cbd6 !important;
    border-collapse: collapse !important;
  }
  .ir-pdf-render .ir-table th { background: #fafafa !important; }
`

// Returns a jsPDF document with one image per page; the caller adds headers/footers.
export async function renderReportPdf(sourceEl, { onProgress } = {}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")])
  const { widthPx, pagePx } = pdfPageGeometry()

  const host = document.createElement("div")
  host.className = "ir-pdf-render"
  // Kept at the top-left of the page, behind everything (the report overlay
  // covers it), because html2canvas draws nothing for an element placed far off-screen.
  host.style.cssText = `position:absolute;top:0;left:0;z-index:-1;width:${widthPx}px;pointer-events:none;`
  const style = document.createElement("style")
  style.textContent = PDF_CSS
  const work = sourceEl.cloneNode(true)
  host.append(style, work)
  document.body.appendChild(host)

  try {
    if (document.fonts?.ready) await document.fonts.ready
    await imagesLoaded(work)
    paginateForPdf(host, pagePx)

    // Pin every photo's box, then note which page(s) it sits on, so photos can
    // be swapped for a blank placeholder (without moving anything) while other
    // pages are drawn.
    const origin = host.getBoundingClientRect().top
    const images = Array.from(work.querySelectorAll("img")).map((img) => {
      const r = img.getBoundingClientRect()
      img.style.width = `${r.width}px`
      img.style.height = `${r.height}px`
      return {
        img,
        src: img.currentSrc || img.src,
        first: Math.floor((r.top - origin) / pagePx),
        last: Math.floor((r.bottom - origin - 0.01) / pagePx),
      }
    })
    const pageCount = Math.max(1, Math.ceil((host.getBoundingClientRect().height - 0.5) / pagePx))

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
    const [marginTop, marginLeft] = PDF_MARGIN
    const imageWidthMm = pdf.internal.pageSize.getWidth() - PDF_MARGIN[1] - PDF_MARGIN[3]
    const imageHeightMm = imageWidthMm * (pagePx / widthPx)

    for (let page = 0; page < pageCount; page++) {
      onProgress?.(page + 1, pageCount)
      for (const entry of images) {
        const wanted = page >= entry.first && page <= entry.last ? entry.src : BLANK_IMAGE
        if (entry.img.getAttribute("src") !== wanted) entry.img.setAttribute("src", wanted)
      }
      await imagesLoaded(work)

      const canvas = await html2canvas(host, {
        scale: PDF_SCALE,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        // Offsets from the top-left of `host`: this page's slice of the report.
        x: 0,
        y: page * pagePx,
        width: widthPx,
        height: pagePx,
        // Clone only the off-screen report, not the whole app (and its own
        // copy of every photo), for each page.
        ignoreElements: (el) => el.parentElement === document.body && el !== host,
      })
      if (page > 0) pdf.addPage()
      pdf.addImage(canvas.toDataURL("image/jpeg", JPEG_QUALITY), "JPEG", marginLeft, marginTop, imageWidthMm, imageHeightMm)
      canvas.width = 0
      canvas.height = 0
    }
    return pdf
  } finally {
    host.remove()
  }
}
