/**
 * THIMADU AUTO TRADERS - GOOGLE APPS SCRIPT API
 * -------------------------------------------------------------
 * Database:
 *   Spreadsheet: thimadu car sale
 *   Vehicles tab: carsale
 *   Happy customers tab: happy_customers
 *   Videos tab: videos
 *
 * Media:
 *   Root Drive folder: Thimadu media folder configured below.
 *
 * SECURITY:
 *   Set a strong, unique Script Property THIMADU_ADMIN_TOKEN in Apps Script:
 *   Project Settings -> Script Properties.
 *   Admin access is disabled when this property is missing or blank.
 *
 * DEPLOYMENT:
 *   Deploy as Web App
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Public GET reads are read-only.
 * All writes + admin reads require the admin token.
 */

const CONFIG = Object.freeze({
  SPREADSHEET_ID: "1kyJXiH67w19sgt5sqeDeiqytXUVMlqAsrEKKJwRaue0",
  ROOT_DRIVE_FOLDER_ID: "1Ot4nsPI2Q9oaxsj-T_JJSM9NMvs6GIy1",
  PUBLIC_VEHICLE_CSV: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtUtkiDWGhuls-2JhfsVL1Hj_oFiFTyBPZyHndMBHeNoRotTcjppZe-tN32NqST4-t-xsgXnjYMK-8/pub?output=csv",
  VEHICLE_SHEET: "carsale",
  CUSTOMER_SHEET: "happy_customers",
  VIDEO_SHEET: "videos",
  MAX_VEHICLE_IMAGES: 20,
  MAX_TEXT_LENGTH: 5000,
  TIMEZONE: "Asia/Colombo",
  CACHE_SECONDS: 30
});

const VEHICLE_HEADERS = Object.freeze([
  "brand","model","grade","type","year","mileage","fuel","transmission",
  "color","engine","condition","price","location","description",
  "image1","image2","image3","image4","image5","image6","image7","image8","image9","image10",
  "image11","image12","image13","image14","image15","image16","image17","image18","image19","image20",
  "availability","posted_date","id"
]);

const CUSTOMER_HEADERS = Object.freeze([
  "id","headline","description","customer_name","location",
  "image_url","display_order","status","posted_date"
]);

const VIDEO_HEADERS = Object.freeze([
  "id","headline","description","video_url","thumbnail_url",
  "platform","display_order","status","posted_date"
]);

const ALLOWED = Object.freeze({
  fuel: ["Petrol","Diesel","Hybrid","Electric"],
  transmission: ["Automatic","Manual","Tiptronic","CVT"],
  condition: ["New","Used"],
  availability: ["Available","Sold","Pending","Japan Auction","Reserved"],
  visibility: ["Active","Hidden"]
});

/* =========================================================
   WEB APP ENTRY POINTS
   ========================================================= */

function doGet(e) {
  try {
    // Public requests must never create or repair spreadsheet structure.
    // Run setupDatabase manually, or use the authenticated setup action.
    const params = (e && e.parameter) || {};
    const action = cleanText_(params.action || "health", 30).toLowerCase();

    if (action === "health") {
      return json_({
        status: "success",
        service: "Thimadu Auto Traders API",
        version: "2.0.0",
        database: CONFIG.SPREADSHEET_ID,
        csv: CONFIG.PUBLIC_VEHICLE_CSV,
        time: new Date().toISOString()
      });
    }

    if (action === "read") {
      const resource = normalizeResource_(params.type || params.resource || "vehicles");

      if (resource === "all") {
        return json_({
          status: "success",
          data: {
            vehicles: readVehicles_(false),
            customers: readCustomers_(false),
            videos: readVideos_(false)
          }
        });
      }

      return json_({
        status: "success",
        data: readPublicResource_(resource)
      });
    }

    return json_({
      status: "success",
      service: "Thimadu Auto Traders API",
      message: "Use ?action=read&type=vehicles|customers|videos or ?action=health"
    });

  } catch (error) {
    return errorResponse_(error);
  }
}

