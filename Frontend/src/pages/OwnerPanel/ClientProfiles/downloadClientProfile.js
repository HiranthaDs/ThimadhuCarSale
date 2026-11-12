import { getFinalizedClientImage } from "../../../api/clients"
import brandLogo from "../../../assets/logo.png"
import { formatNumber } from "../../../utils/numberFormat"

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
    ? "—" : `LKR ${formatNumber(value, 2)}`
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

  const overrides = new Set((profile.custom_field_schema || []).map((field) => field.key))
  const original = (tab, label, value, instance) => overrides.has(`${tab}:${label}${instance ? `:${instance}` : ""}`) ? undefined : value
  if (profile.has_local_client) section("Local client", [
    ["Name", original("client_details", "Client Name", profile.local_client_name, "local")],
    ["Phone", original("client_details", "Phone Number", profile.local_client_phone, "local")],
    ["Documents", profile.local_client_document_types?.replaceAll(",", ", ")],
    ["NIC number", original("client_details", "NIC Number", profile.local_client_nic_number, "local")],
    ["Passport number", original("client_details", "Passport Number", profile.local_client_passport_number, "local")],
    ["Other document number", original("client_details", "Other document Number", profile.local_client_other_number, "local")],
  ].filter(([, value]) => value !== undefined))
  if (profile.has_foreign_client) section("Foreign client", [
    ["Name", original("client_details", "Client Name", profile.foreign_client_name, "foreign")],
    ["Country", original("client_details", "Country", profile.foreign_client_country)],
    ["Phone", original("client_details", "Phone Number", profile.foreign_client_phone, "foreign")],
    ["Documents", profile.foreign_client_document_types?.replaceAll(",", ", ")],
    ["NIC number", original("client_details", "NIC Number", profile.foreign_client_nic_number, "foreign")],
    ["Passport number", original("client_details", "Passport Number", profile.foreign_client_passport_number, "foreign")],
    ["Other document number", original("client_details", "Other document Number", profile.foreign_client_other_number, "foreign")],
  ].filter(([, value]) => value !== undefined))
  section("Vehicle and documents", [
    ["Vehicle type", original("document", "Type", profile.vehicle_type)],
    ["Vehicle number", original("document", "Vehicle Number", profile.vehicle_number)],
    ["Chassis number", original("document", "Chassis Number", profile.chassis_number)],
  ].filter(([, value]) => value !== undefined))
  section("Previous owner", [
    ["Name", original("previous_owner", "Previous Owner Name", profile.previous_owner_name)],
    ["NIC", original("previous_owner", "NIC", profile.previous_owner_nic)],
    ["Phone", original("previous_owner", "Phone Number", profile.previous_owner_phone)],
    ["Registration", original("previous_owner", "Registration Status", profile.registration_type === "open_book" ? "Open book" : profile.registration_type)],
    ["Third person involved", profile.third_person_involved],
    ...(profile.third_person_involved
      ? [
          ["Third person name", original("previous_owner", "Third Person Name", profile.third_person_name)],
          ["Third person phone", original("previous_owner", "Third Person Phone Number", profile.third_person_phone)],
        ]
      : []),
    ["Notes", original("previous_owner", "Others", profile.other_notes)],
    ["Inspection report 1", original("previous_owner", "Inspection Report 1", profile.scan_report_1_image ? "Linked in client profile" : null)],
    ["Inspection report 2", original("previous_owner", "Inspection Report 2", profile.scan_report_2_image ? "Linked in client profile" : null)],
  ].filter(([, value]) => value !== undefined))
  section("Department", [
    ["Marketing", original("department", "Marketing", profile.marketing_person_name)],
    ["Technical", original("department", "Technical", profile.technical_person_name)],
    ["Purchasing", original("department", "Purchasing", profile.purchasing_person_name)],
    ...(profile.extra_departments || []).map((item) => [item.department || "Other department", item.person_name]),
  ].filter(([, value]) => value !== undefined))
  section("Payment", [
    ["Leasing company", original("payment", "Leasing Company", profile.leasing_company)],
    ["Bank officer", original("payment", "Bank Officer Name", profile.bank_officer_name)],
    ["File signed", original("payment", "File Signed Date", dateText(profile.file_signed_date))],
    ["Payment date", original("payment", "Payment Date", dateText(profile.payment_date))],
    ["DO date", original("payment", "DO Date", dateText(profile.do_date))],
    ["Customer advance", original("payment", "Customer Advanced Date", dateText(profile.customer_advanced_date))],
    ["Vehicle handover", original("payment", "Vehicle Handover Date", dateText(profile.vehicle_handover_date))],
    ["Purchasing date", original("payment", "Purchasing Date", dateText(profile.purchasing_date))],
    ["Selling price", original("payment", "Selling Price", money(profile.selling_price))],
    ["Loan amount", original("payment", "Loan Amount", money(profile.loan_amount))],
    ["Customer down payment", original("payment", "Customer Down Payment", money(profile.customer_down_payment))],
  ].filter(([, value]) => value !== undefined))

  const tabNames = { client_details: "Client details", document: "Documents", previous_owner: "Previous owner", department: "Department", payment: "Payment" }
  for (const [tab, title] of Object.entries(tabNames)) {
    const fields = (profile.custom_field_schema || []).filter((field) => field.tab === tab && !["image", "multi_image", "file"].includes(field.type))
    if (fields.length) section(`${title} — additional fields`, fields.map((field) => [
      field.key.startsWith("client_details:") && /:(local|foreign)$/.test(field.key)
        ? `${field.key.endsWith(":local") ? "Local" : "Foreign"} · ${field.label}` : field.label,
      field.type === "number" ? formatNumber(profile.custom_fields?.[field.key]) : profile.custom_fields?.[field.key],
    ]))
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
  ["previous_owner_nic_image", "Previous owner · NIC"], ["previous_owner_selfie_image", "Previous owner · selfie"], ["in_writing_letter_image", "In-writing letter"],
  ["scan_report_1_upload", "Scan report 1 upload"], ["scan_report_2_upload", "Scan report 2 upload"],
  ["garage_bill_image", "Garage bill"], ["modification_image", "Modification"],
  ["third_person_image", "Third person document"],
]

