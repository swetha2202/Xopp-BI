// Field dictionary for auto-detection
const FIELD_MAP = {
  phone: ['phone', 'mobile', 'contact', 'tel', 'telephone', 'cell', 'mob', 'phone no', 'phone number', 'mobile no', 'contact no'],
  email: ['email', 'e-mail', 'mail', 'email address', 'emailaddress'],
  name: ['name', 'owner', 'customer', 'purchaser', 'client', 'buyer', 'full name', 'owner name', 'customer name'],
  unit: ['unit', 'unit no', 'apartment', 'villa', 'apt', 'flat', 'unit number', 'property', 'apt no', 'flat no', 'villa no'],
  project: ['project', 'tower', 'development', 'building', 'community', 'project name', 'tower name', 'building name'],
  nationality: ['nationality', 'nation', 'citizenship'],
  registration_date: ['registration date', 'reg date', 'date', 'transfer date', 'sale date', 'registration', 'reg_date'],
  unit_type: ['type', 'unit type', 'property type', 'bedroom', 'beds', 'bedrooms', 'bhk'],
  area: ['area_name_en', 'area_name_ar', 'area name', 'emirate', 'emirates', 'district', 'zone'],
  land_number: ['land_number', 'land number', 'land no', 'plot number', 'plot no', 'plot_number'],
  land_sub_number: ['land_sub_number', 'land sub number', 'sub number', 'sub no'],
  actual_area: ['actual_area', 'actual area', 'area sqft', 'area sqm', 'size', 'built up area', 'builtup area', 'floor area'],
  property_sub_type: ['property_sub_type_en', 'property_sub_type_ar', 'property sub type', 'property subtype', 'sub type', 'subtype'],
  zip_code: ['munc_zip_code', 'zip code', 'zip_code', 'postal code', 'postcode', 'municipality code'],
};

function detectColumn(header) {
  const h = header.toLowerCase().trim();
  for (const [field, synonyms] of Object.entries(FIELD_MAP)) {
    if (synonyms.some(s => h === s || h.includes(s) || s.includes(h))) {
      return field;
    }
  }
  return null;
}

function autoDetectMapping(headers) {
  const mapping = {};
  const used = new Set();
  for (const header of headers) {
    const field = detectColumn(header);
    if (field && !used.has(field)) {
      mapping[header] = field;
      used.add(field);
    } else if (field && used.has(field)) {
      mapping[header] = null; // duplicate detection, let user decide
    } else {
      mapping[header] = null;
    }
  }
  return mapping;
}

function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[\s\-\(\)\.]/g, '');
  if (!p) return null;
  // Remove leading zeros and add country code if looks like UAE
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('05') && p.length === 10) p = '+971' + p.slice(1);
  if (p.startsWith('5') && p.length === 9) p = '+9715' + p.slice(1);
  return p.toUpperCase();
}

function normalizeEmail(email) {
  if (!email) return null;
  return String(email).toLowerCase().trim();
}

function normalizeDate(date) {
  if (!date) return null;
  try {
    if (typeof date === 'number') {
      // Excel serial date — valid range is roughly 1 (1900-01-01) to 2958465 (9999-12-31)
      if (date < 1 || date > 2958465) return null;
      const d = new Date((date - 25569) * 86400 * 1000);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split('T')[0];
    }
    const str = String(date).trim();
    // Reject strings that look like phone numbers or are clearly not dates
    if (/^[+\d\s\-\(\)]{7,}$/.test(str) && !/^\d{4}-\d{2}-\d{2}/.test(str)) return null;
    // Only attempt parsing if string looks date-like
    if (!/\d{4}/.test(str)) return null;
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    // Sanity check — reject dates outside reasonable range
    const year = d.getFullYear();
    if (year < 1900 || year > 2100) return null;
    return d.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

function normalizeName(name) {
  if (!name) return null;
  return String(name).trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizeProject(project) {
  if (!project) return null;
  return String(project).trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizeUnit(unit) {
  if (!unit) return null;
  return String(unit).trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizeRow(row, mapping) {
  const result = {};
  for (const [col, field] of Object.entries(mapping)) {
    if (!field || !(col in row)) continue;
    const val = row[col];
    switch (field) {
      case 'phone': result.phone = normalizePhone(val); break;
      case 'email': result.email = normalizeEmail(val); break;
      case 'name': result.name = normalizeName(val); break;
      case 'project': result.project = normalizeProject(val); break;
      case 'unit': result.unit = normalizeUnit(val); break;
      case 'nationality': result.nationality = val ? String(val).trim().toUpperCase() : null; break;
      case 'registration_date': result.registration_date = normalizeDate(val); break;
      case 'unit_type': result.unit_type = val ? String(val).trim().toUpperCase() : null; break;
      case 'area': result.area = val ? String(val).trim().toUpperCase() : null; break;
      case 'land_number': result.land_number = val ? String(val).trim() : null; break;
      case 'land_sub_number': result.land_sub_number = val ? String(val).trim() : null; break;
      case 'actual_area': result.actual_area = val ? parseFloat(val) || String(val).trim() : null; break;
      case 'property_sub_type': result.property_sub_type = val ? String(val).trim().toUpperCase() : null; break;
      case 'zip_code': result.zip_code = val ? String(val).trim() : null; break;
    }
  }
  return result;
}

module.exports = { autoDetectMapping, normalizeRow, normalizePhone, normalizeEmail };