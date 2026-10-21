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
    ["Third Person Involved?", "Radio buttons"], ["Third Person Document", "Image upload"],
    ["Handover Selfie", "Image upload"],
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