function doPost(e) {
  let lock = null;
  let locked = false;

  try {
    const payload = parsePostBody_(e);
    const action = cleanText_(payload.action || "", 40).toLowerCase();

    // Authentication does not need a script lock.
    if (action === "auth") {
      const authorized = isAdminAuthorized_(payload.token);
      return json_({
        status: authorized ? "success" : "error",
        message: authorized ? "Authenticated" : "Invalid admin password"
      });
    }

    requireAdmin_(payload.token);
    ensureDatabase_();

    // Admin read is read-only and should not be blocked by uploads/writes.
    if (action === "read_admin") {
      return json_({
        status: "success",
        data: {
          vehicles: readVehicles_(true),
          customers: readCustomers_(true),
          videos: readVideos_(true)
        },
        counts: getCounts_()
      });
    }

    if (action === "setup") {
      setupDatabase();
      return json_({
        status: "success",
        message: "Database structure verified and repaired where safe.",
        counts: getCounts_()
      });
    }

    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    locked = true;

    const resource = normalizeResource_(payload.resource || "vehicles");

    let result;
    if (resource === "vehicles") {
      result = routeVehicleAction_(action, payload);
    } else if (resource === "customers") {
      result = routeCustomerAction_(action, payload);
    } else if (resource === "videos") {
      result = routeVideoAction_(action, payload);
    } else {
      throw appError_("INVALID_RESOURCE", "Unknown resource.");
    }

    clearCaches_();
    return json_(Object.assign({ status: "success" }, result));

  } catch (error) {
    return errorResponse_(error);
  } finally {
    if (locked && lock) {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
}

/* =========================================================
   ONE-TIME / SELF-HEALING DATABASE SETUP
   ========================================================= */

/**
 * Run this once manually after pasting the script.
 * Safe to run again.
 */
function setupDatabase() {
  ensureDatabase_();

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ss.setSpreadsheetTimeZone(CONFIG.TIMEZONE);

  styleSheet_(ss.getSheetByName(CONFIG.VEHICLE_SHEET), VEHICLE_HEADERS);
  styleSheet_(ss.getSheetByName(CONFIG.CUSTOMER_SHEET), CUSTOMER_HEADERS);
  styleSheet_(ss.getSheetByName(CONFIG.VIDEO_SHEET), VIDEO_HEADERS);

  applyValidations_();
  ensureMediaFolders_();

  return {
    status: "success",
    spreadsheet: ss.getName(),
    vehicleSheet: CONFIG.VEHICLE_SHEET,
    customerSheet: CONFIG.CUSTOMER_SHEET,
    videoSheet: CONFIG.VIDEO_SHEET
  };
}

function ensureDatabase_() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  // For a brand-new sheet only: allow the default blank first tab to become carsale.
  let vehicleSheet = ss.getSheetByName(CONFIG.VEHICLE_SHEET);
  if (!vehicleSheet) {
    const sheets = ss.getSheets();
    const first = sheets[0];
    if (
      sheets.length === 1 &&
      first.getLastRow() === 0 &&
      first.getLastColumn() <= 1
    ) {
      first.setName(CONFIG.VEHICLE_SHEET);
      vehicleSheet = first;
    } else {
      vehicleSheet = ss.insertSheet(CONFIG.VEHICLE_SHEET);
    }
  }

  ensureCanonicalSheet_(vehicleSheet, VEHICLE_HEADERS);
  ensureCanonicalSheet_(getOrCreateSheet_(ss, CONFIG.CUSTOMER_SHEET), CUSTOMER_HEADERS);
  ensureCanonicalSheet_(getOrCreateSheet_(ss, CONFIG.VIDEO_SHEET), VIDEO_HEADERS);
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureCanonicalSheet_(sheet, expectedHeaders) {
  if (sheet.getMaxColumns() < expectedHeaders.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      expectedHeaders.length - sheet.getMaxColumns()
    );
  }

  const current = sheet
    .getRange(1, 1, 1, expectedHeaders.length)
    .getDisplayValues()[0]
    .map(v => String(v || "").trim());

  const empty = current.every(v => !v);

  if (empty) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders.slice()]);
    sheet.setFrozenRows(1);
    return;
  }

  const mismatches = [];
  expectedHeaders.forEach((header, i) => {
    if (current[i] !== header) {
      mismatches.push(`Column ${i + 1}: expected "${header}", found "${current[i] || "(blank)"}"`);
    }
  });

  if (mismatches.length) {
    throw appError_(
      "SCHEMA_MISMATCH",
      `Sheet "${sheet.getName()}" headers were changed. To prevent data corruption, the API stopped. ` +
      mismatches.slice(0, 5).join("; ")
    );
  }

  sheet.setFrozenRows(1);
}

