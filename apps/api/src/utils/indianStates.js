/**
 * Indian GST state codes.
 *
 * Needed because `Order.shippingAddress.state` is free text — typed by the
 * buyer, or auto-filled from api.postalpincode.in / Nominatim — while the
 * intra-state vs inter-state decision needs a numeric code.
 */

// Canonical code -> display name.
const STATE_NAMES = {
  '01': 'Jammu & Kashmir',   '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh',        '05': 'Uttarakhand',      '06': 'Haryana',
  '07': 'Delhi',             '08': 'Rajasthan',        '09': 'Uttar Pradesh',
  '10': 'Bihar',             '11': 'Sikkim',           '12': 'Arunachal Pradesh',
  '13': 'Nagaland',          '14': 'Manipur',          '15': 'Mizoram',
  '16': 'Tripura',           '17': 'Meghalaya',        '18': 'Assam',
  '19': 'West Bengal',       '20': 'Jharkhand',        '21': 'Odisha',
  '22': 'Chhattisgarh',      '23': 'Madhya Pradesh',   '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',       '29': 'Karnataka',        '30': 'Goa',
  '31': 'Lakshadweep',       '32': 'Kerala',           '33': 'Tamil Nadu',
  '34': 'Puducherry',        '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',         '37': 'Andhra Pradesh',   '38': 'Ladakh',
  '97': 'Other Territory',
};

// Codes that were superseded but still appear on older GSTINs. Mapping them to
// the current code keeps a vendor registered under the old code from looking
// inter-state to a buyer in the same physical state.
const LEGACY_CODE_ALIASES = {
  '25': '26', // Daman & Diu merged into Dadra & Nagar Haveli (2020)
  '28': '37', // Andhra Pradesh renumbered after the Telangana bifurcation
};

/** Lowercase, drop punctuation, spell out '&' — so "Jammu & Kashmir" == "jammu and kashmir". */
function normalise(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

// Common spellings, abbreviations and renamed states seen in free-text input.
const NAME_ALIASES = {
  tn: '33', tamilnadu: '33', tamilnad: '33',
  orissa: '21',
  uttaranchal: '05',
  pondicherry: '34', puduchery: '34', pondichery: '34',
  newdelhi: '07', nctofdelhi: '07', delhinct: '07', nationalcapitalterritoryofdelhi: '07',
  jk: '01', jammukashmir: '01',
  up: '09', mp: '23', ap: '37', ts: '36', wb: '19', hp: '02',
  ka: '29', kl: '32', mh: '27', gj: '24', rj: '08', pb: '03', br: '10',
  andamannicobar: '35', andamanandnicobar: '35',
  dadranagarhaveli: '26', damananddiu: '26', damandiu: '26',
  telengana: '36',
};

const NAME_TO_CODE = (() => {
  const map = { ...NAME_ALIASES };
  for (const [code, name] of Object.entries(STATE_NAMES)) map[normalise(name)] = code;
  return map;
})();

/** Folds a superseded code onto its current equivalent. */
function canonicalStateCode(code) {
  if (!code) return null;
  const two = String(code).trim().padStart(2, '0').slice(0, 2);
  const canonical = LEGACY_CODE_ALIASES[two] || two;
  return STATE_NAMES[canonical] ? canonical : null;
}

/**
 * Free-text state name -> GST state code, or null when it cannot be resolved.
 * Returning null is deliberate: guessing would silently produce a wrong split.
 *
 * @param {string} name e.g. 'Tamil Nadu', 'TAMILNADU', 'TN', 'Orissa'
 * @returns {string|null} e.g. '33'
 */
function stateCodeFromName(name) {
  const key = normalise(name);
  if (!key) return null;
  return canonicalStateCode(NAME_TO_CODE[key]) || null;
}

function stateNameFromCode(code) {
  const canonical = canonicalStateCode(code);
  return canonical ? STATE_NAMES[canonical] : null;
}

module.exports = { STATE_NAMES, stateCodeFromName, stateNameFromCode, canonicalStateCode };