function photoEntries(profile) {
  const replacedPhotos = {
    local_client_nic_image: "client_details:NIC Photo:local",
    local_client_passport_image: "client_details:Passport Photo:local",
    local_client_other_image: "client_details:Other document Photo:local",
    local_client_handover_selfie_image: "client_details:Handover Selfie:local",
    foreign_client_nic_image: "client_details:NIC Photo:foreign",
    foreign_client_passport_image: "client_details:Passport Photo:foreign",
    foreign_client_other_image: "client_details:Other document Photo:foreign",
    foreign_client_handover_selfie_image: "client_details:Handover Selfie:foreign",
    cr_document_image: "document:CR Document", revenue_license_image: "document:Revenue License",
    previous_owner_nic_image: "previous_owner:Previous Owner NIC Photo",
    previous_owner_selfie_image: "previous_owner:Detailed Selfie Photo",
    in_writing_letter_image: "previous_owner:In-Writing Letter",
    scan_report_1_upload: "previous_owner:Scan Report 1 (Upload)",
    scan_report_2_upload: "previous_owner:Scan Report 2 (Upload)",
    garage_bill_image: "previous_owner:Garage Bill", modification_image: "previous_owner:Modification",
    third_person_image: "previous_owner:Third Person Document",
  }
  const overrides = new Set((profile.custom_field_schema || []).map((field) => field.key))
  const fields = [...PHOTO_FIELDS.filter(([field]) => !overrides.has(replacedPhotos[field])), ...(profile.custom_field_schema || [])
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