function styleSheet_(sheet, headers) {
  if (!sheet) return;

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange
    .setBackground("#0F5CE1")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrap(true);

  sheet.setRowHeight(1, 34);
  sheet.setFrozenRows(1);

  try {
    if (!sheet.getFilter()) {
      sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 2), headers.length).createFilter();
    }
  } catch (_) {}

  // Useful, conservative widths. No sheet-wide auto-resize.
  headers.forEach((header, index) => {
    const col = index + 1;
    let width = 120;
    if (header === "description") width = 300;
    if (header.indexOf("image") === 0 || header === "image_url" || header === "thumbnail_url") width = 150;
    if (header === "video_url") width = 220;
    if (header === "headline") width = 220;
    if (header === "id") width = 170;
    try { sheet.setColumnWidth(col, width); } catch (_) {}
  });
}

function applyValidations_() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const vehicles = ss.getSheetByName(CONFIG.VEHICLE_SHEET);
  const customers = ss.getSheetByName(CONFIG.CUSTOMER_SHEET);
  const videos = ss.getSheetByName(CONFIG.VIDEO_SHEET);

  const rowCount = Math.max(vehicles.getMaxRows() - 1, 1);

  setListValidation_(vehicles, 7, rowCount, ALLOWED.fuel);
  setListValidation_(vehicles, 8, rowCount, ALLOWED.transmission);
  setListValidation_(vehicles, 11, rowCount, ALLOWED.condition);
  setListValidation_(vehicles, 35, rowCount, ALLOWED.availability);

  setListValidation_(customers, 8, Math.max(customers.getMaxRows() - 1, 1), ALLOWED.visibility);
  setListValidation_(videos, 8, Math.max(videos.getMaxRows() - 1, 1), ALLOWED.visibility);
}

function setListValidation_(sheet, column, rows, list) {
  if (!sheet || rows < 1) return;
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(list, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, column, rows, 1).setDataValidation(rule);
}

/* =========================================================
   AUTH
   ========================================================= */

function getAdminToken_() {
  const token = String(
    PropertiesService.getScriptProperties().getProperty("THIMADU_ADMIN_TOKEN") || ""
  ).trim();
  if (!token) {
    throw appError_(
      "ADMIN_NOT_CONFIGURED",
      "Admin access is disabled. Set the THIMADU_ADMIN_TOKEN Script Property in Apps Script project settings."
    );
  }
  return token;
}

function isAdminAuthorized_(token) {
  return constantTimeEqual_(String(token || ""), String(getAdminToken_() || ""));
}

function requireAdmin_(token) {
  if (!isAdminAuthorized_(token)) {
    throw appError_("UNAUTHORIZED", "Invalid admin password.");
  }
}

