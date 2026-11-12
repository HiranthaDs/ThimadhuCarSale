// Labels shared by the profile editor and the fixed creation form. A label used
// twice within a step (for local and foreign clients) is edited once.
export const BUILTIN_FIELDS = {
  client_details: [
    ["Local Client", "Checkbox"], ["Client Name", "Text"], ["Phone Number", "Text"],
    ["Identification Document", "Checkbox group"], ["NIC", "Checkbox"],
    ["Passport", "Checkbox"], ["Other document", "Checkbox"], ["No document", "Checkbox"],
    ["NIC Number", "Text"], ["NIC Photo", "Multiple images"],
    ["Passport Number", "Text"], ["Passport Photo", "Multiple images"],
    ["Other document Number", "Text"], ["Other document Photo", "Multiple images"],
    ["Handover Selfie", "Image upload"], ["Foreign Client", "Checkbox"],
    ["Country", "Searchable selection"],
  ],
  document: [
    ["CR Document", "Multiple images"], ["Revenue License", "Multiple images"],
    ["Type", "Text"], ["Chassis Number", "Text"], ["Vehicle Number", "Text"],
  ],
  previous_owner: [
    ["Previous Owner Name", "Text"], ["NIC", "Text"], ["Phone Number", "Text"],
    ["Registration Status", "Radio buttons"], ["Detailed Selfie Photo", "Image upload"],
    ["In-Writing Letter", "Image upload"], ["Inspection Report 1", "Searchable selection"],
    ["Inspection Report 2", "Searchable selection"], ["Scan Report 1 (Upload)", "PDF or image upload"],
    ["Scan Report 2 (Upload)", "PDF or image upload"], ["Garage Bill", "Multiple images"],
    ["Modification", "Multiple images"], ["Others", "Multiline text"],
    ["Third Person Involved?", "Radio buttons"], ["Third Person Name", "Text"],
    ["Third Person Phone Number", "Text"],
    ["Third Person Document", "Image upload"],
    ["Handover Selfie", "Multiple images"],
  ],
  department: [
    ["Marketing", "Text"], ["Technical", "Text"], ["Purchasing", "Text"],
    ["Department", "Text"], ["Person's Name", "Text"],
  ],
  payment: [
    ["Leasing Company", "Text"], ["Bank Officer Name", "Text"],
    ["File Signed Date", "Date picker"], ["Payment Date", "Date picker"],
    ["DO Date", "Date picker"], ["Customer Advanced Date", "Date picker"],
    ["Vehicle Handover Date", "Date picker"], ["Purchasing Date", "Date picker"],
    ["Selling Price", "Number"], ["Loan Amount", "Number"],
    ["Customer Down Payment", "Number"],
  ],
}

export const builtinKey = (tab, label) => `${tab}:${label}`

const CLIENT_SHARED_ANSWERS = [
  "Client Name", "Phone Number", "NIC Number", "NIC Photo",
  "Passport Number", "Passport Photo", "Other document Number",
  "Other document Photo", "Handover Selfie",
]

// Placement keys match the places where the creation form renders fields.
export function builtinPlacementOptions(tab, labels = {}) {
  const option = (label, instance) => {
    const base = builtinKey(tab, label)
    return { key: instance ? `${base}:${instance}` : base,
      label: `${instance === "local" ? "Local · " : instance === "foreign" ? "Foreign · " : ""}${labels[base] || label}` }
  }
  if (tab === "client_details") return [
    option("Local Client"),
    ...CLIENT_SHARED_ANSWERS.map((label) => option(label, "local")),
    option("Foreign Client"), option("Country"),
    ...CLIENT_SHARED_ANSWERS.map((label) => option(label, "foreign")),
  ]
  return (BUILTIN_FIELDS[tab] || [])
    .filter(([label]) => tab !== "department" || !["Department", "Person's Name"].includes(label))
    .map(([label]) => option(label))
}

// These existing fields can use any of the editor's input types. Their
// converted answers are stored separately from the original fixed columns.
// These controls change which other fields appear, so they keep their native
// behavior. Every answer field can be changed to any supported input type.
const STRUCTURAL_FIELDS = new Set([
  "client_details:Local Client", "client_details:Foreign Client",
  "client_details:Identification Document", "client_details:NIC",
  "client_details:Passport", "client_details:Other document",
  "client_details:No document", "previous_owner:Third Person Involved?",
  "department:Department", "department:Person's Name",
])

export const isFlexibleBuiltin = (tab, label) => !STRUCTURAL_FIELDS.has(builtinKey(tab, label))

export const builtinType = (setting, fallback) => typeof setting === "string"
  ? setting : setting?.type || fallback

export const builtinOptions = (setting, fallback = []) => Array.isArray(setting?.options)
  ? setting.options : fallback

const FIXED_TYPES = {
  "Number": "number", "Date picker": "date", "Checkbox": "checkbox",
  "Checkbox group": "checkbox", "Radio buttons": "radio",
  "Searchable selection": "searchable", "Image upload": "image",
  "Multiple images": "multi_image", "PDF or image upload": "file",
}

export function builtinInputTypes(displayType) {
  if (displayType === "Text" || displayType === "Multiline text") {
    return ["text", "email", "tel", "number", "date", "textarea"]
  }
  return [FIXED_TYPES[displayType]]
}

export const defaultBuiltinType = (displayType) => displayType === "Multiline text"
  ? "textarea" : builtinInputTypes(displayType)[0]
