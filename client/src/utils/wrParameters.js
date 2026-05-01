// ── Water Rangers parameter reference ──
// Single source of truth for parameter info shown across the app
// (Alerts, Site Map, Deep Dive, AI explainers). Every value here is
// either copied directly from Water Rangers' public documentation or
// flagged as "Not specified by Water Rangers".
//
// IRON RULE: never invent a number. If a field isn't on
// https://data.waterrangers.com/supported-parameters or a cited WR
// equipment info popup, the field MUST be null and the UI MUST show
// "Not specified by Water Rangers" instead of a fake range.
//
// QA range source (the "safe" range we draw on charts) =
// Water Rangers Automatic QA rules from the supported-parameters page.
// "Needs review" thresholds = the practical safe band community
// scientists are expected to read inside.
//
// Equipment & range catalog source = same supported-parameters page,
// "Equipment (with range/unit)" column.
//
// Hanna-checker style "what does it mean" bands are taken verbatim from
// the parameter's info popup on data.waterrangers.com/supported-parameters
// (e.g. the Hanna Alkalinity Checker popup linked from "Alkalinity").

export const WR_DOCS_URL = 'https://data.waterrangers.com/supported-parameters'
export const WR_NA = 'Not specified by Water Rangers'

// Each entry intentionally leaves fields null when WR doesn't publish them.
// The UI is responsible for rendering null as "Not specified by Water Rangers".
//
// fields:
//   label         display name (matches WR's column)
//   category      WR section (Chemical, Physical, Biological, etc.)
//   unit          primary unit string used in WR ranges (no leading space)
//   aliases       lowercased name fragments seen in WR API / our DB
//   qaSafe        WR "needs review" range — what we draw as the green band
//                 { min, max } where either side may be null
//                 null = WR doesn't publish a QA rule for this parameter
//   qaExtreme     WR "issue detected" range — outer red band
//   equipment     [{ name, range, unit }] — every entry from WR page
//   whatIsIt      short plain-English definition (verbatim or close paraphrase
//                 from WR docs); null if WR doesn't publish it
//   whyImportant  why this matters for water quality (verbatim or paraphrase
//                 from WR popup); null if WR doesn't publish it
//   bands         [{ range, label }] — interpretation bands from WR equipment
//                 popup (e.g. Hanna Checker); null if WR doesn't publish them
//   howToTest     step list copied from WR equipment popup; null if WR doesn't
//                 publish a procedure for any of the listed equipment
//   sources       URLs we copied from — surfaced in the UI as "Reference"