function constantTimeEqual_(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/* =========================================================
   ROUTERS
   ========================================================= */

function routeVehicleAction_(action, data) {
  if (action === "create") return createVehicle_(data);
  if (action === "update") return updateVehicle_(data);
  if (action === "delete") return deleteById_(CONFIG.VEHICLE_SHEET, VEHICLE_HEADERS, data.id, "Vehicle");
  throw appError_("INVALID_ACTION", "Unsupported vehicle action.");
}

function routeCustomerAction_(action, data) {
  if (action === "create") return createCustomer_(data);
  if (action === "update") return updateCustomer_(data);
  if (action === "delete") return deleteById_(CONFIG.CUSTOMER_SHEET, CUSTOMER_HEADERS, data.id, "Happy customer");
  throw appError_("INVALID_ACTION", "Unsupported happy customer action.");
}

function routeVideoAction_(action, data) {
  if (action === "create") return createVideo_(data);
  if (action === "update") return updateVideo_(data);
  if (action === "delete") return deleteById_(CONFIG.VIDEO_SHEET, VIDEO_HEADERS, data.id, "Video");
  throw appError_("INVALID_ACTION", "Unsupported video action.");
}

/* =========================================================
   VEHICLES
   ========================================================= */

function createVehicle_(data) {
  const vehicle = validateVehicle_(data, false);
  const id = newId_("VEH");
  const folder = getOrCreateSubfolder_("vehicles");
  const imageUrls = uploadImageArray_(data.images || [], folder, CONFIG.MAX_VEHICLE_IMAGES, id);

  if (!imageUrls.filter(Boolean).length) {
    throw appError_("IMAGE_REQUIRED", "Please upload at least one vehicle image.");
  }

  const row = {
    brand: vehicle.brand,
    model: vehicle.model,
    grade: vehicle.grade,
    type: vehicle.type,
    year: vehicle.year,
    mileage: vehicle.mileage,
    fuel: vehicle.fuel,
    transmission: vehicle.transmission,
    color: vehicle.color,
    engine: vehicle.engine,
    condition: vehicle.condition,
    price: vehicle.price,
    location: vehicle.location,
    description: vehicle.description,
    availability: vehicle.availability,
    posted_date: today_(),
    id: id
  };

  for (let i = 0; i < CONFIG.MAX_VEHICLE_IMAGES; i++) {
    row[`image${i + 1}`] = imageUrls[i] || "";
  }

  appendObject_(CONFIG.VEHICLE_SHEET, VEHICLE_HEADERS, row);

  return {
    message: "Vehicle created successfully.",
    id: id,
    data: vehicleObjectFromRow_(row)
  };
}

function updateVehicle_(data) {
  const id = requireId_(data.id);
  const vehicle = validateVehicle_(data, true);
  const found = findRowById_(CONFIG.VEHICLE_SHEET, VEHICLE_HEADERS, id);

  if (!found) throw appError_("NOT_FOUND", "Vehicle ID not found.");

  const existing = rowToObject_(VEHICLE_HEADERS, found.values);
  let imageUrls = [];

  const imagesTouched =
    data.imagesTouched === true ||
    data.imagesTouched === "true";

  if (imagesTouched) {
    const folder = getOrCreateSubfolder_("vehicles");
    imageUrls = uploadImageArray_(data.images || [], folder, CONFIG.MAX_VEHICLE_IMAGES, id);
    if (!imageUrls.filter(Boolean).length) {
      throw appError_("IMAGE_REQUIRED", "A vehicle must keep at least one image.");
    }
  } else {
    for (let i = 1; i <= CONFIG.MAX_VEHICLE_IMAGES; i++) {
      imageUrls.push(existing[`image${i}`] || "");
    }
  }

  const row = {
    brand: vehicle.brand,
    model: vehicle.model,
    grade: vehicle.grade,
    type: vehicle.type,
    year: vehicle.year,
    mileage: vehicle.mileage,
    fuel: vehicle.fuel,
    transmission: vehicle.transmission,
    color: vehicle.color,
    engine: vehicle.engine,
    condition: vehicle.condition,
    price: vehicle.price,
    location: vehicle.location,
    description: vehicle.description,
    availability: vehicle.availability,
    posted_date: existing.posted_date || today_(),
    id: id
  };

  for (let i = 0; i < CONFIG.MAX_VEHICLE_IMAGES; i++) {
    row[`image${i + 1}`] = imageUrls[i] || "";
  }

  updateObjectRow_(CONFIG.VEHICLE_SHEET, VEHICLE_HEADERS, found.rowIndex, row);

  return {
    message: "Vehicle updated successfully.",
    id: id
  };
}

function validateVehicle_(data) {
  const currentYear = Number(Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy"));

  const brand = requiredText_(data.brand, "Brand", 100);
  const model = requiredText_(data.model, "Model", 120);
  const year = cleanText_(data.year, 10);

  if (year) {
    const n = Number(year);
    if (!Number.isFinite(n) || n < 1900 || n > currentYear + 2) {
      throw appError_("VALIDATION", "Vehicle year is invalid.");
    }
  }

  return {
    brand: brand,
    model: model,
    grade: cleanText_(data.grade, 100),
    type: cleanText_(data.type, 100),
    year: year,
    mileage: cleanText_(data.mileage, 50),
    fuel: pickAllowed_(data.fuel, ALLOWED.fuel, "Petrol"),
    transmission: pickAllowed_(data.transmission, ALLOWED.transmission, "Automatic"),
    color: cleanText_(data.color, 80),
    engine: cleanText_(data.engine, 80),
    condition: pickAllowed_(data.condition, ALLOWED.condition, "Used"),
    price: cleanText_(data.price, 80),
    location: cleanText_(data.location, 200),
    description: cleanText_(data.description, CONFIG.MAX_TEXT_LENGTH, true),
    availability: pickAllowed_(data.availability, ALLOWED.availability, "Available")
  };
}

/* =========================================================
   HAPPY CUSTOMERS
   ========================================================= */

function createCustomer_(data) {
  const item = validateCustomer_(data);
  const id = newId_("CUS");
  const folder = getOrCreateSubfolder_("happy-customers");

  let imageUrl = "";
  if (data.image) {
    imageUrl = uploadSingleImage_(data.image, folder, id, "customer");
  }

  if (!imageUrl && data.image_url) {
    imageUrl = safeUrl_(data.image_url);
  }

  if (!imageUrl) {
    throw appError_("IMAGE_REQUIRED", "Please upload a happy customer image.");
  }

  const row = {
    id: id,
    headline: item.headline,
    description: item.description,
    customer_name: item.customer_name,
    location: item.location,
    image_url: imageUrl,
    display_order: item.display_order,
    status: item.status,
    posted_date: today_()
  };

  appendObject_(CONFIG.CUSTOMER_SHEET, CUSTOMER_HEADERS, row);

  return {
    message: "Happy customer entry created successfully.",
    id: id
  };
}

function updateCustomer_(data) {
  const id = requireId_(data.id);
  const item = validateCustomer_(data);
  const found = findRowById_(CONFIG.CUSTOMER_SHEET, CUSTOMER_HEADERS, id);
  if (!found) throw appError_("NOT_FOUND", "Happy customer ID not found.");

  const existing = rowToObject_(CUSTOMER_HEADERS, found.values);
  let imageUrl = existing.image_url || "";

  const imageTouched =
    data.imageTouched === true ||
    data.imageTouched === "true";

  if (imageTouched) {
    if (data.image) {
      imageUrl = uploadSingleImage_(
        data.image,
        getOrCreateSubfolder_("happy-customers"),
        id,
        "customer"
      );
    } else if (data.image_url) {
      imageUrl = safeUrl_(data.image_url);
    } else {
      imageUrl = "";
    }
  }

  if (!imageUrl) {
    throw appError_("IMAGE_REQUIRED", "A happy customer entry must have an image.");
  }

  const row = {
    id: id,
    headline: item.headline,
    description: item.description,
    customer_name: item.customer_name,
    location: item.location,
    image_url: imageUrl,
    display_order: item.display_order,
    status: item.status,
    posted_date: existing.posted_date || today_()
  };

  updateObjectRow_(CONFIG.CUSTOMER_SHEET, CUSTOMER_HEADERS, found.rowIndex, row);

  return {
    message: "Happy customer entry updated successfully.",
    id: id
  };
}

function validateCustomer_(data) {
  return {
    headline: requiredText_(data.headline, "Headline", 180),
    description: cleanText_(data.description, 800, true),
    customer_name: cleanText_(data.customer_name, 120),
    location: cleanText_(data.location, 160),
    display_order: normalizeOrder_(data.display_order),
    status: pickAllowed_(data.status, ALLOWED.visibility, "Active")
  };
}

/* =========================================================
   VIDEOS
   ========================================================= */

function createVideo_(data) {
  const item = validateVideo_(data);
  const id = newId_("VID");
  const row = {
    id: id,
    headline: item.headline,
    description: item.description,
    video_url: item.video_url,
    thumbnail_url: item.thumbnail_url || deriveVideoThumbnail_(item.video_url),
    platform: detectVideoPlatform_(item.video_url),
    display_order: item.display_order,
    status: item.status,
    posted_date: today_()
  };

  appendObject_(CONFIG.VIDEO_SHEET, VIDEO_HEADERS, row);

  return {
    message: "Video created successfully.",
    id: id
  };
}

function updateVideo_(data) {
  const id = requireId_(data.id);
  const item = validateVideo_(data);
  const found = findRowById_(CONFIG.VIDEO_SHEET, VIDEO_HEADERS, id);
  if (!found) throw appError_("NOT_FOUND", "Video ID not found.");

  const existing = rowToObject_(VIDEO_HEADERS, found.values);
  const row = {
    id: id,
    headline: item.headline,
    description: item.description,
    video_url: item.video_url,
    thumbnail_url: item.thumbnail_url || deriveVideoThumbnail_(item.video_url),
    platform: detectVideoPlatform_(item.video_url),
    display_order: item.display_order,
    status: item.status,
    posted_date: existing.posted_date || today_()
  };

  updateObjectRow_(CONFIG.VIDEO_SHEET, VIDEO_HEADERS, found.rowIndex, row);

  return {
    message: "Video updated successfully.",
    id: id
  };
}

function validateVideo_(data) {
  const videoUrl = safeUrl_(requiredText_(data.video_url, "Video link", 1000));

  return {
    headline: requiredText_(data.headline, "Headline", 180),
    description: cleanText_(data.description, 1200, true),
    video_url: videoUrl,
    thumbnail_url: data.thumbnail_url ? safeUrl_(data.thumbnail_url) : "",
    display_order: normalizeOrder_(data.display_order),
    status: pickAllowed_(data.status, ALLOWED.visibility, "Active")
  };
}

/* =========================================================
   READS
   ========================================================= */

function readPublicResource_(resource) {
  if (resource === "vehicles") return readVehicles_(false);
  if (resource === "customers") return readCustomers_(false);
  if (resource === "videos") return readVideos_(false);
  throw appError_("INVALID_RESOURCE", "Unknown read resource.");
}

function readVehicles_(adminMode) {
  const rows = readSheetObjects_(CONFIG.VEHICLE_SHEET, VEHICLE_HEADERS);
  const result = rows
    .filter(r => r.id || r.brand || r.model)
    .map(vehicleObjectFromRow_);

  result.reverse();
  return result;
}

function vehicleObjectFromRow_(r) {
  const images = [];
  for (let i = 1; i <= CONFIG.MAX_VEHICLE_IMAGES; i++) {
    const url = String(r[`image${i}`] || "").trim();
    if (url) images.push(url);
  }

  return {
    brand: r.brand || "",
    model: r.model || "",
    grade: r.grade || "",
    type: r.type || "",
    year: r.year || "",
    mileage: r.mileage || "",
    fuel: r.fuel || "",
    transmission: r.transmission || "",
    color: r.color || "",
    engine: r.engine || "",
    condition: r.condition || "",
    price: r.price || "",
    location: r.location || "",
    description: r.description || "",
    images: images,
    image1: images[0] || "",
    availability: r.availability || "Available",
    posted_date: r.posted_date || "",
    id: r.id || ""
  };
}

function readCustomers_(adminMode) {
  let rows = readSheetObjects_(CONFIG.CUSTOMER_SHEET, CUSTOMER_HEADERS)
    .filter(r => r.id || r.headline);

  if (!adminMode) {
    rows = rows.filter(r => !r.status || String(r.status).toLowerCase() === "active");
  }

  rows.sort(sortByOrderThenDate_);
  return rows;
}

function readVideos_(adminMode) {
  let rows = readSheetObjects_(CONFIG.VIDEO_SHEET, VIDEO_HEADERS)
    .filter(r => r.id || r.headline || r.video_url);

  if (!adminMode) {
    rows = rows.filter(r => !r.status || String(r.status).toLowerCase() === "active");
  }

  rows.sort(sortByOrderThenDate_);
  return rows;
}

function sortByOrderThenDate_(a, b) {
  const ao = Number(a.display_order || 999999);
  const bo = Number(b.display_order || 999999);
  if (ao !== bo) return ao - bo;
  return String(b.posted_date || "").localeCompare(String(a.posted_date || ""));
}

function getCounts_() {
  return {
    vehicles: readVehicles_(true).length,
    customers: readCustomers_(true).length,
    videos: readVideos_(true).length
  };
}

/* =========================================================
   GENERIC SHEET OPERATIONS
   ========================================================= */

function readSheetObjects_(sheetName, headers) {
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
    .getDisplayValues();

  return rows.map(values => rowToObject_(headers, values));
}

function rowToObject_(headers, values) {
  const obj = {};
  headers.forEach((header, i) => {
    obj[header] = values[i] == null ? "" : values[i];
  });
  return obj;
}

function appendObject_(sheetName, headers, object) {
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(sheetName);
  const values = headers.map(h => object[h] == null ? "" : object[h]);
  sheet.appendRow(values);
}

function updateObjectRow_(sheetName, headers, rowIndex, object) {
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(sheetName);
  const values = headers.map(h => object[h] == null ? "" : object[h]);
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([values]);
}

function findRowById_(sheetName, headers, id) {
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(sheetName);
  const idCol = headers.indexOf("id") + 1;
  if (idCol <= 0 || sheet.getLastRow() < 2) return null;

  const values = sheet
    .getRange(2, idCol, sheet.getLastRow() - 1, 1)
    .getDisplayValues();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      const rowIndex = i + 2;
      const row = sheet.getRange(rowIndex, 1, 1, headers.length).getDisplayValues()[0];
      return { rowIndex: rowIndex, values: row };
    }
  }
  return null;
}

