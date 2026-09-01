// ── Plain-English parameter explainers ──────────────────────────────────────
// OUR OWN teaching layer, written for community members, students and new
// volunteers. This is general water-science education in plain language — it is
// NOT Water Rangers content and must never be presented as theirs. Keep the two
// separate: WR facts (bands, equipment, their published text) live in
// wrParameters.js and stay attributed to Water Rangers; this file is our
// plain-language explainer on top.
//
// HONESTY RULES (match the spirit of wrParameters.js):
//   • No invented thresholds or site numbers. Where a number would be needed,
//     speak in directions ("higher tends to…", "very low can…"), not values.
//     The only real numbers the UI shows come from the reading itself and from
//     Water Rangers' published bands.
//   • "high"/"low" describe the general meaning of the direction, not a verdict
//     on a specific site.
//
// fields per parameter:
//   plain     one or two sentences: what this actually is, in everyday words
//   whyCare   why a community member / swimmer / angler should care
//   highMeans what an unusually HIGH reading tends to indicate (direction only)
//   lowMeans  what an unusually LOW reading tends to indicate (direction only)

const PLAIN = {
  oxygen: {
    plain: 'Dissolved oxygen (DO) is the amount of oxygen gas mixed into the water — the very oxygen that fish, insects and other aquatic life breathe through their gills.',
    whyCare: 'It is one of the single best signs of whether a water body can support healthy life. Cold, moving, well-mixed water usually holds more oxygen; warm, still or polluted water holds less.',
    highMeans: 'Very high DO is usually healthy, though extreme spikes can come from heavy algae photosynthesis on a sunny afternoon.',
    lowMeans: 'Low DO is the warning sign — it stresses and can suffocate fish. It often follows warm temperatures, decaying organic matter, sewage, or fertiliser run-off feeding algae that use up the oxygen at night.',
  },
  alkalinity: {
    plain: 'Alkalinity is the water\'s built-in ability to absorb acid without its pH crashing — think of it as the water\'s "shock absorber" against sudden acid changes.',
    whyCare: 'Good alkalinity keeps pH stable, which keeps fish and insects in the comfort zone they can survive in. Water with low alkalinity is fragile: one acid rain event or spill can swing its pH dangerously.',
    highMeans: 'Higher alkalinity means stronger buffering and usually harder water — common in limestone-rich areas and generally protective, though very high values can point to certain mineral or wastewater inputs.',
    lowMeans: 'Low alkalinity means the water is poorly buffered and vulnerable to acid shock, which can harm sensitive species.',
  },
  ph: {
    plain: 'pH is the acid-to-base scale from 0 to 14. 7 is neutral, below 7 is acidic, above 7 is basic (alkaline). Most healthy fresh water sits a little either side of neutral.',
    whyCare: 'Aquatic life has a fairly narrow pH comfort band. Readings far from neutral can injure gills, free up toxic metals, and tip the whole food web.',
    highMeans: 'High (basic) pH can come from heavy algae growth, certain rocks, or discharges, and can make ammonia more toxic.',
    lowMeans: 'Low (acidic) pH can come from acid rain, mine drainage or organic acids in wetlands, and can be harmful to eggs and young fish.',
  },
  water_temperature: {
    plain: 'Water temperature is simply how warm or cold the water is — but it quietly controls almost everything else in the system.',
    whyCare: 'Warmer water holds less oxygen and speeds up algae and bacteria. Many fish (like trout) need cold water and suffer as it warms. It sets the pace for the whole ecosystem.',
    highMeans: 'High temperatures often mean less oxygen, more algae, and stress for cold-water species — and can be worsened by removed shade, shallow flow, or warm run-off.',
    lowMeans: 'Very low temperatures slow biological activity; usually not harmful on their own, and cold water tends to carry more oxygen.',
  },
  conductivity: {
    plain: 'Conductivity measures how well the water carries an electrical current, which tells you how many dissolved salts and minerals (ions) are in it.',
    whyCare: 'It is a fast, cheap "fingerprint" of the water. A sudden jump can flag road salt, a spill, or wastewater long before you\'d see it any other way.',
    highMeans: 'High conductivity means lots of dissolved salts/minerals — think winter road salt, agricultural run-off, or industrial discharge.',
    lowMeans: 'Low conductivity means very few dissolved minerals — typical of rain-fed, pristine, or granite-country water.',
  },
  turbidity: {
    plain: 'Turbidity is how cloudy or murky the water is, caused by tiny suspended particles of soil, algae or organic matter.',
    whyCare: 'Cloudy water blocks sunlight that plants need, can clog fish gills, and often carries attached nutrients and bacteria. Clear water is not automatically clean, but sudden cloudiness is a red flag.',
    highMeans: 'High turbidity usually follows rain, erosion, construction, or an algae bloom stirring particles into the water.',
    lowMeans: 'Low turbidity means clear water with few suspended particles.',
  },
  secchi_depth: {
    plain: 'Secchi depth measures water clarity: you lower a black-and-white disk until it just disappears, and record how deep it went. Deeper reading = clearer water.',
    whyCare: 'It is a simple, powerful measure of how much light reaches into the water and how much algae or sediment is floating in it.',
    highMeans: 'A deeper (larger) Secchi reading means clearer water and usually less algae or sediment.',
    lowMeans: 'A shallow (small) reading means murky water — often an algae bloom or lots of stirred-up sediment.',
  },
  water_depth: {
    plain: 'Water depth is the depth of the water at a fixed sampling point, measured consistently over time.',
    whyCare: 'Depth naturally rises and falls with the seasons. Tracking the highs (often spring) and lows (often late summer) reveals drought or flood years and affects habitat like fish-spawning areas.',
    highMeans: 'Unusually high depth can point to a wet season, heavy run-off, or a flood year.',
    lowMeans: 'Unusually low depth can point to drought and can concentrate pollutants and warm the water faster.',
  },
  nitrate: {
    plain: 'Nitrate is a dissolved form of nitrogen — a plant nutrient that occurs naturally but climbs sharply with fertiliser, manure and sewage inputs.',
    whyCare: 'Too much nitrate over-feeds algae and weeds (a process called eutrophication) that later rot and strip oxygen from the water. High nitrate is also a drinking-water health concern.',
    highMeans: 'High nitrate usually points to farm run-off, septic or sewage inputs, or fertilised lawns nearby.',
    lowMeans: 'Low nitrate is generally healthy for surface water.',
  },
  nitrite: {
    plain: 'Nitrite is an in-between form of nitrogen that appears as bacteria convert ammonia toward nitrate.',
    whyCare: 'It is usually low in healthy water; a spike can signal fresh pollution or a stalled nitrogen cycle, and it is toxic to fish.',
    highMeans: 'High nitrite can flag recent sewage or fertiliser input, or low-oxygen conditions interrupting the nitrogen cycle.',
    lowMeans: 'Low nitrite is normal and expected.',
  },
  phosphate: {
    plain: 'Phosphate is the dissolved, plant-available form of phosphorus — often the single nutrient that limits how much algae a fresh water body can grow.',
    whyCare: 'Because it is the limiting nutrient, even small increases can trigger big algae blooms that later rot and remove oxygen. Sources include detergents, fertiliser and wastewater.',
    highMeans: 'High phosphate strongly points to fertiliser run-off, wastewater, or detergents, and a bloom risk.',
    lowMeans: 'Low phosphate generally limits algae growth and is typical of healthier water.',
  },
  total_phosphorus: {
    plain: 'Total phosphorus counts all the phosphorus in the water — dissolved and bound to particles — as an overall nutrient-load measure.',
    whyCare: 'It is a standard yardstick for how nutrient-enriched (and bloom-prone) a lake or river is.',
    highMeans: 'High total phosphorus indicates a nutrient-rich, bloom-prone system, usually from run-off or wastewater.',
    lowMeans: 'Low total phosphorus indicates a nutrient-poor, generally clearer system.',
  },
  chloride: {
    plain: 'Chloride is a dissolved salt ion. In cold regions its biggest source by far is winter road salt washing into streams.',
    whyCare: 'Freshwater life is not built for salty water. Rising chloride is a growing problem near roads and cities and does not easily leave the system.',
    highMeans: 'High chloride usually means road salt, water-softener discharge, or industrial/wastewater inputs.',
    lowMeans: 'Low chloride is normal for inland fresh water.',
  },
  salinity: {
    plain: 'Salinity is the total saltiness of the water.',
    whyCare: 'It defines which organisms can live there, and shifts matter most in estuaries and coastal waters where fresh and salt water mix.',
    highMeans: 'Rising salinity in fresh water can come from saltwater intrusion, road salt, or evaporation in drought.',
    lowMeans: 'Low salinity is expected in fresh water.',
  },
  hardness: {
    plain: 'Hardness measures dissolved calcium and magnesium — the minerals that leave scale in a kettle.',
    whyCare: 'Moderate hardness helps buffer pH and can reduce the toxicity of some metals to fish; it also reflects the local geology.',
    highMeans: 'High hardness is typical of limestone areas and is generally not harmful.',
    lowMeans: 'Soft (low-hardness) water is often more sensitive to acid and metal pollution.',
  },
  tds: {
    plain: 'Total dissolved solids (TDS) is the combined weight of everything dissolved in the water — salts, minerals and small organics.',
    whyCare: 'It is a broad measure of water "purity" and, like conductivity, a quick way to spot a change in what is entering the water.',
    highMeans: 'High TDS points to lots of dissolved material — run-off, salts, or wastewater.',
    lowMeans: 'Low TDS indicates very pure, lightly mineralised water.',
  },
  chlorine: {
    plain: 'Chlorine is a strong disinfectant. In natural water it usually points to treated drinking water, pool water, or a wastewater discharge — it is not normally present in a healthy stream or lake.',
    whyCare: 'Even small amounts are toxic to fish, insects and the tiny life at the base of the food web. Finding it in open water is a red flag that treated or pool water is getting in.',
    highMeans: 'High chlorine usually means a discharge of treated, pool, or wastewater nearby.',
    lowMeans: 'Little to no chlorine is normal and expected for natural surface water.',
  },
  ammonia: {
    plain: 'Ammonia is a nitrogen compound that comes from sewage, manure, fertiliser and decaying matter.',
    whyCare: 'It is directly toxic to fish, especially when the water is warm or basic (high pH), which makes it more poisonous.',
    highMeans: 'High ammonia is a strong sign of fresh sewage, manure or fertiliser pollution.',
    lowMeans: 'Low ammonia is normal and healthy.',
  },
  e_coli: {
    plain: 'E. coli is a bacterium that lives in the guts of warm-blooded animals. It is measured as an indicator that fecal contamination — and possibly disease-causing germs — is present.',
    whyCare: 'High E. coli is the main reason beaches close. It signals sewage or animal waste and a real risk to anyone swimming or drinking untreated water.',
    highMeans: 'High E. coli points to sewage overflow, failing septic systems, livestock, or heavy waterfowl — often right after rain.',
    lowMeans: 'Low E. coli means little detectable fecal contamination at the time of sampling.',
  },
  total_coliform: {
    plain: 'Total coliforms are a broad group of bacteria used as a general cleanliness indicator; most are harmless but their presence flags conditions where germs could survive.',
    whyCare: 'A rise is an early, cheap warning to look closer (for example with an E. coli test) before assuming the water is safe.',
    highMeans: 'High total coliform suggests surface contamination or nutrient-rich conditions worth investigating.',
    lowMeans: 'Low total coliform is expected in clean, well-flushed water.',
  },
}

// Same matching approach as wrParameters: try key, then loose alias/label.
export function getPlainEnglish(rawName) {
  if (!rawName) return null
  const s = String(rawName).toLowerCase().trim()
  const key = s.replace(/\s+/g, '_')
  if (PLAIN[key]) return PLAIN[key]
  // loose contains match on the key words
  for (const k of Object.keys(PLAIN)) {
    if (s.includes(k.replace(/_/g, ' ')) || s.includes(k)) return PLAIN[k]
  }
  // common aliases
  if (/dissolved.?oxygen|(^|[^a-z])do([^a-z]|$)/.test(s)) return PLAIN.oxygen
  if (/temp/.test(s) && !/air/.test(s)) return PLAIN.water_temperature
  if (/clarity|secchi/.test(s)) return PLAIN.secchi_depth
  if (/conduct/.test(s)) return PLAIN.conductivity
  if (/chlorine/.test(s)) return PLAIN.chlorine
  if (/phosphate/.test(s)) return PLAIN.phosphate
  if (/phosphor/.test(s)) return PLAIN.total_phosphorus // "total phosphorus", "phosphorus"
  if (/nitrate/.test(s)) return PLAIN.nitrate
  return null
}

export default PLAIN