const WR_PARAMETERS = {
  // ──────────────── CHEMICAL ────────────────
  ph: {
    label: 'pH',
    category: 'Chemical',
    unit: '',
    aliases: ['ph', 'p_h'],
    qaSafe:    { min: 5,  max: 10 },   // WR: <5 or >10 flagged "Needs review"
    qaExtreme: { min: 2,  max: 12 },   // WR: <2 or >12 flagged "Issue detected"
    equipment: [
      { name: 'API 5-in-1 teststrips',     range: '6.0 – 9.0',   unit: '' },
      { name: 'Hydrion teststrips',        range: '0.0 – 14.0',  unit: '' },
      { name: 'LaMotte (precision pH)',    range: '3.0 – 10.5',  unit: '' },
      { name: 'Lifegard Saltwater strips', range: '0.0 – 14.0',  unit: '' },
      { name: 'Other pen-type meter',      range: '0.0 – 14.0',  unit: '' },
      { name: 'Taylor teststrips',         range: '6.4 – 8.4',   unit: '' },
      { name: 'Water Rangers pen-type',    range: '0.0 – 14.0',  unit: '' },
      { name: 'YSI multimeter',            range: '-2.0 – 14.0', unit: '' },
    ],
    whatIsIt: null,        // not published as a popup on WR page
    whyImportant: null,
    bands: null,
    howToTest: null,
    sources: [WR_DOCS_URL],
  },

  alkalinity: {
    label: 'Alkalinity',
    category: 'Chemical',
    unit: 'mg/L',
    aliases: ['alkalinity'],
    qaSafe: null,         // WR page lists no QA rule
    qaExtreme: null,
    equipment: [
      { name: 'Hanna checker (alkalinity)',  range: '0.0 – 500.0',    unit: 'mg/L' },
      { name: 'LaMotte (alkalinity)',        range: '0.0 – 200.0',    unit: 'ppm'  },
      { name: 'Taylor teststrips',           range: '0.0 – 240.0',    unit: 'ppm'  },
      { name: 'Unspecified equipment',       range: '0.0 – 100000.0', unit: 'mg/L' },
    ],
    // From the Hanna Alkalinity Checker info popup on the WR page
    whatIsIt: 'Alkalinity in freshwater refers to the water\'s capacity to neutralize acid or resist decreases in pH.',
    whyImportant: 'The alkalinity of the water is environmentally important because it helps to keep fish and other aquatic animals within the range of acidity that they are able to tolerate.',
    bands: [
      { range: '≤ 10 mg/L',     label: 'Very Low' },
      { range: '11 – 50 mg/L',  label: 'Low' },
      { range: '51 – 150 mg/L', label: 'Moderate' },
      { range: '151 – 300 mg/L',label: 'High' },
      { range: '> 300 mg/L',    label: 'Very High' },
    ],
    howToTest: [
      'Rinse the glass cuvette (sample vial) 3 times with your water sample.',
      'Fill the cuvette to the 10 mL line with your sample water. Wipe the outside with a clean cloth.',
      'Insert the cuvette into the Checker, close the lid, and press the button once. Screen shows "C1".',
      'Remove the cuvette and add one packet of the Hanna Alkalinity Reagent (HI-775-0).',
      'Cap tightly and shake gently until the powder is completely dissolved (light blue colour).',
      'Reinsert the cuvette, close the lid, and press the button again.',
      'After a few seconds the alkalinity result appears on screen in ppm CaCO₃.',
    ],
    sources: [WR_DOCS_URL],
  },

  ammonia: {
    label: 'Ammonia',
    category: 'Chemical',
    unit: 'mg/L',
    aliases: ['ammonia'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Hanna checker (ammonia – high range)',   range: '0.0 – 99.0',  unit: 'mg/L' },
      { name: 'Hanna checker (ammonia – low range)',    range: '0.0 – 3.0',   unit: 'mg/L' },
      { name: 'Hanna checker (ammonia – medium range)', range: '0.0 – 9.99',  unit: 'mg/L' },
      { name: 'LaMotte (ammonia-nitrogen)',             range: '0.0 – 4.0',   unit: 'ppm'  },
    ],
    whatIsIt: null,
    whyImportant: null,
    bands: null,
    howToTest: null,
    sources: [WR_DOCS_URL],
  },

  ammonia_nitrogen: {
    label: 'Ammonia-nitrogen',
    category: 'Chemical',
    unit: 'mg/L',
    aliases: ['ammonia_nitrogen', 'ammonia-nitrogen'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Simplex Health teststrip (low range)', range: '0.0 – 6.0', unit: 'mg/L' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  bod: {
    label: 'Biochemical oxygen demand (BOD)',
    category: 'Chemical',
    unit: 'ppm',
    aliases: ['bod', 'biochemical_oxygen_demand'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Lab test (BOD)',        range: '0.0 – 1000000.0', unit: 'ppm' },
      { name: 'Unspecified equipment', range: '0.0 – 1000000.0', unit: 'ppm' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  calcium: {
    label: 'Calcium',
    category: 'Chemical',
    unit: 'mg/L',
    aliases: ['calcium'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Photometer',            range: '0.0 – 200000.0', unit: 'lux'  },
      { name: 'Unspecified equipment', range: '0.0 – 100000.0', unit: 'mg/L' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  chloride: {
    label: 'Chloride',
    category: 'Chemical',
    unit: 'mg/L',
    aliases: ['chloride'],
    qaSafe:    { min: 12, max: 1500 }, // WR: <12 or >1500 mg/L = needs review
    qaExtreme: { min: 0,  max: 3000 }, // WR: <0 or >3000 mg/L = issue detected
    equipment: [
      { name: 'Hach teststrips (high range)',       range: '250.0 – 7000.0',  unit: 'mg/L' },
      { name: 'Hach teststrips (low range)',        range: '25.0 – 650.0',    unit: 'mg/L' },
      { name: 'Mohr\'s silver nitrate method',      range: '0.0 – 25000.0',   unit: 'mg/L' },
      { name: 'Unspecified equipment',              range: '0.0 – 100000.0',  unit: 'mg/L' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  chlorine: {
    label: 'Chlorine',
    category: 'Chemical',
    unit: 'ppm',
    aliases: ['chlorine'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Taylor teststrips (chlorine)', range: '0.0 – 10.0',      unit: 'ppm' },
      { name: 'Unspecified equipment',        range: '0.0 – 1000000.0', unit: 'ppm' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  chlorophyll_a: {
    label: 'Chlorophyll-A',
    category: 'Chemical',
    unit: 'µg/L',
    aliases: ['chlorophyll_a', 'chlorophyll-a', 'chlorophyll a', 'chla'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Fluorometer (ng/µL)',   range: '0.0 – 100000.0', unit: 'ng/µL' },
      { name: 'Fluorometer (ppm)',     range: '0.0 – 100000.0', unit: 'ppm'   },
      { name: 'Fluorometer (µg/L)',    range: '0.0 – 1000.0',   unit: 'µg/L'  },
      { name: 'Unspecified equipment', range: '0.0 – 10000.0',  unit: 'mg/L'  },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  conductivity: {
    label: 'Conductivity',
    category: 'Chemical',
    unit: 'µS/cm',
    aliases: ['conductivity', 'specific_conductance', 'ec'],
    qaSafe:    { min: 10, max: 5000 },
    qaExtreme: { min: 2,  max: 25000 },
    equipment: [
      { name: 'HM Digital COM-100 multimeter',  range: '0.0 – 9990.0',     unit: 'μS/cm' },
      { name: 'Other pen-type meter',           range: '0.0 – 1000000.0',  unit: 'μS/cm' },
      { name: 'Unspecified equipment',          range: '0.0 – 1000000.0',  unit: 'μS/cm' },
      { name: 'Water Rangers pen-type meter',   range: '0.0 – 20000.0',    unit: 'μS/cm' },
      { name: 'YSI multimeter',                 range: '0.0 – 20000.0',    unit: 'μS/cm' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  doc: {
    label: 'Dissolved organic carbon',
    category: 'Chemical',
    unit: 'mg/L',
    aliases: ['doc', 'dissolved_organic_carbon'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Infrared detection method', range: '0.0 – 100.0',     unit: 'mg/L' },
      { name: 'Lab test (DOC)',            range: '0.0 – 100.0',     unit: 'mg/L' },
      { name: 'Unspecified equipment',     range: '0.0 – 1000000.0', unit: 'mg/L' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  hardness: {
    label: 'Hardness',
    category: 'Chemical',
    unit: 'mg/L',
    aliases: ['hardness'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'API 5-in-1 teststrips (carbonate hardness)', range: '0.0 – 240.0',   unit: 'mg/L' },
      { name: 'LaMotte (hardness)',                         range: '0.0 – 200.0',   unit: 'ppm'  },
      { name: 'Taylor teststrips (hardness)',               range: '0.0 – 800.0',   unit: 'ppm'  },
      { name: 'Unspecified equipment',                      range: '0.0 – 10000.0', unit: 'mg/L' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  nitrate: {
    label: 'Nitrate',
    category: 'Chemical',
    unit: 'mg/L',
    aliases: ['nitrate', 'nitrates', 'no3'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'API 5-in-1 teststrips',          range: '0.0 – 200.0',     unit: 'mg/L' },
      { name: 'Hach teststrips',                range: '0.0 – 50.0',      unit: 'mg/L' },
      { name: 'Hanna checker (high range)',     range: '0.0 – 75.0',      unit: 'ppm'  },
      { name: 'Hanna checker (low range)',      range: '0.0 – 5.0',       unit: 'ppm'  },
      { name: 'Kyoritsu Packtest (NO3-N)',      range: '0.0 – 10.0',      unit: 'mg/L' },
      { name: 'Spectrophotometer',              range: '0.0 – 100.0',     unit: 'mg/L' },
      { name: 'Unspecified equipment',          range: '0.0 – 1000.0',    unit: 'mg/L' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  nitrate_nitrogen: {
    label: 'Nitrate-nitrogen',
    category: 'Chemical',
    unit: 'mg/L',
    aliases: ['nitrate_nitrogen', 'nitrate-nitrogen', 'no3-n'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Kyoritsu Packtest',                 range: '0.0 – 10.0',      unit: 'mg/L' },
      { name: 'LaMotte (nitrate-nitrogen)',        range: '0.0 – 15.0',      unit: 'ppm'  },
      { name: 'Unspecified equipment',             range: '0.0 – 1000000.0', unit: 'mg/L' },
      { name: 'WaterWorks Nitrate/Nitrite strips', range: '0.0 – 50.0',      unit: 'mg/L' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  nitrite: {
    label: 'Nitrite',
    category: 'Chemical',
    unit: 'mg/L',
    aliases: ['nitrite', 'nitrites', 'no2'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'API 5-in-1 teststrips',  range: '0.0 – 10.0',     unit: 'mg/L' },
      { name: 'Hach teststrips',        range: '0.0 – 3.0',      unit: 'mg/L' },
      { name: 'Hanna checker',          range: '0.0 – 60000.0',  unit: 'mg/L' },
      { name: 'Other teststrips',       range: '0.0 – 10000.0',  unit: 'mg/L' },
      { name: 'Unspecified equipment',  range: '0.0 – 1000000.0',unit: 'mg/L' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  nitrite_nitrogen: {
    label: 'Nitrite-nitrogen',
    category: 'Chemical',
    unit: 'mg/L',
    aliases: ['nitrite_nitrogen', 'nitrite-nitrogen', 'no2-n'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'WaterWorks Nitrate/Nitrite strips', range: '0.0 – 10.0', unit: 'mg/L' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  oxygen: {
    label: 'Dissolved oxygen',
    category: 'Chemical',
    unit: 'mg/L',
    aliases: ['oxygen', 'dissolved_oxygen', 'do'],
    // WR has TWO QA rules: % saturation AND mg/L. We expose the mg/L
    // band as the headline qaSafe; the percent band lives below.
    qaSafe:    { min: 3, max: 12 },     // mg/L "needs review"
    qaExtreme: { min: 1, max: 14.99 },  // mg/L "issue detected"
    qaPercent: { safe: { min: 20, max: 120 }, extreme: { min: 0, max: 150 } },
    equipment: [
      { name: 'AZ instruments optical (%)',            range: '0.0 – 200.0', unit: '%'    },
      { name: 'AZ instruments optical (mg/L)',         range: '0.0 – 25.0',  unit: 'mg/L' },
      { name: 'Chemetrics ampoules',                   range: '0.0 – 12.0',  unit: 'mg/L' },
      { name: 'LaMotte (DO %)',                        range: '0.0 – 200.0', unit: '%'    },
      { name: 'LaMotte (DO mg/L)',                     range: '0.0 – 10.0',  unit: 'mg/L' },
      { name: 'YSI meter (%)',                         range: '0.0 – 150.0', unit: '%'    },
      { name: 'YSI multimeter (mg/L)',                 range: '0.0 – 20.0',  unit: 'mg/L' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  phosphate: {
    label: 'Phosphate',
    category: 'Chemical',
    unit: 'mg/L',
    aliases: ['phosphate', 'phosphates', 'po4'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Chemetrics ampoules (high range)', range: '10.0 – 100.0', unit: 'mg/L' },
      { name: 'Chemetrics ampoules (low range)',  range: '0.0 – 1.0',    unit: 'mg/L' },
      { name: 'Hanna checker (high range)',       range: '0.0 – 30.0',   unit: 'mg/L' },
      { name: 'Hanna checker (low range)',        range: '0.0 – 2.5',    unit: 'mg/L' },
      { name: 'Kyoritsu Packtest',                range: '0.0 – 2.0',    unit: 'mg/L' },
      { name: 'LaMotte (low range)',              range: '0.0 – 2.0',    unit: 'ppm'  },
      { name: 'Phosphate yellow method',          range: '0.0 – 100.0',  unit: 'ppb'  },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  total_phosphorus: {
    label: 'Total phosphorus',
    category: 'Chemical',
    unit: 'ppb',
    aliases: ['total_phosphorus', 'tp'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Ascorbic acid method',          range: '0.0 – 10000.0',   unit: 'ppb' },
      { name: 'Molybdenum blue method',        range: '0.0 – 100000.0',  unit: 'ppb' },
      { name: 'Persulfate digestion method',   range: '0.0 – 100.0',     unit: 'µg/L' },
      { name: 'Phosphate yellow method',       range: '0.0 – 100.0',     unit: 'ppb' },
      { name: 'Unspecified equipment',         range: '0.0 – 1000000.0', unit: 'ppb' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  salinity: {
    label: 'Salinity',
    category: 'Chemical',
    unit: 'ppth',
    aliases: ['salinity'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Other pen-type meter',                  range: '0.0 – 200.0',    unit: 'ppth' },
      { name: 'Water Rangers pen-type meter (ppm)',    range: '0.0 – 10000.0',  unit: 'ppm'  },
      { name: 'Water Rangers pen-type meter (ppth)',   range: '0.0 – 200.0',    unit: 'ppth' },
      { name: 'YSI multimeter',                        range: '0.0 – 80.0',     unit: 'ppth' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  tds: {
    label: 'Total dissolved solids (TDS)',
    category: 'Chemical',
    unit: 'ppm',
    aliases: ['tds', 'total_dissolved_solids'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Other pen-type meter',  range: '0.0 – 10000.0',   unit: 'ppm' },
      { name: 'Unspecified equipment', range: '0.0 – 1000000.0', unit: 'ppm' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  tss: {
    label: 'Total suspended solids (TSS)',
    category: 'Chemical',
    unit: 'mg/L',
    aliases: ['tss', 'total_suspended_solids'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Gravimetric method',    range: '0.0 – 20000.0',   unit: 'mg/L' },
      { name: 'Unspecified equipment', range: '0.0 – 1000000.0', unit: 'mg/L' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  turbidity: {
    label: 'Turbidity',
    category: 'Chemical',
    unit: 'NTU',
    aliases: ['turbidity', 'ntu'],
    qaSafe: null,        // WR doesn't publish a numeric needs-review band
    qaExtreme: null,
    equipment: [
      { name: 'Jackson Candle Turbidimeter', range: '25.0 – 1000.0',   unit: 'JTU' },
      { name: 'LaMotte (turbidity)',         range: '0.0 – 200.0',     unit: 'JTU' },
      { name: 'Portable turbidity meter',    range: '0.0 – 1000.0',    unit: 'NTU' },
      { name: 'Turbidity tube (120 cm)',     range: '0.0 – 14.0',      unit: 'NTU' },
      { name: 'Turbidity tube (45 cm)',      range: '14.0 – 240.0',    unit: 'NTU' },
      { name: 'Turbidity tube (50 cm)',      range: '12.0 – 240.0',    unit: 'NTU' },
      { name: 'Unspecified equipment',       range: '0.0 – 1000000.0', unit: 'NTU' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  water_temperature: {
    label: 'Water temperature',
    category: 'Chemical',
    unit: '°C',
    aliases: ['water_temperature', 'water_temp', 'temperature', 'temp'],
    qaSafe:    { min: 0,  max: 35 },
    qaExtreme: { min: -5, max: 40 },
    equipment: [
      { name: 'Digital thermometer',                range: '0.0 – 100.0',   unit: '°C' },
      { name: 'HM Digital COM-100 multimeter',      range: '0.0 – 55.0',    unit: '°C' },
      { name: 'Other multimeter',                   range: '-5.0 – 100.0',  unit: '°C' },
      { name: 'Other thermometer',                  range: '-100.0 – 100.0',unit: '°C' },
      { name: 'Water Rangers pen-type meter',       range: '-5.0 – 60.0',   unit: '°C' },
      { name: 'Water Rangers stream thermometer',   range: '-40.0 – 40.0',  unit: '°C' },
      { name: 'YSI multimeter',                     range: '-5.0 – 50.0',   unit: '°C' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  air_temperature: {
    label: 'Air temperature',
    category: 'Chemical',
    unit: '°C',
    aliases: ['air_temperature', 'air_temp'],
    qaSafe:    { min: -30, max: 45 },
    qaExtreme: { min: -45, max: 55 },
    equipment: [
      { name: 'Digital thermometer',          range: '0.0 – 100.0',     unit: '°C' },
      { name: 'Other thermometer',            range: '-100.0 – 100.0',  unit: '°C' },
      { name: 'Water Rangers / weather app',  range: '-40.0 – 40.0',    unit: '°C' },
      { name: 'Weather app',                  range: '-100.0 – 100.0',  unit: '°C' },
    ],
    whatIsIt: 'Context for the observation — air temperature is recorded alongside water samples. It is not itself a water-quality parameter.',
    whyImportant: null,
    bands: null,
    howToTest: null,
    sources: [WR_DOCS_URL],
  },

  // ──────────────── PHYSICAL ────────────────
  flow: {
    label: 'Flow',
    category: 'Physical',
    unit: 'm³/sec',
    aliases: ['flow', 'water_flow', 'discharge'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Bucket',                range: '0.0 – 100.0',     unit: 'm³/sec' },
      { name: 'Float',                 range: '0.0 – 100.0',     unit: 'm³/sec' },
      { name: 'Float (cfs)',           range: '0.0 – 10000000.0',unit: 'cfs'    },
      { name: 'Flow meter',            range: WR_NA,             unit: 'm³/sec' },
      { name: 'Other flow equipment',  range: WR_NA,             unit: 'L/s'    },
      { name: 'Unspecified equipment', range: '0.0 – 1000000.0', unit: 'm³/sec' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  secchi_depth: {
    label: 'Secchi depth (clarity)',
    category: 'Physical',
    unit: 'm',
    aliases: ['secchi_depth', 'secchi'],
    qaSafe:    { min: 0.1, max: 20 },
    qaExtreme: { min: 0,   max: 50 },
    equipment: [
      { name: 'Secchi disk (20 cm diameter)', range: '0.0 – 50.0',      unit: 'm' },
      { name: 'Secchi disk (30 cm diameter)', range: '0.0 – 50.0',      unit: 'm' },
      { name: 'Unspecified equipment',        range: '0.0 – 1000000.0', unit: 'm' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  water_depth: {
    label: 'Water depth',
    category: 'Physical',
    unit: 'm',
    aliases: ['water_depth', 'depth'],
    qaSafe:    { min: 0.1, max: 20 },
    qaExtreme: { min: 0,   max: 99 },
    equipment: [
      { name: 'Ruler (Imperial)',        range: '0.0 – 1000.0',   unit: 'ft' },
      { name: 'Ruler (metric)',          range: '0.0 – 1000.0',   unit: 'm'  },
      { name: 'Secchi disk (20 cm)',     range: '0.0 – 50.0',     unit: 'm'  },
      { name: 'Secchi disk (30 cm)',     range: '0.0 – 50.0',     unit: 'm'  },
      { name: 'YSI multimeter (depth)',  range: '0.0 – 300.0',    unit: 'm'  },
      { name: 'Unspecified equipment',   range: '0.0 – 1000000.0',unit: 'm'  },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  river_stage: {
    label: 'River stage',
    category: 'Physical',
    unit: 'm',
    aliases: ['river_stage', 'stage'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Ruler (Imperial)', range: '0.0 – 1000.0',    unit: 'ft' },
      { name: 'Ruler (metric)',   range: '0.0 – 1000.0',    unit: 'm'  },
      { name: 'Stage ruler',      range: '0.0 – 1000000.0', unit: 'm'  },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  // ──────────────── BIOLOGICAL ────────────────
  e_coli: {
    label: 'E. coli',
    category: 'Biological',
    unit: 'CFU/100 mL',
    aliases: ['e_coli', 'ecoli', 'e. coli'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: '3M Petrifilm Plates',          range: '0.0 – 10000.0',   unit: 'CFU/100 mL' },
      { name: 'Coliscan Easygel',             range: '0.0 – 1000000.0', unit: 'CFU/100 mL' },
      { name: 'Fluidion',                     range: '0.0 – 1000000.0', unit: 'CFU/100 mL' },
      { name: 'IDEXX Colilert 2000',          range: '0.0 – 25000.0',   unit: 'CFU/100 mL' },
      { name: 'IDEXX Colilert 5-sample Geomean', range: '0.0 – 25000.0',unit: 'CFU/100 mL' },
      { name: 'IDEXX Tecta',                  range: '0.0 – 25000.0',   unit: 'CFU/100 mL' },
      { name: 'Roth R-Card 1mL',              range: '0.0 – 25000.0',   unit: 'CFU/100 mL' },
      { name: 'Roth R-Card 3mL',              range: '0.0 – 25000.0',   unit: 'CFU/100 mL' },
      { name: 'Roth R-Card ECC',              range: '0.0 – 100000.0',  unit: 'CFU/100 mL' },
      { name: 'Roth R-Card ECC-A',            range: '0.0 – 100000.0',  unit: 'CFU/100 mL' },
      { name: 'Other lab test (CFU/100 mL)',  range: '0.0 – 10000000.0',unit: 'CFU/100 mL' },
      { name: 'Other lab test (MPN/100 mL)',  range: '0.0 – 1000000.0', unit: 'MPN/100 mL' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  enterococci: {
    label: 'Enterococci',
    category: 'Biological',
    unit: 'CFU/100 mL',
    aliases: ['enterococci'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'Membrane filtration',  range: '0.0 – 100000.0',     unit: 'CFU/100 mL' },
      { name: 'Most probable number', range: '0.0 – 100000.0',     unit: 'MPN/100 mL' },
      { name: 'Quantitative PCR',     range: '0.0 – 100000000.0',  unit: 'CE/100 mL'  },
      { name: 'Roth R-Card 1mL',      range: '0.0 – 1000000.0',    unit: 'CFU/100 mL' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },

  total_coliform: {
    label: 'Total coliform',
    category: 'Biological',
    unit: 'CFU/100 mL',
    aliases: ['total_coliform', 'total_coliforms'],
    qaSafe: null,
    qaExtreme: null,
    equipment: [
      { name: 'IDEXX Colilert 2000',  range: '0.0 – 100000.0',  unit: 'CFU/100 mL' },
      { name: 'Lab test',             range: '0.0 – 100000000.0',unit: 'CFU/100 mL' },
      { name: 'Roth R-Card',          range: '0.0 – 10000000.0',unit: 'CFU/100 mL' },
      { name: 'Roth R-Card ECC',      range: '0.0 – 1000000.0', unit: 'CFU/100 mL' },
      { name: 'Roth R-Card ECC-A',    range: '0.0 – 10000000.0',unit: 'CFU/100 mL' },
    ],
    whatIsIt: null, whyImportant: null, bands: null, howToTest: null,
    sources: [WR_DOCS_URL],
  },
}

// Export for direct table dumps if needed
export { WR_PARAMETERS }

// ── Lookup ──
// Tries: exact key → alias substring → label substring.
// Returns null when no match (UI then shows "Not specified by Water Rangers").
const WR_NON_WATER = /(^|[^a-z])(air|atmospheric|ambient|sky|cloud)([^a-z]|$)/i
export function getWRParameter(rawName) {
  if (!rawName) return null
  const s = String(rawName).toLowerCase().trim().replace(/_/g, ' ')

  // Allow air_temperature explicitly — it has its own entry.
  // For everything else, reject air-named tokens that would mis-match water_temp.
  if (WR_NON_WATER.test(s) && !s.includes('air temperature') && !s.includes('air temp')) {
    if (s.includes('air')) return WR_PARAMETERS.air_temperature || null
  }

  for (const [key, def] of Object.entries(WR_PARAMETERS)) {
    if (key === s.replace(/\s+/g, '_')) return { key, ...def }
    if (def.aliases && def.aliases.some(a => {
      const al = a.toLowerCase()
      // whole-token-ish match
      const re = new RegExp(`(^|[^a-z0-9])${al.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i')
      return re.test(s)
    })) return { key, ...def }
  }
  // last resort: label substring
  for (const [key, def] of Object.entries(WR_PARAMETERS)) {
    if (s.includes(def.label.toLowerCase())) return { key, ...def }
  }
  return null
}

// Render-friendly "safe range" string for the existing PARAM_GUIDE shape.
// Returns null when WR doesn't publish a band — caller renders WR_NA.
export function formatQaRange(qa, unit = '') {
  if (!qa) return null
  const u = unit ? ` ${unit}` : ''
  if (qa.min != null && qa.max != null) return `${qa.min} – ${qa.max}${u}`
  if (qa.min != null) return `≥ ${qa.min}${u}`
  if (qa.max != null) return `≤ ${qa.max}${u}`
  return null
}

// Adapter that returns the legacy PARAM_GUIDE shape used by Alerts.jsx.
// Every value is either WR-cited or null (which we render as WR_NA upstream).
export function legacyGuideForParameter(rawName) {
  const wr = getWRParameter(rawName)
  if (!wr) {
    return {
      unit: '',
      safe: WR_NA,
      ideal: WR_NA,
      hint: WR_NA,
      typicalAlgoma: WR_NA,
      _wr: null,
    }
  }
  const safeStr = formatQaRange(wr.qaSafe, wr.unit)
  const extremeStr = formatQaRange(wr.qaExtreme, wr.unit)
  const hintBits = []
  if (safeStr)     hintBits.push(`Water Rangers QA "needs review" band: ${safeStr}.`)
  if (extremeStr)  hintBits.push(`"Issue detected" outside ${extremeStr}.`)
  if (wr.whyImportant) hintBits.push(wr.whyImportant)
  return {
    unit: wr.unit || '',
    safe: safeStr || WR_NA,
    ideal: safeStr || WR_NA,            // WR doesn't publish "ideal"; fall back to QA band or WR_NA
    hint: hintBits.length ? hintBits.join(' ') : WR_NA,
    typicalAlgoma: WR_NA,               // WR has no Algoma-specific values
    _wr: wr,
  }
}