function deleteById_(sheetName, headers, id, label) {
  id = requireId_(id);
  const found = findRowById_(sheetName, headers, id);
  if (!found) throw appError_("NOT_FOUND", `${label} ID not found.`);

  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(sheetName);
  sheet.deleteRow(found.rowIndex);

  return {
    message: `${label} deleted successfully.`,
    id: id
  };
}

/* =========================================================
   DRIVE / IMAGE UPLOADS
   ========================================================= */

function ensureMediaFolders_() {
  getOrCreateSubfolder_("vehicles");
  getOrCreateSubfolder_("happy-customers");
}

function getRootFolder_() {
  return DriveApp.getFolderById(CONFIG.ROOT_DRIVE_FOLDER_ID);
}

function getOrCreateSubfolder_(name) {
  const root = getRootFolder_();
  const folders = root.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : root.createFolder(name);
}

function uploadImageArray_(items, folder, maxCount, idPrefix) {
  const source = Array.isArray(items) ? items.slice(0, maxCount) : [];
  const urls = [];

  for (let i = 0; i < maxCount; i++) {
    const item = source[i];

    if (!item) {
      urls.push("");
      continue;
    }

    if (typeof item === "string") {
      urls.push(safeUrl_(item));
      continue;
    }

    urls.push(uploadImageObject_(item, folder, `${idPrefix}-${i + 1}`));
  }

  return urls;
}

