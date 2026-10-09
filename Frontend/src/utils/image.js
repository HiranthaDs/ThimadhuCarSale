// Photos are shrunk in the browser before upload, so users can pick or shoot
// images of any size: a 12 MB phone photo becomes a ~200-500 KB JPEG that is
// still sharp on screen and in the PDF reports. The backend also caps image
// dimensions (core/media.py) as a safety net.
const MAX_IMAGE_SIDE = 1600
const TARGET_BYTES = 1024 * 1024
const QUALITIES = [0.85, 0.75, 0.65, 0.55]

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Approximate decoded size of a base64 data URL.
function dataUrlBytes(dataUrl) {
  return Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4)
}

// Draws any image source (an <img> or a <video> frame) onto a canvas no larger
// than MAX_IMAGE_SIDE and returns a JPEG data URL, lowering the quality until
// it fits TARGET_BYTES.
export function sourceToJpeg(source, width, height) {
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext("2d")
  // JPEG has no transparency: give transparent PNGs a white background, not black.
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  let result = ""
  for (const quality of QUALITIES) {
    result = canvas.toDataURL("image/jpeg", quality)
    if (dataUrlBytes(result) <= TARGET_BYTES) break
  }
  return result
}

export function compressImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const result = sourceToJpeg(img, img.naturalWidth, img.naturalHeight)
      URL.revokeObjectURL(url)
      resolve(result)
    }
    img.onerror = () => {
      // Not an image the browser can draw: send it as-is and let the backend decide.
      URL.revokeObjectURL(url)
      resolve(fileToDataUrl(file))
    }
    img.src = url
  })
}

// For inputs that take both PDFs and images: images are compressed, anything else is sent unchanged.
export function prepareUpload(file) {
  return file.type.startsWith("image/") ? compressImage(file) : fileToDataUrl(file)
}
