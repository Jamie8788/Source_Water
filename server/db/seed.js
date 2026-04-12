const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const db = require('./connection')

async function seed() {
  // Always ensure admin exists and is active
  const adminExists = await db.get('SELECT id FROM users WHERE username = ?', ['admin'])
  if (!adminExists) {
    const hash = bcrypt.hashSync('nordik2026', 10)
    await db.run(
      `INSERT INTO users (username,email,password_hash,display_name,role,avatar_emoji,avatar_bg_color,is_admin,is_active,onboarding_completed)
       VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
      ['admin','info@nordikinstitute.com',hash,'SOURCE Water Admin','SOURCE Water team member','🌊','#0ea5e9',1,1,1])
    console.log('✅ Admin user created: admin / nordik2026')
  } else {
    // Always ensure admin stays active and has admin privileges
    await db.run(
      `UPDATE users SET is_active=1, is_admin=1, onboarding_completed=1 WHERE username='admin'`)
    console.log('✅ Admin user verified/restored')
  }

  // Also reactivate the Supabase-linked admin account (admin@sourcewater.app)
  // This is the local user created when admin logs in via Supabase auth
  await db.run(
    `UPDATE users SET is_active=1, is_admin=1, onboarding_completed=1 WHERE email='admin@sourcewater.app'`)

  // Remove admin emails from banned list in case of accidental self-deletion
  await db.run(
    `DELETE FROM banned_emails WHERE email IN ('info@nordikinstitute.com','admin@sourcewater.app','admin')`
  ).catch(() => {})

  const existing = await db.get('SELECT COUNT(*) as c FROM users', [])
  if (parseInt(existing?.c ?? 0) > 1) return console.log('DB already seeded.')

  console.log('Seeding database...')

  // Communities
  const comms = ['Huron Shores','Thessalon','Sault Ste. Marie','Bruce Mines','Blind River','Elliot Lake','Iron Bridge','Wawa','White River','Chapleau','Hearst','Kapuskasing','Spanish','Manitoulin Island','Timmins']
  for (const c of comms) {
    await db.run('INSERT INTO communities (name) VALUES (?) ON CONFLICT DO NOTHING', [c])
  }

  // Site settings defaults
  const settings = {
    'site.title': 'SOURCE Water',
    'site.subtitle': 'Water Quality Engagement Platform',
    'site.tagline': 'Protecting Ontario\'s Water Together',
    'site.description': 'Monitor, learn, and collaborate on water quality across Northern Ontario watersheds.',
    'site.contact': 'info@nordikinstitute.com',
    'site.sponsor_url': 'https://nordikinstitute.com/contact/',
    'mascot.landing': 'Hi! I\'m Water 💧 To get started, create an account. I\'m excited to meet another water protector!',
    'mascot.dashboard': 'Welcome back! Check out the latest water quality data from your community.',
    'mascot.map': 'Explore monitoring sites across Northern Ontario! Click any marker to see water quality data.',
    'mascot.quiz': 'Test your water knowledge! Every correct answer earns you XP and helps you become a water quality expert!',
    'mascot.social': 'Share your water observations, ask questions, and connect with other water protectors!',
    'mascot.ai': 'Ask me anything about water quality! I\'m here to help you understand our lakes and rivers.',
    'mascot.games': 'Let\'s play and learn! These games teach real water quality concepts in a fun way!',
    'alerts.header': 'Water Quality Alerts',
    'alerts.description': 'Stay informed about water quality conditions across Northern Ontario monitoring sites.',
    'reports.header': 'Water Quality Reports',
    'reports.description': 'Generate comprehensive water quality reports for sites and regions.',
    'nordik.logo': '',
  }
  for (const [k, v] of Object.entries(settings)) {
    await db.run(
      'INSERT INTO site_settings (key,value) VALUES (?,?) ON CONFLICT DO NOTHING',
      [k, JSON.stringify(v)])
  }

  // Default resources
  const resources = [
    ['Water Rangers Training Protocol','Official training protocol for Water Rangers volunteer monitoring program','Guide','https://waterrangers.ca','Training','["water rangers","training","volunteer"]',1],
    ['Ontario PWQO Standards','Provincial Water Quality Objectives — Ontario Ministry of Environment','Standards','https://www.ontario.ca/page/water-quality-ontario','Standards','["PWQO","Ontario","regulations"]',1],
    ['CCME Water Quality Guidelines','Canadian Council of Ministers of the Environment water quality guidelines','Standards','https://www.ccme.ca/en/res/ceqg-rcqe_e.pdf','Standards','["CCME","Canada","guidelines"]',1],
    ['Great Lakes Datastream','Access water quality data from across the Great Lakes basin','Data','https://greatlakesdatastream.ca','Data','["Great Lakes","datastream","open data"]',1],
    ['First Nations Water Resources (IISD)','Indigenous and Northern Affairs water resources and stewardship information','Guide','https://www.iisd.org/topic/water','Indigenous','["First Nations","TEK","stewardship"]',1],
  ]
  for (const r of resources) {
    await db.run(
      `INSERT INTO resources (title,description,resource_type,external_url,category,tags,created_by) VALUES (?,?,?,?,?,?,?)`,
      r)
  }

  // 5 Pre-made quizzes with full questions
  await seedQuizzes()

  // Sample monitoring sites in Northern Ontario
  const params = JSON.stringify(['ph','dissolved_oxygen','turbidity','conductivity','water_temp'])
  const sites = [
    ['Garden River Site A',46.4833,-84.0833,'Garden River','River','Low','Sault Ste. Marie',params,1],
    ['Lake Huron Shore Station',46.5200,-84.3500,'Lake Huron','Lake','Low','Sault Ste. Marie',params,1],
    ['Mississagi River Monitor',46.0167,-83.0500,'Mississagi River','River','Medium','Blind River',params,1],
    ['Thessalon River Site',46.2500,-83.5500,'Thessalon River','River','Low','Thessalon',params,1],
    ['Chapleau Crown Game Preserve',47.8333,-83.4000,'Chapleau River','River','Medium','Chapleau',params,1],
  ]
  for (const s of sites) {
    await db.run(
      `INSERT INTO sites (name,latitude,longitude,body_of_water,water_body_type,access_risk,community,parameters_tested,created_by) VALUES (?,?,?,?,?,?,?,?,?)`,
      s)
  }

  // AI Knowledge base
  await seedKnowledgeBase()

  // Default sponsor
  await db.run(
    `INSERT INTO sponsors (name,website_url,tagline,tier,placement,status) VALUES (?,?,?,?,?,?)`,
    ['NORDIK Institute','https://nordikinstitute.com/contact/','Research for People & Planet','Gold',
      JSON.stringify(['Dashboard','Sidebar','All Pages']),'active'])

  console.log('✅ Database seeded successfully!')
}

async function seedQuizzes() {
  const quizzes = [
    {
      meta: ['Water Quality Fundamentals','Test your knowledge of essential water quality parameters and concepts.','Water Quality','Beginner',60,70,'published',1],
      questions: [
        ['mcq','What is the safe pH range for drinking water according to WHO guidelines?',
          JSON.stringify(['4.0–6.0','6.5–8.5','8.5–10.0','5.0–7.0']),'[1]',
          'WHO recommends a pH of 6.5–8.5 for safe drinking water. Outside this range, water may taste unpleasant and corrode pipes.',2],
        ['mcq','What does DO stand for in water quality monitoring?',
          JSON.stringify(['Dissolved Odor','Dissolved Oxygen','Daily Output','Deep Ocean']),'[1]',
          'Dissolved Oxygen (DO) measures how much oxygen is dissolved in water. Healthy aquatic life requires adequate DO levels, typically above 7 mg/L.',1],
        ['true_false','Turbidity measures the clarity of water.',
          JSON.stringify(['True','False']),'[0]',
          'True! Turbidity measures how clear water is by quantifying suspended particles. Higher turbidity means cloudier water, which can harbor pathogens.',1],
        ['mcq','Which parameter measures how well water conducts electricity?',
          JSON.stringify(['Turbidity','pH','Conductivity','Alkalinity']),'[2]',
          'Conductivity measures the water\'s ability to conduct electricity, which reflects the amount of dissolved ions (salts, minerals).',1],
        ['mcq','What E.coli count per 100mL makes water unsafe for swimming in Ontario?',
          JSON.stringify(['Over 1 CFU/100mL','Over 100 CFU/100mL','Over 200 CFU/100mL','Over 400 CFU/100mL']),'[3]',
          'Ontario guidelines suggest water is unsafe for swimming when E.coli exceeds 200 CFU/100mL for a single sample or 100 CFU/100mL as a geometric mean.',2],
        ['mcq','What does eutrophication mean?',
          JSON.stringify(['Water freezing','Excessive nutrient enrichment causing algal overgrowth','Water becoming salty','Decrease in fish populations']),'[1]',
          'Eutrophication occurs when a water body receives excess nutrients (phosphorus, nitrogen), leading to algal blooms, oxygen depletion, and ecosystem harm.',2],
        ['true_false','Phosphorus is the primary nutrient driving eutrophication in most Ontario lakes.',
          JSON.stringify(['True','False']),'[0]',
          'True! Phosphorus is typically the limiting nutrient in Ontario freshwater systems. Even small increases can trigger algal blooms.',1],
        ['mcq','What is the PWQO for total phosphorus in Ontario lakes?',
          JSON.stringify(['0.01 mg/L','0.03 mg/L','0.1 mg/L','1.0 mg/L']),'[1]',
          'Ontario\'s Provincial Water Quality Objective (PWQO) for total phosphorus is 0.03 mg/L (30 µg/L) for most lakes to prevent eutrophication.',2],
        ['matching','Match the water quality parameter to what it measures.',
          JSON.stringify(['pH','Turbidity','Conductivity','Dissolved Oxygen']),
          JSON.stringify(['Acidity or alkalinity','Water clarity','Dissolved ions/salts','Oxygen available for aquatic life']),
          'Each parameter measures a specific water property. Together, they give a complete picture of water health.',3],
        ['mcq','Which Northern Ontario river drains into Lake Huron near Sault Ste. Marie?',
          JSON.stringify(['Ottawa River','Garden River','Trent River','Rideau River']),'[1]',
          'The Garden River flows from the Canadian Shield and empties into Lake Huron near Sault Ste. Marie, passing through Garden River First Nation territory.',2],
        ['true_false','Higher water temperature generally means more dissolved oxygen.',
          JSON.stringify(['True','False']),'[1]',
          'False! Warmer water holds LESS dissolved oxygen. This is why summer fish kills occur — warm water + decomposing algae deplete oxygen to lethal levels.',2],
        ['mcq','What does CCME stand for?',
          JSON.stringify(['Canadian Council of Municipal Engineers','Canadian Council of Ministers of the Environment','Canadian Centre for Marine Ecology','Conservation Canada Management Ecology']),'[1]',
          'CCME (Canadian Council of Ministers of the Environment) sets national environmental quality guidelines including water quality standards used across Canada.',1],
        ['mcq','Which indicator bacteria is most commonly tested to assess fecal contamination?',
          JSON.stringify(['Salmonella','E.coli','Legionella','Cryptosporidium']),'[1]',
          'E.coli (Escherichia coli) is the primary indicator of fecal contamination in water. Its presence suggests potential pathogens from human or animal waste.',2],
        ['mcq','What is a watershed?',
          JSON.stringify(['An underground storage tank','An area of land draining into a single water body','A type of water filter','A dam structure']),'[1]',
          'A watershed is all the land that drains into a particular body of water. Everything that happens on the land affects the watershed\'s water quality.',2],
        ['ordering','Order these steps for responding to a water quality exceedance:',
          JSON.stringify(['Collect additional confirmation samples','Issue public advisory if confirmed','Notify Ministry of Environment','Document the initial exceedance reading','Investigate the source']),
          JSON.stringify([3,0,4,2,1]),
          'The standard response protocol: document → resample → investigate source → notify authorities → issue public advisory if confirmed.',3],
      ]
    },
    {
      meta: ['Field Sampling Procedures','Learn proper water sampling protocols for reliable results.','Field Work','Intermediate',60,70,'published',1],
      questions: [
        ['mcq','Where should you collect a water sample in a river?',
          JSON.stringify(['At the water\'s edge where it\'s easiest','15–30cm below the surface away from the bank','At the river bottom','From a pool of still water']),'[1]',
          'Samples should be collected 15-30cm below the surface, away from banks and stagnant areas, facing upstream to minimize disturbance and get representative samples.',2],
        ['mcq','Why must sample bottles be rinsed with site water before collection?',
          JSON.stringify(['To save distilled water','To remove any contaminants or residues from the bottle','To warm the bottle','Because regulations require it']),'[1]',
          'Rinsing with site water removes any residual chemicals (like lab detergents) that could interfere with your sample results.',2],
        ['true_false','Temperature should be measured in the lab after bringing samples back.',
          JSON.stringify(['True','False']),'[1]',
          'False! Temperature MUST be measured in the field immediately upon sample collection. Temperature changes during transport render the measurement useless.',2],
        ['mcq','What is chain of custody in water sampling?',
          JSON.stringify(['A lock for your equipment box','Documentation tracking sample handling from collection to lab analysis','The order in which you sample multiple sites','A type of filtration method']),'[1]',
          'Chain of custody ensures samples are properly tracked and handled, maintaining sample integrity and legal defensibility of results.',2],
        ['mcq','How long is the holding time for an E.coli sample before analysis?',
          JSON.stringify(['6 hours','24 hours','48 hours','72 hours']),'[1]',
          'E.coli samples must be analyzed within 24 hours of collection and kept at 4°C during transport to maintain accuracy.',2],
        ['mcq','Before measuring pH with an electrode, you should:',
          JSON.stringify(['Test it in clean water','Calibrate with buffer solutions','Let it air dry','Store it in alcohol']),'[1]',
          'pH meters must be calibrated with buffer solutions (typically pH 4, 7, and 10) before each use to ensure accurate readings.',2],
        ['true_false','Sampling upstream before downstream in a monitoring program reduces risk of cross-contamination.',
          JSON.stringify(['True','False']),'[0]',
          'True! Always sample upstream first to avoid introducing contamination from your own activity. This is especially important when wading in streams.',2],
        ['multiple_select','Which safety precautions should you take when sampling near fast-moving water? (Select all that apply)',
          JSON.stringify(['Wear a personal flotation device (PFD)','Work alone','Inform someone of your location','Wear appropriate footwear with grip','Use a throw rope if available']),'[0,2,3,4]',
          'Never work alone near fast water. Always wear a PFD, proper footwear, carry safety equipment, and inform others of your plans.',3],
        ['mcq','What does a Secchi disk measure?',
          JSON.stringify(['Water pH','Water transparency/clarity','Water depth','Water temperature']),'[1]',
          'A Secchi disk is a white disk lowered into water to measure transparency. The depth at which it disappears indicates water clarity.',1],
        ['ordering','Put these field sampling steps in correct order:',
          JSON.stringify(['Record site conditions and GPS','Collect samples in labeled bottles','Rinse bottles with site water','Calibrate equipment','Transport samples on ice to lab']),
          JSON.stringify([3,0,2,1,4]),
          'Calibrate equipment first, then record conditions, rinse bottles, collect samples, then transport on ice to maintain sample integrity.',3],
        ['true_false','Nitrile gloves should be worn when collecting water samples.',
          JSON.stringify(['True','False']),'[0]',
          'True! Nitrile gloves prevent skin oils, contaminants, and bacteria from your hands from contaminating samples.',1],
        ['mcq','What is the purpose of a field blank in water quality sampling?',
          JSON.stringify(['A backup sample bottle','Deionized water processed like a sample to check for contamination during collection','A form for recording missing data','An empty bottle for waste']),'[1]',
          'A field blank (deionized water handled like a sample) helps identify contamination introduced during the sampling process itself, ensuring result reliability.',2],
      ]
    },
    {
      meta: ['Reading Water Reports','Understand how to interpret water quality reports and data.','Data Literacy','Intermediate',90,70,'published',1],
      questions: [
        ['mcq','What does "exceedance" mean in a water quality report?',
          JSON.stringify(['A result above the guideline or standard value','A missing data point','An error in measurement','A value below detection limit']),'[0]',
          'An exceedance means a measured value has exceeded (gone above) the applicable guideline, objective, or standard, indicating a potential concern.',2],
        ['mcq','What does "<0.001 mg/L" in a lab report mean?',
          JSON.stringify(['The exact value is 0.001 mg/L','The value is below the method detection limit','The sample was lost','The parameter was not tested']),'[1]',
          'Values reported as "<MDL" or "<0.001" mean the concentration was below what the instrument can reliably detect — not necessarily zero.',2],
        ['true_false','A single E.coli exceedance always means the water is permanently unsafe.',
          JSON.stringify(['True','False']),'[1]',
          'False! A single exceedance triggers resampling and investigation. Geometric mean over multiple samples determines ongoing risk, following established protocols.',2],
        ['mcq','What is the Water Quality Index (WQI)?',
          JSON.stringify(['A single number summarizing overall water quality','The average pH over a year','A count of species in the water','A temperature measurement']),'[0]',
          'The WQI aggregates multiple parameters into a single 0-100 score (CCME method), making it easy to communicate overall water quality to the public.',2],
        ['mcq','In a CCME report, what score range indicates "Excellent" water quality?',
          JSON.stringify(['0–44','45–64','65–79','80–100']),'[3]',
          'CCME WQI: Excellent=95-100, Good=80-94, Fair=65-79, Marginal=45-64, Poor=0-44. Higher scores = better quality.',2],
        ['true_false','Geometric mean is used for E.coli results because the data is often log-normally distributed.',
          JSON.stringify(['True','False']),'[0]',
          'True! Bacterial counts vary by orders of magnitude, so geometric mean (log scale average) better represents central tendency than arithmetic mean.',2],
        ['mcq','What does "ND" mean in a water quality data table?',
          JSON.stringify(['No Data collected','Non-Detectable (below detection limit)','Normal Data','Not Determined yet']),'[1]',
          'ND = Non-Detectable. The parameter was tested but the concentration was below the laboratory\'s detection limit.',1],
        ['mcq','A conductivity reading of 800 µS/cm in a lake normally ranging 50-150 µS/cm suggests:',
          JSON.stringify(['Normal conditions','Possible salt contamination or industrial discharge','Equipment malfunction only','Good mineral content']),'[1]',
          'A sudden spike in conductivity indicates elevated dissolved ions — possibly road salt runoff, industrial discharge, or septic system influence.',3],
        ['mcq','What information does a box plot NOT directly show?',
          JSON.stringify(['Median value','Interquartile range','Exact mean value','Data spread/outliers']),'[2]',
          'Box plots show median, quartiles, and outliers but do NOT directly show the arithmetic mean. A dot or star is sometimes added to indicate mean.',2],
        ['short_answer','What is the primary purpose of the Ontario PWQO (Provincial Water Quality Objectives)?',
          null,'["protect aquatic life"]',
          'PWQOs set minimum acceptable levels to protect aquatic life and ecosystem health in Ontario surface waters. They inform assessment and remediation decisions.',3],
      ]
    },
    {
      meta: ['Aquatic Ecosystems','Explore the living world of Northern Ontario\'s lakes and rivers.','Ecology','Beginner',60,70,'published',1],
      questions: [
        ['mcq','Macroinvertebrates are used as bioindicators because:',
          JSON.stringify(['They are easy to see','They reflect long-term water quality conditions','They are fish food','They live only in clean water']),'[1]',
          'Macroinvertebrates (aquatic insects, worms, snails) are sedentary and live for months/years, so their presence/absence reflects cumulative water quality.',2],
        ['mcq','Which macroinvertebrate group indicates the best water quality?',
          JSON.stringify(['Midges (Chironomids)','Leeches','Stonefly nymphs (Plecoptera)','Worms (Tubifex)']),'[2]',
          'Stonefly, mayfly, and caddisfly nymphs (EPT taxa) are pollution-intolerant. Their presence indicates excellent water quality. Worms/leeches tolerate poor quality.',2],
        ['true_false','The Great Lakes hold about 21% of the world\'s surface fresh water.',
          JSON.stringify(['True','False']),'[0]',
          'True! The Great Lakes contain approximately 21% of the world\'s surface fresh water, making them critically important globally, not just for Ontario.',2],
        ['mcq','What causes blue-green algae (cyanobacteria) blooms?',
          JSON.stringify(['Cold water temperatures','Excess nutrients (phosphorus and nitrogen) + warm, calm conditions','High dissolved oxygen','Low conductivity']),'[1]',
          'Cyanobacteria blooms require warm, still water with excess nutrients. They can produce toxins harmful to humans, pets, and livestock.',2],
        ['mcq','What is a riparian zone?',
          JSON.stringify(['An underground aquifer','The land area adjacent to a river or lake','A type of wetland fish','A deep lake zone']),'[1]',
          'Riparian zones are the transition areas between land and water. They filter runoff, stabilize banks, provide habitat, and shade the water — crucial for water quality.',2],
        ['matching','Match each organism to its water quality tolerance:',
          JSON.stringify(['Caddisfly larvae','Tubifex worms','Water boatmen','Mayfly nymphs']),
          JSON.stringify(['Clean water only (intolerant)','Very polluted water (tolerant)','Moderate quality (semi-tolerant)','Clean water only (intolerant)']),
          'Bio-assessment scores organisms by tolerance. Sensitive EPT taxa indicate good quality; tolerant worms/midges thrive in degraded conditions.',3],
        ['true_false','Climate change is expected to increase water temperatures in Ontario lakes.',
          JSON.stringify(['True','False']),'[0]',
          'True! Rising air temperatures warm lake waters, affecting oxygen levels, ice cover duration, species distribution, and bloom frequency.',2],
        ['mcq','Which Great Lake is located entirely within the United States?',
          JSON.stringify(['Lake Superior','Lake Huron','Lake Michigan','Lake Ontario']),'[2]',
          'Lake Michigan is the only Great Lake located entirely within the United States. All others border both the US and Canada.',1],
        ['mcq','What is the role of wetlands in water quality?',
          JSON.stringify(['They are wastelands with no ecological value','Natural filters that remove nutrients, sediments, and pollutants','They increase water temperature','They reduce fish populations']),'[1]',
          'Wetlands function as natural water treatment systems — filtering pollutants, sequestering nutrients, controlling floods, and providing crucial habitat.',2],
        ['mcq','Mercury contamination in Northern Ontario fish is primarily from:',
          JSON.stringify(['Natural geological sources and historic industrial discharge','Car exhaust only','Agricultural pesticides','Plastic pollution']),'[0]',
          'Mercury in Northern Ontario comes from atmospheric deposition (historic industrial emissions) and natural geology. It bioaccumulates up the food chain, concentrating in large predatory fish.',3],
        ['true_false','First Nations traditional ecological knowledge (TEK) can complement scientific water monitoring.',
          JSON.stringify(['True','False']),'[0]',
          'True! TEK provides multi-generational observations about ecosystem changes that scientific monitoring may miss. Integration of TEK and science strengthens water management.',2],
        ['mcq','Lake Superior is special because:',
          JSON.stringify(['It is the shallowest Great Lake','It is the world\'s largest freshwater lake by surface area','It never freezes','It has no fish']),'[1]',
          'Lake Superior is the world\'s largest freshwater lake by surface area (82,103 km²). Its cold, deep, oligotrophic waters support unique and sensitive species.',2],
      ]
    },
    {
      meta: ['Northern Ontario Water Challenges','Advanced topics in Northern Ontario water quality and stewardship.','Regional','Advanced',90,70,'published',1],
      questions: [
        ['mcq','What mining legacy chemical is a major concern in Northern Ontario watersheds?',
          JSON.stringify(['Chlorine','Acid mine drainage (AMD) and heavy metals','Fluoride','Chloramine']),'[1]',
          'Acid mine drainage (AMD) from historic and active mines releases sulfuric acid and heavy metals (arsenic, lead, mercury, nickel) into Northern Ontario watersheds.',3],
        ['mcq','Remote water quality monitoring in Northern Ontario uses:',
          JSON.stringify(['Only in-person sampling','Satellite sensors and automated sondes for continuous data','Manual testing only','No monitoring currently']),'[1]',
          'Remote communities increasingly use automated water quality sondes and telemetry to continuously monitor parameters, with data sent via satellite or cellular to databases.',2],
        ['true_false','Many First Nations communities in Northern Ontario still lack access to safe drinking water.',
          JSON.stringify(['True','False']),'[0]',
          'True. Despite Canadian government commitments, many First Nations communities in Northern Ontario have experienced long-term boil water advisories due to inadequate infrastructure and funding.',3],
        ['mcq','The Grassy Narrows mercury contamination came from:',
          JSON.stringify(['Agricultural runoff','A paper mill discharging methylmercury into the Wabigoon River','Mining operations','Natural mercury deposits']),'[1]',
          'The Reed Paper Mill in Dryden discharged methylmercury into the Wabigoon-English River system from 1962-1970, severely affecting the Grassy Narrows and Wabaseemoong First Nations.',3],
        ['mcq','What is the primary concern with road salt runoff in Northern Ontario?',
          JSON.stringify(['It turns water yellow','Elevated chloride damaging aquatic ecosystems and contaminating groundwater','It lowers pH only','It has no environmental impact']),'[1]',
          'Road salt (sodium chloride) increases chloride levels in waterways. Chronic chloride exposure harms freshwater invertebrates, fish, and amphibians, and can contaminate drinking water wells.',3],
        ['short_answer','Name two key principles of Indigenous water governance relevant to Northern Ontario.',
          null,'["sovereignty","stewardship","relationships","sustainability","traditional knowledge","rights"]',
          'Indigenous water governance principles include: water as a living entity with rights, intergenerational responsibility, TEK integration, community sovereignty over water decisions, and holistic ecosystem relationships.',3],
        ['mcq','CCME Water Quality Guidelines are:',
          JSON.stringify(['Legally binding national regulations','National science-based recommendations that provinces adopt or adapt','Local municipal rules','Industry self-regulation']),'[1]',
          'CCME guidelines are science-based recommendations developed by all Canadian environment ministers. Provinces (like Ontario via PWQO) adopt or adapt them into legally binding objectives.',2],
        ['true_false','Climate change is expected to increase the frequency of algal blooms in Northern Ontario lakes.',
          JSON.stringify(['True','False']),'[0]',
          'True. Warmer temperatures, longer summers, and changing precipitation patterns create more favorable conditions for cyanobacteria blooms, even in historically cool Northern Ontario lakes.',2],
        ['mcq','The SOURCE Water program focuses primarily on:',
          JSON.stringify(['Ocean monitoring','Community-based water quality monitoring in Northern Ontario watersheds','Industrial water treatment','Hydroelectric dam management']),'[1]',
          'SOURCE Water (managed by NORDIK Institute/Algoma University) engages Northern Ontario communities in collaborative, citizen-science-based water quality monitoring and education.',2],
        ['mcq','Bioaccumulation of mercury in fish is highest in:',
          JSON.stringify(['Small planktonic algae','Small invertebrates','Small baitfish','Large predatory fish like walleye and pike']),'[3]',
          'Mercury bioaccumulates up the food chain. Large, long-lived predatory fish (walleye, pike, lake trout) have the highest concentrations — hence consumption advisories in Northern Ontario.',3],
      ]
    },
  ]

  for (const quiz of quizzes) {
    const { lastInsertRowid: quizId } = await db.run(
      `INSERT INTO quizzes (title,description,category,difficulty,time_per_question,pass_score,status,created_by) VALUES (?,?,?,?,?,?,?,?)`,
      quiz.meta)
    for (let i = 0; i < quiz.questions.length; i++) {
      const [type, text, opts, correct, expl, pts] = quiz.questions[i]
      await db.run(
        `INSERT INTO quiz_questions (quiz_id,question_type,question_text,options,correct_answers,explanation,points,sort_order) VALUES (?,?,?,?,?,?,?,?)`,
        [quizId, type, text, opts, correct, expl, pts || 1, i])
    }
  }
}

async function seedKnowledgeBase() {
  const kb = [
    ['What is pH in water?', 'pH measures how acidic or basic water is on a scale of 0-14. A pH of 7 is neutral, below 7 is acidic, above 7 is basic/alkaline. Safe drinking water should be between 6.5 and 8.5 according to WHO guidelines. In Ontario lakes, pH naturally ranges from 6-8, but acid rain can lower it significantly.'],
    ['What is dissolved oxygen?', 'Dissolved oxygen (DO) is the amount of oxygen gas dissolved in water. Aquatic life needs oxygen to breathe! Fish need at least 4-5 mg/L to survive, and cold water trout need 7+ mg/L. Warm water holds less oxygen. Low DO (hypoxia) can cause fish kills.'],
    ['What is turbidity?', 'Turbidity measures water clarity by how much light is scattered by particles. Measured in NTU (Nephelometric Turbidity Units). Clear water has low turbidity. High turbidity can indicate erosion, runoff, algal growth, or pollution. Ontario drinking water standard: <1 NTU.'],
    ['What is conductivity in water?', 'Conductivity measures how well water conducts electricity, which reflects the concentration of dissolved ions (minerals, salts). Freshwater typically ranges 50-500 µS/cm. Sudden high conductivity may indicate road salt, industrial discharge, or sewage.'],
    ['What is E.coli?', 'E.coli (Escherichia coli) is a bacterium used as an indicator of fecal contamination. Most strains are harmless, but their presence suggests human or animal waste entered the water, which may carry dangerous pathogens like Salmonella, Cryptosporidium, and Giardia.'],
    ['What are Ontario\'s swimming guidelines?', 'Ontario recommends closing beaches when E.coli exceeds 200 CFU/100mL in a single sample. Geometric mean over multiple samples should not exceed 100 CFU/100mL. Always check your local health unit for current beach status.'],
    ['What is eutrophication?', 'Eutrophication is the over-enrichment of water with nutrients (especially phosphorus and nitrogen), causing excessive algal growth. This uses up oxygen as algae decompose, creating dead zones. Agricultural runoff, sewage, and urban stormwater are major contributors.'],
    ['What are PWQO standards?', 'Provincial Water Quality Objectives (PWQO) are Ontario\'s science-based standards for protecting aquatic life. Key values: Total phosphorus ≤0.03 mg/L for lakes, pH 6.5-9.5, dissolved oxygen ≥4 mg/L, turbidity varies by water type.'],
    ['What is the CCME Water Quality Index?', 'The Canadian Council of Ministers of the Environment (CCME) Water Quality Index scores water quality 0-100. Excellent (95-100), Good (80-94), Fair (65-79), Marginal (45-64), Poor (0-44). It considers scope (how many parameters exceeded), frequency (how often), and amplitude (how much).'],
    ['How do I collect a water sample?', 'Best practices: (1) Collect 15-30cm below surface, (2) Rinse bottle 3x with site water, (3) Sample facing upstream, (4) Avoid disturbing the bottom, (5) Label with site, date, time, collector, (6) Keep on ice, analyze within holding time, (7) Wear gloves to avoid contamination.'],
    ['What is a watershed?', 'A watershed is all the land that drains into a single water body. Every action on the land — farming, construction, urban development — affects watershed water quality. Northern Ontario has large pristine watersheds that drain into the Great Lakes and Hudson Bay.'],
    ['What are macroinvertebrates?', 'Macroinvertebrates are small animals visible to the naked eye: aquatic insects (mayflies, stoneflies, caddisflies), worms, snails, clams. They\'re excellent water quality indicators because they live in water for months/years and have different pollution tolerances.'],
    ['What is mercury contamination?', 'Mercury is a toxic metal that can enter water from industrial discharge, mining, or atmospheric deposition. It converts to methylmercury in sediments, which bioaccumulates up the food chain. Northern Ontario has fish consumption advisories in many lakes due to elevated mercury.'],
    ['What is Grassy Narrows?', 'Grassy Narrows First Nation suffered devastating mercury poisoning from the Reed Paper Mill (Dryden) which discharged methylmercury into the Wabigoon-English River 1962-1970. The community continues to experience health impacts and fights for cleanup and recognition.'],
    ['What is TEK?', 'Traditional Ecological Knowledge (TEK) is Indigenous knowledge accumulated over generations about ecosystems, species, and environmental changes. In water quality, TEK provides long-term observations that scientific monitoring cannot, and informs culturally appropriate stewardship.'],
    ['How does road salt affect water quality?', 'Road salt (NaCl) elevates chloride levels in waterways. Chronic chloride above 120 mg/L harms freshwater invertebrates, amphibians, and fish. It also contaminates groundwater wells. Northern Ontario\'s heavy winter road maintenance contributes significant chloride to watersheds.'],
    ['What is acid mine drainage?', 'Acid mine drainage (AMD) occurs when pyrite in mine waste reacts with air and water, producing sulfuric acid and leaching heavy metals (arsenic, lead, nickel, zinc). This can severely acidify streams and kill aquatic life. Northern Ontario has many historic mine sites with AMD issues.'],
    ['What is a boil water advisory?', 'A boil water advisory means tap water may contain harmful bacteria, viruses, or parasites and must be boiled for at least 1 minute before drinking, cooking, or brushing teeth. Many First Nations in Northern Ontario have experienced long-term advisories due to inadequate water treatment infrastructure.'],
    ['What is the Great Lakes Datastream?', 'Great Lakes Datastream (greatlakesdatastream.ca) is an open water quality data platform where organizations share monitoring data from across the Great Lakes basin. SOURCE Water participants can upload and access data here for collaborative analysis.'],
    ['How does temperature affect water quality?', 'Water temperature affects nearly every aspect of water quality. Warm water holds less dissolved oxygen, accelerates decomposition and algal growth, affects fish metabolism, and determines which species can survive. Climate change is shifting thermal regimes in Northern Ontario lakes.'],
  ]
  for (const [q, a] of kb) {
    const hash = crypto.createHash('md5').update(q.toLowerCase()).digest('hex')
    await db.run(
      'INSERT INTO ai_cache (question_hash,question,answer) VALUES (?,?,?) ON CONFLICT DO NOTHING',
      [hash, q, a])
  }
}

module.exports = { seed }