function uploadSingleImage_(item, folder, idPrefix, label) {
  if (!item) return "";
  if (typeof item === "string") return safeUrl_(item);
  return uploadImageObject_(item, folder, `${idPrefix}-${label}`);
}

function uploadImageObject_(item, folder, fallbackName) {
  if (!item || typeof item !== "object" || !item.data) {
    throw appError_("BAD_IMAGE", "Invalid image payload.");
  }

  const data = String(item.data);
  const commaIndex = data.indexOf(",");
  const encoded = commaIndex >= 0 ? data.slice(commaIndex + 1) : data;

  let bytes;
  try {
    bytes = Utilities.base64Decode(encoded);
  } catch (_) {
    throw appError_("BAD_IMAGE", "Image Base64 could not be decoded.");
  }

  if (!bytes || !bytes.length) {
    throw appError_("BAD_IMAGE", "Image data is empty.");
  }

  // Apps Script has request/response size limits. Client compresses before upload.
  if (bytes.length > 8 * 1024 * 1024) {
    throw appError_("IMAGE_TOO_LARGE", "Compressed image is still too large. Please use a smaller image.");
  }

  const mime = /^image\//i.test(String(item.mimeType || ""))
    ? String(item.mimeType)
    : "image/jpeg";

  const originalName = cleanFileName_(item.name || `${fallbackName}.jpg`);
  const blob = Utilities.newBlob(bytes, mime, originalName);
  const file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (_) {
    // The URL is still returned; organization policies can block public sharing.
  }

  return `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1600`;
}

