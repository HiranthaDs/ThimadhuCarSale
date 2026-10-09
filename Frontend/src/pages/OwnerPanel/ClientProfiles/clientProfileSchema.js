export const initialFormState = {
  has_local_client: true,
  local_client_name: "",
  local_client_phone: "",
  local_client_document_types: [],
  local_client_nic_number: "",
  local_client_nic_image: "",
  local_client_passport_number: "",
  local_client_passport_image: "",
  local_client_other_number: "",
  local_client_other_image: "",
  local_client_handover_selfie_image: "",

  has_foreign_client: false,
  foreign_client_name: "",
  foreign_client_country: "",
  foreign_client_phone: "",
  foreign_client_document_types: [],
  foreign_client_nic_number: "",
  foreign_client_nic_image: "",
  foreign_client_passport_number: "",
  foreign_client_passport_image: "",
  foreign_client_other_number: "",
  foreign_client_other_image: "",
  foreign_client_handover_selfie_image: "",

  cr_document_image: "",
  revenue_license_image: "",
  vehicle_type: "",
  chassis_number: "",
  vehicle_number: "",

  previous_owner_name: "",
  previous_owner_nic: "",
  previous_owner_selfie_image: "",
  in_writing_letter_image: "",
  registration_type: "registered",
  previous_owner_phone: "",
  scan_report_1_image: "",
  scan_report_2_image: "",
  scan_report_1_upload: "",
  scan_report_2_upload: "",
  garage_bill_image: "",
  modification_image: "",
  other_notes: "",
  third_person_involved: false,
  third_person_image: "",
  handover_selfie_image: "",

  marketing_person_name: "",
  technical_person_name: "",
  purchasing_person_name: "",
  extra_departments: [],

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

export function mapProfileToForm(profile) {
  const toTypesArray = (v) => (v ? String(v).split(",").filter(Boolean) : [])
  const toInputValue = (v) => (v === null || v === undefined ? "" : v)
  const toDateInput = (v) => (v ? String(v).slice(0, 10) : "")

  return {
    ...initialFormState,
    ...profile,
    local_client_name: toInputValue(profile.local_client_name),
    local_client_phone: toInputValue(profile.local_client_phone),
    local_client_document_types: toTypesArray(profile.local_client_document_types),
    local_client_nic_number: toInputValue(profile.local_client_nic_number),
    local_client_nic_image: toInputValue(profile.local_client_nic_image),
    local_client_passport_number: toInputValue(profile.local_client_passport_number),
    local_client_passport_image: toInputValue(profile.local_client_passport_image),
    local_client_other_number: toInputValue(profile.local_client_other_number),
    local_client_other_image: toInputValue(profile.local_client_other_image),
    local_client_handover_selfie_image: toInputValue(profile.local_client_handover_selfie_image),

    foreign_client_name: toInputValue(profile.foreign_client_name),
    foreign_client_country: toInputValue(profile.foreign_client_country),
    foreign_client_phone: toInputValue(profile.foreign_client_phone),
    foreign_client_document_types: toTypesArray(profile.foreign_client_document_types),
    foreign_client_nic_number: toInputValue(profile.foreign_client_nic_number),
    foreign_client_nic_image: toInputValue(profile.foreign_client_nic_image),
    foreign_client_passport_number: toInputValue(profile.foreign_client_passport_number),
    foreign_client_passport_image: toInputValue(profile.foreign_client_passport_image),
    foreign_client_other_number: toInputValue(profile.foreign_client_other_number),
    foreign_client_other_image: toInputValue(profile.foreign_client_other_image),
    foreign_client_handover_selfie_image: toInputValue(profile.foreign_client_handover_selfie_image),

    cr_document_image: toInputValue(profile.cr_document_image),
    revenue_license_image: toInputValue(profile.revenue_license_image),
    vehicle_type: toInputValue(profile.vehicle_type),
    chassis_number: toInputValue(profile.chassis_number),
    vehicle_number: toInputValue(profile.vehicle_number),

    previous_owner_name: toInputValue(profile.previous_owner_name),
    previous_owner_nic: toInputValue(profile.previous_owner_nic),
    previous_owner_selfie_image: toInputValue(profile.previous_owner_selfie_image),
    in_writing_letter_image: toInputValue(profile.in_writing_letter_image),
    registration_type: profile.registration_type || "registered",
    previous_owner_phone: toInputValue(profile.previous_owner_phone),
    scan_report_1_image: toInputValue(profile.scan_report_1_image),
    scan_report_2_image: toInputValue(profile.scan_report_2_image),
    scan_report_1_upload: toInputValue(profile.scan_report_1_upload),
    scan_report_2_upload: toInputValue(profile.scan_report_2_upload),
    garage_bill_image: toInputValue(profile.garage_bill_image),
    modification_image: toInputValue(profile.modification_image),
    other_notes: toInputValue(profile.other_notes),
    third_person_involved: Boolean(profile.third_person_involved),
    third_person_image: toInputValue(profile.third_person_image),
    handover_selfie_image: toInputValue(profile.handover_selfie_image),

    marketing_person_name: toInputValue(profile.marketing_person_name),
    technical_person_name: toInputValue(profile.technical_person_name),
    purchasing_person_name: toInputValue(profile.purchasing_person_name),
    extra_departments: Array.isArray(profile.extra_departments) ? profile.extra_departments : [],

    leasing_company: toInputValue(profile.leasing_company),
    file_signed_date: toDateInput(profile.file_signed_date),
    payment_date: toDateInput(profile.payment_date),
    bank_officer_name: toInputValue(profile.bank_officer_name),
    do_date: toDateInput(profile.do_date),
    customer_advanced_date: toDateInput(profile.customer_advanced_date),
    vehicle_handover_date: toDateInput(profile.vehicle_handover_date),
    purchasing_date: toDateInput(profile.purchasing_date),
    selling_price: toInputValue(profile.selling_price),
    loan_amount: toInputValue(profile.loan_amount),
    customer_down_payment: toInputValue(profile.customer_down_payment),
  }
}

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
    local_client_document_types: form.has_local_client ? form.local_client_document_types.join(",") : null,
    local_client_nic_number: form.has_local_client && form.local_client_document_types.includes("nic") ? toTextOrNull(form.local_client_nic_number) : null,
    local_client_nic_image: form.has_local_client && form.local_client_document_types.includes("nic") ? toTextOrNull(form.local_client_nic_image) : null,
    local_client_passport_number: form.has_local_client && form.local_client_document_types.includes("passport") ? toTextOrNull(form.local_client_passport_number) : null,
    local_client_passport_image: form.has_local_client && form.local_client_document_types.includes("passport") ? toTextOrNull(form.local_client_passport_image) : null,
    local_client_other_number: form.has_local_client && form.local_client_document_types.includes("other") ? toTextOrNull(form.local_client_other_number) : null,
    local_client_other_image: form.has_local_client && form.local_client_document_types.includes("other") ? toTextOrNull(form.local_client_other_image) : null,
    local_client_handover_selfie_image: form.has_local_client ? toTextOrNull(form.local_client_handover_selfie_image) : null,

    foreign_client_name: form.has_foreign_client ? toTextOrNull(form.foreign_client_name) : null,
    foreign_client_country: form.has_foreign_client ? toTextOrNull(form.foreign_client_country) : null,
    foreign_client_phone: form.has_foreign_client ? toTextOrNull(form.foreign_client_phone) : null,
    foreign_client_document_types: form.has_foreign_client ? form.foreign_client_document_types.join(",") : null,
    foreign_client_nic_number: form.has_foreign_client && form.foreign_client_document_types.includes("nic") ? toTextOrNull(form.foreign_client_nic_number) : null,
    foreign_client_nic_image: form.has_foreign_client && form.foreign_client_document_types.includes("nic") ? toTextOrNull(form.foreign_client_nic_image) : null,
    foreign_client_passport_number: form.has_foreign_client && form.foreign_client_document_types.includes("passport") ? toTextOrNull(form.foreign_client_passport_number) : null,
    foreign_client_passport_image: form.has_foreign_client && form.foreign_client_document_types.includes("passport") ? toTextOrNull(form.foreign_client_passport_image) : null,
    foreign_client_other_number: form.has_foreign_client && form.foreign_client_document_types.includes("other") ? toTextOrNull(form.foreign_client_other_number) : null,
    foreign_client_other_image: form.has_foreign_client && form.foreign_client_document_types.includes("other") ? toTextOrNull(form.foreign_client_other_image) : null,
    foreign_client_handover_selfie_image: form.has_foreign_client ? toTextOrNull(form.foreign_client_handover_selfie_image) : null,

    cr_document_image: toTextOrNull(form.cr_document_image),
    revenue_license_image: toTextOrNull(form.revenue_license_image),
    vehicle_type: toTextOrNull(form.vehicle_type),
    chassis_number: toTextOrNull(form.chassis_number),
    vehicle_number: toTextOrNull(form.vehicle_number),

    previous_owner_name: toTextOrNull(form.previous_owner_name),
    previous_owner_nic: toTextOrNull(form.previous_owner_nic),
    previous_owner_selfie_image: toTextOrNull(form.previous_owner_selfie_image),
    in_writing_letter_image: toTextOrNull(form.in_writing_letter_image),
    previous_owner_phone: toTextOrNull(form.previous_owner_phone),
    scan_report_1_image: toTextOrNull(form.scan_report_1_image),
    scan_report_2_image: toTextOrNull(form.scan_report_2_image),
    scan_report_1_upload: toTextOrNull(form.scan_report_1_upload),
    scan_report_2_upload: toTextOrNull(form.scan_report_2_upload),
    garage_bill_image: toTextOrNull(form.garage_bill_image),
    modification_image: toTextOrNull(form.modification_image),
    other_notes: toTextOrNull(form.other_notes),
    third_person_image: form.third_person_involved ? toTextOrNull(form.third_person_image) : null,
    handover_selfie_image: form.third_person_involved ? toTextOrNull(form.handover_selfie_image) : null,

    marketing_person_name: toTextOrNull(form.marketing_person_name),
    technical_person_name: toTextOrNull(form.technical_person_name),
    purchasing_person_name: toTextOrNull(form.purchasing_person_name),
    extra_departments: form.extra_departments
      .map((d) => ({ department: d.department.trim(), person_name: d.person_name.trim() }))
      .filter((d) => d.department),

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
