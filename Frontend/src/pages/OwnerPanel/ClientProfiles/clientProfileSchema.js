export const initialFormState = {
  has_local_client: true,
  local_client_name: "",
  local_client_phone: "",
  local_client_document_type: "none",
  local_client_document_image: "",

  has_foreign_client: false,
  foreign_client_name: "",
  foreign_client_country: "",
  foreign_client_phone: "",
  foreign_client_document_type: "none",
  foreign_client_document_image: "",

  cr_document_image: "",
  revenue_license_image: "",
  vehicle_type: "",
  chassis_number: "",
  vehicle_number: "",

  previous_owner_nic: "",
  previous_owner_selfie_image: "",
  in_writing_letter_image: "",
  registration_type: "registered",
  previous_owner_phone: "",
  scan_report_1_image: "",
  scan_report_2_image: "",
  garage_bill_image: "",
  modification_image: "",
  other_notes: "",
  third_person_involved: false,
  third_person_image: "",
  handover_selfie_image: "",

  department: "marketing",
  department_person_name: "",

  leasing_company: "",
  file_signed_date: "",
  payment_date: "",
  bank_officer_name: "",
  do_date: "",
  customer_advanced_date: "",
  vehicle_handover_date: "",
  purchasing_date: "",
  selling_price: "",
  loan_amount: "",
  customer_down_payment: "",
}

export const TABS = [
  { key: "client_details", label: "Client Details" },
  { key: "document", label: "Document Details" },
  { key: "previous_owner", label: "Previous Owner" },
  { key: "department", label: "Department" },
  { key: "payment", label: "Payment Details" },
]

export function validateClientTypes() {
  return ""
}

export function buildSubmitPayload(form) {
  const toNumberOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v))
  const toDateOrNull = (v) => (v ? v : null)
  const toTextOrNull = (v) => (v === "" ? null : v)

  return {
    ...form,

    local_client_name: form.has_local_client ? toTextOrNull(form.local_client_name) : null,
    local_client_phone: form.has_local_client ? toTextOrNull(form.local_client_phone) : null,
    local_client_document_type: form.has_local_client ? form.local_client_document_type : "none",
    local_client_document_image: form.has_local_client ? toTextOrNull(form.local_client_document_image) : null,

    foreign_client_name: form.has_foreign_client ? toTextOrNull(form.foreign_client_name) : null,
    foreign_client_country: form.has_foreign_client ? toTextOrNull(form.foreign_client_country) : null,
    foreign_client_phone: form.has_foreign_client ? toTextOrNull(form.foreign_client_phone) : null,
    foreign_client_document_type: form.has_foreign_client ? form.foreign_client_document_type : "none",
    foreign_client_document_image: form.has_foreign_client ? toTextOrNull(form.foreign_client_document_image) : null,

    cr_document_image: toTextOrNull(form.cr_document_image),
    revenue_license_image: toTextOrNull(form.revenue_license_image),
    vehicle_type: toTextOrNull(form.vehicle_type),
    chassis_number: toTextOrNull(form.chassis_number),
    vehicle_number: toTextOrNull(form.vehicle_number),

    previous_owner_nic: toTextOrNull(form.previous_owner_nic),
    previous_owner_selfie_image: toTextOrNull(form.previous_owner_selfie_image),
    in_writing_letter_image: toTextOrNull(form.in_writing_letter_image),
    previous_owner_phone: toTextOrNull(form.previous_owner_phone),
    scan_report_1_image: toTextOrNull(form.scan_report_1_image),
    scan_report_2_image: toTextOrNull(form.scan_report_2_image),
    garage_bill_image: toTextOrNull(form.garage_bill_image),
    modification_image: toTextOrNull(form.modification_image),
    other_notes: toTextOrNull(form.other_notes),
    third_person_image: form.third_person_involved ? toTextOrNull(form.third_person_image) : null,
    handover_selfie_image: form.third_person_involved ? toTextOrNull(form.handover_selfie_image) : null,

    department_person_name: toTextOrNull(form.department_person_name),

    leasing_company: toTextOrNull(form.leasing_company),
    file_signed_date: toDateOrNull(form.file_signed_date),
    payment_date: toDateOrNull(form.payment_date),
    bank_officer_name: toTextOrNull(form.bank_officer_name),
    do_date: toDateOrNull(form.do_date),
    customer_advanced_date: toDateOrNull(form.customer_advanced_date),
    vehicle_handover_date: toDateOrNull(form.vehicle_handover_date),
    purchasing_date: toDateOrNull(form.purchasing_date),
    selling_price: toNumberOrNull(form.selling_price),
    loan_amount: toNumberOrNull(form.loan_amount),
    customer_down_payment: toNumberOrNull(form.customer_down_payment),
  }
}