function cleanFileName_(name) {
  const safe = String(name || "image.jpg")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
  return safe || "image.jpg";
}

/* =========================================================
   VIDEO HELPERS
   ========================================================= */

function detectVideoPlatform_(url) {
  const u = String(url || "").toLowerCase();
  if (u.indexOf("youtube.com") >= 0 || u.indexOf("youtu.be") >= 0) return "YouTube";
  if (u.indexOf("facebook.com") >= 0 || u.indexOf("fb.watch") >= 0) return "Facebook";
  if (u.indexOf("tiktok.com") >= 0) return "TikTok";
  if (u.indexOf("instagram.com") >= 0) return "Instagram";
  if (u.indexOf("vimeo.com") >= 0) return "Vimeo";
  return "Other";
}

function deriveVideoThumbnail_(url) {
  const id = extractYouTubeId_(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "";
}

function extractYouTubeId_(url) {
  const value = String(url || "").trim();
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /[?&]v=([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = value.match(patterns[i]);
    if (match) return match[1];
  }
  return "";
}

/* =========================================================
   INPUT / VALIDATION HELPERS
   ========================================================= */

function parsePostBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw appError_("EMPTY_BODY", "Request body is empty.");
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (_) {
    throw appError_("BAD_JSON", "Request body must be valid JSON.");
  }
}

function normalizeResource_(value) {
  const v = String(value || "").trim().toLowerCase();
  if (["vehicle","vehicles","cars","carsale"].indexOf(v) >= 0) return "vehicles";
  if (["customer","customers","happy_customers","happycustomers"].indexOf(v) >= 0) return "customers";
  if (["video","videos"].indexOf(v) >= 0) return "videos";
  if (v === "all") return "all";
  return v;
}

function requiredText_(value, label, maxLength) {
  const v = cleanText_(value, maxLength);
  if (!v) throw appError_("VALIDATION", `${label} is required.`);
  return v;
}

function cleanText_(value, maxLength, keepLines) {
  if (value == null) return "";
  let text = String(value);
  text = keepLines ? text.replace(/\r\n/g, "\n") : text.replace(/\s+/g, " ");
  text = text.trim();
  const max = Math.max(1, Number(maxLength || CONFIG.MAX_TEXT_LENGTH));
  if (text.length > max) text = text.slice(0, max);
  return text;
}

function safeUrl_(value) {
  const url = cleanText_(value, 1500);
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) {
    throw appError_("VALIDATION", "URL must begin with http:// or https://");
  }
  return url;
}

function pickAllowed_(value, allowed, fallback) {
  const candidate = cleanText_(value, 100);
  return allowed.indexOf(candidate) >= 0 ? candidate : fallback;
}

function normalizeOrder_(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), 999999);
}

function requireId_(id) {
  const value = cleanText_(id, 120);
  if (!value) throw appError_("VALIDATION", "ID is required.");
  return value;
}

function newId_(prefix) {
  return `${prefix}-${Date.now()}-${Utilities.getUuid().replace(/-/g, "").slice(0, 8)}`;
}

function today_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
}

/* =========================================================
   CACHE / RESPONSE / ERROR HELPERS
   ========================================================= */

function clearCaches_() {
  try {
    CacheService.getScriptCache().removeAll([
      "vehicles_public",
      "customers_public",
      "videos_public"
    ]);
  } catch (_) {}
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function appError_(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function errorResponse_(error) {
  console.error(error && error.stack ? error.stack : error);
  return json_({
    status: "error",
    code: error && error.code ? error.code : "SERVER_ERROR",
    message: error && error.message ? error.message : String(error)
  });
}
