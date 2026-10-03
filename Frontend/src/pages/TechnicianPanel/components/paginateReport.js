// Page layout for the report PDF.
//
// html2pdf's own page-break handling inserts padding <div>s before the
// "avoid" elements; inside a <table> those render as empty bordered gaps and
// it cannot keep a row, photo or title whole. So the PDF export turns that off
// and calls paginateForPdf() instead, on the exact DOM html2canvas is about to
// draw: every row / paragraph / title that would straddle a page boundary is
// moved, whole, to the top of the next page (tables are split between rows,
// and a long photo row is split between lines of photos).

const PAGE_TOP_INSET = 4 // px of air under the header line on a fresh page
const PAGE_BOTTOM_SLACK = 3 // px kept free at the bottom of a page
const CELL_PADDING = 10 // td padding + border below a row's last photo line

export const PDF_SCALE = 2
// jsPDF A4 portrait minus the margins html2pdf is given, in mm: [top, left, bottom, right].
export const PDF_MARGIN = [30, 10, 16, 10]
const A4 = { width: 210, height: 297 }

// Container width (integer css px) and page height (css px) matching how
// html2pdf slices the canvas: pages are floor(canvasWidth * ratio) canvas px tall.
export function pdfPageGeometry() {
  const innerWidth = A4.width - PDF_MARGIN[1] - PDF_MARGIN[3]
  const innerHeight = A4.height - PDF_MARGIN[0] - PDF_MARGIN[2]
  const widthPx = Math.round((innerWidth * 96) / 25.4)
  const pagePx = Math.floor(widthPx * PDF_SCALE * (innerHeight / innerWidth)) / PDF_SCALE
  return { widthPx, pagePx }
}

const ATOMS = ".ir-section-title, .ir-table tr, .ir-legal, .ir-footer"

export function paginateForPdf(root, pageH) {
  const doc = root.ownerDocument
  const usable = pageH - PAGE_TOP_INSET - PAGE_BOTTOM_SLACK

  const measure = (el) => {
    const r = el.getBoundingClientRect()
    const origin = root.getBoundingClientRect().top
    return { top: r.top - origin, bottom: r.bottom - origin, height: r.height }
  }
  const pageOf = (y) => Math.floor((y + 0.01) / pageH)
  const limitOf = (page) => (page + 1) * pageH - PAGE_BOTTOM_SLACK
  const startOf = (page) => page * pageH + PAGE_TOP_INSET

  // Insert a spacer before `el` so that it starts at `target` (re-measured,
  // because the spacer changes how neighbouring margins collapse).
  function pushTo(el, target) {
    const spacer = doc.createElement("div")
    spacer.className = "ir-pagebreak"
    spacer.style.cssText = "height:0;margin:0;padding:0;border:0;"
    // The element's own top margin would otherwise collapse with the margin
    // above it, so the spacer alone could not place it exactly.
    el.style.marginTop = "0"
    el.parentNode.insertBefore(spacer, el)
    let height = 0
    for (let i = 0; i < 4; i++) {
      const diff = target - measure(el).top
      if (Math.abs(diff) < 0.5) break
      height = Math.max(0, height + diff)
      spacer.style.height = `${height}px`
    }
  }

  function pushRow(tr, target) {
    const tbody = tr.parentNode
    const table = tbody.parentNode
    if (tr === tbody.firstElementChild) {
      // Nothing above it in this table: move the table (and its title) instead.
      const prev = table.previousElementSibling
      pushTo(prev && prev.classList.contains("ir-section-title") ? prev : table, target)
      return
    }
    const newTable = table.cloneNode(false)
    const newBody = tbody.cloneNode(false)
    let node = tr
    while (node) {
      const next = node.nextElementSibling
      newBody.appendChild(node)
      node = next
    }
    newTable.appendChild(newBody)
    table.parentNode.insertBefore(newTable, table.nextSibling)
    pushTo(newTable, target)
  }

  // Lines of photos in a multi-photo row, as [{ imgs, bottom }]; null if not one.
  function photoLines(tr) {
    const grid = tr.querySelector && tr.querySelector(".ir-photo-grid")
    if (!grid) return null
    const lines = []
    Array.from(grid.children).forEach((img) => {
      const m = measure(img)
      const line = lines.find((l) => Math.abs(l.top - m.top) < 3)
      if (line) {
        line.imgs.push(img)
        line.bottom = Math.max(line.bottom, m.bottom)
      } else {
        lines.push({ imgs: [img], top: m.top, bottom: m.bottom })
      }
    })
    return lines
  }

  // Keep the first `keep` lines in `tr`; move the rest to a new row below it.
  function splitPhotoRow(tr, lines, keep) {
    const th = tr.querySelector("th")
    const td = tr.querySelector("td")
    const grid = td.querySelector(".ir-photo-grid")
    const tail = tr.cloneNode(false)
    const tailTh = th.cloneNode(false)
    tailTh.textContent = `${th.textContent} (continued)`
    const tailTd = td.cloneNode(false)
    const tailGrid = grid.cloneNode(false)
    lines.slice(keep).forEach((l) => l.imgs.forEach((img) => tailGrid.appendChild(img)))
    tailTd.appendChild(tailGrid)
    tail.appendChild(tailTh)
    tail.appendChild(tailTd)
    tr.parentNode.insertBefore(tail, tr.nextSibling)
    return tail
  }

  const atoms = Array.from(root.querySelectorAll(ATOMS))
  for (let i = 0; i < atoms.length; i++) {
    const el = atoms[i]
    const m = measure(el)
    const page = pageOf(m.top)
    const limit = limitOf(page)

    if (el.classList.contains("ir-section-title")) {
      // A title must not be left alone at the bottom of a page: it needs room
      // for the first row (or the first line of photos) that follows it.
      const next = atoms[i + 1]
      let needBottom = m.bottom
      if (next) {
        const lines = photoLines(next)
        needBottom = lines && lines.length > 1 ? lines[0].bottom + CELL_PADDING : measure(next).bottom
      }
      if (needBottom > limit && needBottom - m.top <= usable) pushTo(el, startOf(page + 1))
      continue
    }

    if (m.bottom <= limit) continue

    if (el.tagName === "TR") {
      const lines = photoLines(el)
      if (lines && lines.length > 1) {
        const fit = lines.filter((l) => l.bottom + CELL_PADDING <= limit).length
        if (fit >= 1 && fit < lines.length) {
          atoms.splice(i + 1, 0, splitPhotoRow(el, lines, fit))
          i-- // re-check the shortened row, then the new tail row
          continue
        }
      }
    }

    if (m.height > usable) continue // taller than a page: nothing to gain by moving it
    if (el.tagName === "TR") pushRow(el, startOf(page + 1))
    else pushTo(el, startOf(page + 1))
  }
}

// Resolve once every <img> under `root` has loaded (or failed), so measured
// heights are final.
export function imagesLoaded(root) {
  return Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
      img.complete && img.naturalWidth > 0
        ? null
        : new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true })
            img.addEventListener("error", resolve, { once: true })
          })
    )
  )
}
