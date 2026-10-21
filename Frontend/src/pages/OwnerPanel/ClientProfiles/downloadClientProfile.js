import { getFinalizedClientImage } from "../../../api/clients"
import brandLogo from "../../../assets/logo.png"

const NAVY = [11, 27, 56]
const BLUE = [22, 119, 255]
const MUTED = [91, 111, 140]
const PALE = [234, 243, 255]
const PAGE_BOTTOM = 273

function splitImages(value) {
  if (!value || typeof value !== "string") return []
  if (value.startsWith("[")) {
    try {
      const images = JSON.parse(value)
      if (Array.isArray(images)) return images.filter(Boolean)
    } catch { /* Treat legacy values as one image. */ }
  }
  return [value]
}

function isPdf(value) {
  try { return new URL(value).pathname.toLowerCase().endsWith(".pdf") }
  catch { return false }
}

function display(value) {
  if (value === true) return "Yes"
  if (value === false) return "No"
  if (value === null || value === undefined || value === "") return "—"
  return String(value)
}

function dateText(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? display(value) : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function money(value) {
  return value === null || value === undefined || value === ""
    ? "—" : `LKR ${Number(value).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function loadPdfLogo() {
  const image = new Image()
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
    image.src = brandLogo
  })
  // The source artwork has generous dark margins. Crop those margins so the
  // mark remains legible in the compact header on every page.
  const canvas = document.createElement("canvas")
  canvas.width = 660
  canvas.height = 360
  const context = canvas.getContext("2d")
  context.fillStyle = "#000000"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, image.naturalWidth * .04, image.naturalHeight * .27,
    image.naturalWidth * .92, image.naturalHeight * .54, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", .9)
}

function makePages(pdf, profile, logoDataUrl) {
  let page = 0
  let y = 43
  const pageWidth = pdf.internal.pageSize.getWidth()

  function addPage() {
    if (page) pdf.addPage()
    page += 1
    pdf.setFillColor(0, 0, 0)
    pdf.rect(0, 0, pageWidth, 30, "F")
    pdf.setFillColor(0, 0, 0)
    pdf.roundedRect(15, 3, 39, 24, 2, 2, "F")
    pdf.addImage(logoDataUrl, "JPEG", 17, 4, 35, 22)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(16)
    pdf.setTextColor(255, 255, 255)
    pdf.text("Thimadu Auto Trading", 59, 14)
    pdf.setFontSize(8.5)
    pdf.setFont("helvetica", "normal")
    pdf.text("FINALIZED CLIENT PROFILE", 59, 20)
    pdf.setDrawColor(214, 227, 245)
    pdf.line(16, 280, pageWidth - 16, 280)
    y = 43
  }

  function ensure(height) {
    if (y + height > PAGE_BOTTOM) addPage()
  }

  function heading(title) {
    ensure(18)
    pdf.setFillColor(...PALE)
    pdf.roundedRect(16, y, pageWidth - 32, 10, 2, 2, "F")
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10.5)
    pdf.setTextColor(...NAVY)
    pdf.text(title.toUpperCase(), 20, y + 6.7)
    y += 15
  }

  function row(label, value) {
    pdf.setFontSize(8.8)
    const labelLines = pdf.splitTextToSize(label, 54)
    const lines = pdf.splitTextToSize(display(value), 110)
    let offset = 0
    do {
      const caption = offset ? ["(continued)"] : labelLines
      if (y + Math.max(9, caption.length * 5 + 4) > PAGE_BOTTOM) addPage()
      const availableLines = Math.max(1, Math.floor((PAGE_BOTTOM - y - 4) / 5))
      const part = lines.slice(offset, offset + availableLines)
      const height = Math.max(9, Math.max(caption.length, part.length) * 5 + 4)
      pdf.setFillColor(248, 251, 255)
      pdf.rect(16, y, pageWidth - 32, height, "F")
      pdf.setDrawColor(225, 235, 248)
      pdf.line(16, y + height, pageWidth - 16, y + height)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8.8)
      pdf.setTextColor(...MUTED)
      pdf.text(caption, 20, y + 6)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(...NAVY)
      pdf.text(part, 80, y + 6)
      y += height
      offset += part.length
      if (offset < lines.length) addPage()
    } while (offset < lines.length)
  }

  function section(title, fields) {
    heading(title)
    for (const [label, value] of fields) row(label, value)
    y += 7
  }

  addPage()
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(19)
  pdf.setTextColor(...NAVY)
  pdf.text("Finalized Client Profile", 16, y)
  y += 7
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  pdf.setTextColor(...MUTED)
  pdf.text(`Profile ID  ${profile.id}     •     Created ${dateText(profile.created_at)}`, 16, y)
  y += 11
  pdf.setFillColor(233, 248, 240)
  pdf.roundedRect(16, y, pageWidth - 32, 12, 3, 3, "F")
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(20, 115, 69)
  pdf.text("FINAL APPROVAL COMPLETE", 21, y + 8)
  y += 19

  if (profile.has_local_client) section("Local client", [
    ["Name", profile.local_client_name], ["Phone", profile.local_client_phone],
    ["Documents", profile.local_client_document_types?.replaceAll(",", ", ")],
    ["NIC number", profile.local_client_nic_number], ["Passport number", profile.local_client_passport_number],
    ["Other document number", profile.local_client_other_number],
  ])
  if (profile.has_foreign_client) section("Foreign client", [
    ["Name", profile.foreign_client_name], ["Country", profile.foreign_client_country],
    ["Phone", profile.foreign_client_phone], ["Documents", profile.foreign_client_document_types?.replaceAll(",", ", ")],
    ["NIC number", profile.foreign_client_nic_number], ["Passport number", profile.foreign_client_passport_number],
    ["Other document number", profile.foreign_client_other_number],
  ])
  section("Vehicle and documents", [
    ["Vehicle type", profile.vehicle_type], ["Vehicle number", profile.vehicle_number],
    ["Chassis number", profile.chassis_number],
  ])
  section("Previous owner", [
    ["Name", profile.previous_owner_name], ["NIC", profile.previous_owner_nic],
    ["Phone", profile.previous_owner_phone],
    ["Registration", profile.registration_type === "open_book" ? "Open book" : profile.registration_type],
    ["Third person involved", profile.third_person_involved], ["Notes", profile.other_notes],
    ["Inspection report 1", profile.scan_report_1_image ? "Linked in client profile" : null],
    ["Inspection report 2", profile.scan_report_2_image ? "Linked in client profile" : null],
  ])
  section("Department", [
    ["Marketing", profile.marketing_person_name], ["Technical", profile.technical_person_name],
    ["Purchasing", profile.purchasing_person_name],
    ...(profile.extra_departments || []).map((item) => [item.department || "Other department", item.person_name]),
  ])
  section("Payment", [
    ["Leasing company", profile.leasing_company], ["Bank officer", profile.bank_officer_name],
    ["File signed", dateText(profile.file_signed_date)], ["Payment date", dateText(profile.payment_date)],
    ["DO date", dateText(profile.do_date)], ["Customer advance", dateText(profile.customer_advanced_date)],
    ["Vehicle handover", dateText(profile.vehicle_handover_date)], ["Purchasing date", dateText(profile.purchasing_date)],
    ["Selling price", money(profile.selling_price)], ["Loan amount", money(profile.loan_amount)],
    ["Customer down payment", money(profile.customer_down_payment)],
  ])

  const tabNames = { client_details: "Client details", document: "Documents", previous_owner: "Previous owner", department: "Department", payment: "Payment" }
  for (const [tab, title] of Object.entries(tabNames)) {
    const fields = (profile.custom_field_schema || []).filter((field) => field.tab === tab && !["image", "multi_image", "file"].includes(field.type))
    if (fields.length) section(`${title} — additional fields`, fields.map((field) => [field.label, profile.custom_fields?.[field.key]]))
  }

  const approvals = profile.role_approvals || []
  section("Approval record", approvals.map((item) => [item.role === "owner" ? "Owner · final" : (item.role || "Approver").replaceAll("_", " "),
    `${item.name || "Approved"}${item.at ? ` · ${dateText(item.at)}` : ""}`]))
  if (!approvals.some((item) => item.role === "owner")) row("Owner · final", "Approved — recorded before approval names were stored")

  return { addPage, heading, row, getY: () => y, setY: (next) => { y = next }, pageWidth }
}

const PHOTO_FIELDS = [
  ["local_client_nic_image", "Local client · NIC"], ["local_client_passport_image", "Local client · passport"],
  ["local_client_other_image", "Local client · other document"], ["local_client_handover_selfie_image", "Local client · handover selfie"],
  ["foreign_client_nic_image", "Foreign client · NIC"], ["foreign_client_passport_image", "Foreign client · passport"],
  ["foreign_client_other_image", "Foreign client · other document"], ["foreign_client_handover_selfie_image", "Foreign client · handover selfie"],
  ["cr_document_image", "CR document"], ["revenue_license_image", "Revenue license"],
  ["previous_owner_selfie_image", "Previous owner · selfie"], ["in_writing_letter_image", "In-writing letter"],
  ["scan_report_1_upload", "Scan report 1 upload"], ["scan_report_2_upload", "Scan report 2 upload"],
  ["garage_bill_image", "Garage bill"], ["modification_image", "Modification"],
  ["third_person_image", "Third person document"], ["handover_selfie_image", "Handover selfie"],
]

function photoEntries(profile) {
  const fields = [...PHOTO_FIELDS, ...(profile.custom_field_schema || [])
    .filter((field) => ["image", "multi_image", "file"].includes(field.type))
    .map((field) => [field.key, field.label])]
  return fields.flatMap(([field, label]) => splitImages(profile[field] ?? profile.custom_fields?.[field])
    .map((source, index, all) => ({ field, label, index, count: all.length, pdf: isPdf(source) })))
}

export async function downloadClientProfilePdf(profile, onProgress) {
  if (profile.status !== "approved") throw new Error("The client profile is not finalized yet.")
  const { jsPDF } = await import("jspdf")
  const logoDataUrl = await loadPdfLogo()
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true })
  pdf.setProperties({ title: `Finalized Client Profile · ${profile.vehicle_number || profile.local_client_name || profile.foreign_client_name || profile.id}`,
    subject: "Approved client profile", author: "Thimadu Auto Trading" })
  const page = makePages(pdf, profile, logoDataUrl)
  const attachments = photoEntries(profile)
  if (attachments.length) {
    page.heading("Attachment index")
    for (const entry of attachments) page.row(`${entry.label} ${entry.count > 1 ? `(${entry.index + 1}/${entry.count})` : ""}`,
      entry.pdf ? "PDF uploaded in client profile" : "Image included on following pages")
  }

  const imageEntries = attachments.filter((entry) => !entry.pdf)
  for (let i = 0; i < imageEntries.length; i++) {
    const entry = imageEntries[i]
    onProgress?.(`Adding photo ${i + 1} of ${imageEntries.length}…`)
    const blob = await getFinalizedClientImage(profile.id, entry.field, entry.index)
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    page.addPage()
    page.heading(`${entry.label}${entry.count > 1 ? ` · ${entry.index + 1} of ${entry.count}` : ""}`)
    const properties = pdf.getImageProperties(dataUrl)
    const maxWidth = 176
    const maxHeight = 210
    const scale = Math.min(maxWidth / properties.width, maxHeight / properties.height)
    const width = properties.width * scale
    const height = properties.height * scale
    pdf.addImage(dataUrl, "JPEG", (page.pageWidth - width) / 2, page.getY() + 3, width, height)
  }

  const totalPages = pdf.internal.getNumberOfPages()
  for (let number = 1; number <= totalPages; number++) {
    pdf.setPage(number)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.setTextColor(...MUTED)
    pdf.text("Approved client profile · Generated from the current approved record", 16, 286)
    pdf.text(`${number} / ${totalPages}`, page.pageWidth - 16, 286, { align: "right" })
  }
  const name = (profile.vehicle_number || profile.local_client_name || profile.foreign_client_name || "client-profile")
    .replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60)
  pdf.save(`${name || "client-profile"}-finalized.pdf`)
}
