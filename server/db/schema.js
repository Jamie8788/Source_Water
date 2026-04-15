const db = require('./db')

async function initSchema() {
  if (db.USE_PG) {
    // Drop any pre-existing Supabase tables that have UUID user columns.
    // (old app used Supabase Auth UUIDs; our app uses INTEGER ids.)
    // Uses JS-level checks to avoid PL/pgSQL dollar-quoting issues with exec().
    const uuidChecks = [
      { table: 'notifications',    column: 'user_id' },
      { table: 'posts',            column: 'user_id' },
      { table: 'comments',         column: 'user_id' },
      { table: 'post_reactions',   column: 'user_id' },
      { table: 'direct_messages',  column: 'sender_id' },
      { table: 'leaderboard_points', column: 'user_id' },
    ]
    for (const { table, column } of uuidChecks) {
      const row = await db.get(
        `SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=? AND column_name=?`,
        [table, column]
      )
      if (row?.data_type === 'uuid') {
        await db.pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`)
        console.log(`[schema] dropped ${table} (had UUID columns, will recreate with INTEGER)`)
      }
    }

    // PostgreSQL schema — runs on every startup, safe due to IF NOT EXISTS
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        role TEXT DEFAULT 'Community member',
        avatar_emoji TEXT DEFAULT '💧',
        avatar_bg_color TEXT DEFAULT '#3B82F6',
        location TEXT, organization TEXT, bio TEXT,
        phone TEXT, title TEXT, research_role TEXT, institution TEXT, research_area TEXT,
        onboarding_completed INTEGER DEFAULT 0,
        is_admin INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        sound_enabled INTEGER DEFAULT 1,
        theme TEXT DEFAULT 'Light',
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        avatar_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_login TIMESTAMPTZ
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL, description TEXT, category TEXT,
        difficulty TEXT DEFAULT 'Beginner',
        time_per_question INTEGER DEFAULT 60,
        time_limit INTEGER DEFAULT 0,
        pass_score INTEGER DEFAULT 70,
        shuffle_questions INTEGER DEFAULT 0,
        shuffle_answers INTEGER DEFAULT 0,
        show_answers_after INTEGER DEFAULT 1,
        certificate_enabled INTEGER DEFAULT 0,
        negative_marking REAL DEFAULT 0,
        status TEXT DEFAULT 'draft',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS quiz_questions (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
        question_type TEXT NOT NULL,
        question_text TEXT NOT NULL,
        question_image TEXT, question_audio TEXT, question_video TEXT,
        options TEXT, correct_answers TEXT, explanation TEXT,
        points INTEGER DEFAULT 1,
        negative_points REAL DEFAULT 0,
        sort_order INTEGER DEFAULT 0
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER REFERENCES quizzes(id),
        user_id INTEGER REFERENCES users(id),
        score REAL, total_points INTEGER, passed INTEGER,
        time_taken INTEGER, answers TEXT,
        started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sites (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL, description TEXT,
        latitude REAL NOT NULL, longitude REAL NOT NULL,
        body_of_water TEXT, water_body_type TEXT,
        organization TEXT, dataset_name TEXT,
        access_risk TEXT DEFAULT 'Low',
        safety_spring TEXT, safety_summer TEXT, safety_fall TEXT, safety_winter TEXT,
        parameters_tested TEXT, reference_photo TEXT, community TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS observations (
        id SERIAL PRIMARY KEY,
        site_id INTEGER REFERENCES sites(id),
        observer_id INTEGER REFERENCES users(id),
        observed_at TIMESTAMPTZ DEFAULT NOW(),
        sample_id TEXT,
        current_weather TEXT, current_weather_desc TEXT,
        past24_weather TEXT, past24_weather_desc TEXT,
        ph REAL, ph_equipment TEXT,
        dissolved_oxygen REAL, do_equipment TEXT,
        chlorine REAL, chlorine_equipment TEXT,
        hardness REAL, hardness_equipment TEXT,
        alkalinity REAL, alkalinity_equipment TEXT,
        conductivity REAL, conductivity_equipment TEXT,
        air_temp REAL, air_temp_equipment TEXT,
        water_temp REAL, water_temp_equipment TEXT,
        nitrate_nitrogen REAL, nitrate_n_equipment TEXT,
        chlorophyll_a REAL, chlorophyll_equipment TEXT,
        chloride REAL, chloride_equipment TEXT,
        nitrites REAL, nitrites_equipment TEXT,
        turbidity REAL, turbidity_equipment TEXT,
        tds REAL, tds_equipment TEXT,
        nitrates REAL, nitrates_equipment TEXT,
        phosphorus REAL, phosphorus_equipment TEXT,
        ecoli_samples TEXT, ecoli_equipment TEXT,
        total_coliforms REAL, coliforms_equipment TEXT,
        benthic_assessment TEXT, benthic_notes TEXT,
        secchi_depth REAL, secchi_bottom_visible INTEGER,
        water_depth REAL, water_color TEXT, water_odor TEXT, surface_condition TEXT,
        photos TEXT, notes TEXT,
        out_of_range_flags TEXT,
        flagged INTEGER DEFAULT 0,
        qa_status TEXT DEFAULT 'pending', qa_notes TEXT
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        content TEXT, post_type TEXT DEFAULT 'text',
        media TEXT, hashtags TEXT, location_tag TEXT,
        poll_options TEXT, poll_question TEXT,
        pinned INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS post_reactions (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        reaction_type TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(post_id, user_id, reaction_type)
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        parent_comment_id INTEGER REFERENCES comments(id),
        content TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id),
        receiver_id INTEGER REFERENCES users(id),
        content TEXT, media TEXT,
        voice_note TEXT,
        message_type TEXT DEFAULT 'text',
        read INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0,
        edited INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS resources (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL, description TEXT,
        resource_type TEXT, file_path TEXT, external_url TEXT,
        category TEXT, tags TEXT, thumbnail TEXT,
        visibility TEXT DEFAULT 'public',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS resource_bookmarks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        resource_id INTEGER REFERENCES resources(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, resource_id)
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sponsors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        website_url TEXT,
        logo_path TEXT,
        logo_public_id TEXT,
        alt_text TEXT,
        tagline TEXT,
        status TEXT DEFAULT 'active',
        is_active INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        site_id INTEGER REFERENCES sites(id),
        parameter TEXT, current_value REAL, threshold_value REAL,
        severity TEXT DEFAULT 'info', message TEXT,
        active INTEGER DEFAULT 1,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS research_projects (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL, description TEXT,
        start_date TEXT, end_date TEXT,
        team_members TEXT, objectives TEXT, methodology TEXT,
        status TEXT DEFAULT 'active',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS project_datasets (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES research_projects(id) ON DELETE CASCADE,
        file_name TEXT, file_path TEXT, file_size INTEGER,
        row_count INTEGER, column_names TEXT,
        data_preview TEXT, basic_stats TEXT,
        ai_analysis TEXT,
        uploaded_by INTEGER REFERENCES users(id),
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action TEXT NOT NULL, target_type TEXT, target_id INTEGER,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS communities (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ai_cache (
        id SERIAL PRIMARY KEY,
        query_hash TEXT UNIQUE, answer TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS leaderboard_points (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        points INTEGER DEFAULT 0, action TEXT,
        month TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS game_scores (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        game_name TEXT NOT NULL,
        score INTEGER, level INTEGER,
        completed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        type TEXT, title TEXT, message TEXT,
        link TEXT, read INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cms_quick_actions (
        action_id TEXT PRIMARY KEY,
        label TEXT, description TEXT, icon TEXT,
        path TEXT, gradient TEXT,
        visible INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cms_overrides (
        element_key TEXT PRIMARY KEY,
        text_content TEXT,
        html_content TEXT,
        styles TEXT DEFAULT '{}',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cms_content (
        id SERIAL PRIMARY KEY,
        page_key TEXT NOT NULL,
        block_key TEXT NOT NULL,
        field TEXT NOT NULL,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(page_key, block_key, field)
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cms_site_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cms_page_blocks (
        id SERIAL PRIMARY KEY,
        page_key TEXT NOT NULL,
        block_type TEXT NOT NULL,
        content TEXT DEFAULT '{}',
        order_index INTEGER DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    // Indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)',
      'CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id)',
      'CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id)',
      'CREATE INDEX IF NOT EXISTS idx_obs_site ON observations(site_id)',
      'CREATE INDEX IF NOT EXISTS idx_leaderboard_month ON leaderboard_points(month, user_id)',
      'CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read)',
    ]
    for (const idx of indexes) {
      await db.exec(idx)
    }
    // Migrations: add columns that may be missing from pre-existing Supabase tables
    const migrations = [
      `ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS deleted INTEGER DEFAULT 0`,
      `ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS edited INTEGER DEFAULT 0`,
      `ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text'`,
      `ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS media TEXT`,
      `ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS voice_note TEXT`,
      `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS embed_url TEXT`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS grading_status TEXT DEFAULT 'auto'`,
      // CMS tables: patch columns that may be missing from old Supabase-created tables
      `ALTER TABLE cms_overrides ADD COLUMN IF NOT EXISTS html_content TEXT`,
      `ALTER TABLE cms_overrides ADD COLUMN IF NOT EXISTS text_content TEXT`,
      `ALTER TABLE cms_overrides ADD COLUMN IF NOT EXISTS styles TEXT DEFAULT '{}'`,
      `ALTER TABLE cms_overrides ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
      `ALTER TABLE cms_content ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
      `ALTER TABLE cms_site_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
      `ALTER TABLE cms_page_blocks ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '{}'`,
      `ALTER TABLE cms_page_blocks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
      `ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS alt_text TEXT`,
      `ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS logo_public_id TEXT`,
      `ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1`,
      `ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0`,
      `ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
      `UPDATE sponsors SET is_active = CASE WHEN status = 'inactive' THEN 0 ELSE 1 END`,
      `CREATE TABLE IF NOT EXISTS banned_emails (email TEXT PRIMARY KEY, banned_at TIMESTAMPTZ DEFAULT NOW(), reason TEXT)`,
    ]
    for (const m of migrations) {
      await db.exec(m).catch(() => {}) // ignore if already exists
    }

    // Ensure email is unique so auto-creation doesn't make a new row every page load.
    // First deduplicate (keep lowest id per email), then add the constraint.
    const emailConstraint = await db.get(
      `SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema='public' AND table_name='users' AND constraint_name='users_email_unique'`
    )
    if (!emailConstraint) {
      // Nullify email on duplicate rows (keep lowest id per email).
      // Can't DELETE because of FK constraints on activity_log etc.
      // PostgreSQL UNIQUE ignores NULLs so multiple null-email rows are fine.
      await db.pool.query(
        `UPDATE users SET email = NULL
         WHERE email IS NOT NULL AND id NOT IN (
           SELECT MIN(id) FROM users WHERE email IS NOT NULL GROUP BY email
         )`
      )
      await db.pool.query(`ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email)`)
      console.log('[schema] added unique email constraint + deduped users')
    }

    // Remove ghost rows: auto-created rows with no email (lost during dedup)
    await db.pool.query(
      `DELETE FROM users WHERE email IS NULL AND password_hash = 'supabase_auth'`
    ).catch(() => {})

    // Remove any remaining duplicate users — keep lowest id per email.
    // Uses a safe UPDATE approach: nullify username on dupes first, then delete.
    await db.pool.query(`
      DELETE FROM users
      WHERE id NOT IN (SELECT MIN(id) FROM users WHERE email IS NOT NULL GROUP BY email)
        AND email IS NOT NULL
        AND password_hash = 'supabase_auth'
        AND NOT EXISTS (
          SELECT 1 FROM posts WHERE posts.user_id = users.id
          UNION SELECT 1 FROM direct_messages WHERE sender_id = users.id
          UNION SELECT 1 FROM notifications WHERE notifications.user_id = users.id
        )
    `).catch(() => {})

    // Ensure admin@sourcewater.app always has admin privileges and is active
    await db.pool.query(
      `UPDATE users SET is_admin=1, is_active=1 WHERE email='admin@sourcewater.app'`
    )

    // Also auto-promote any email listed in ADMIN_EMAILS env var (comma-separated)
    if (process.env.ADMIN_EMAILS) {
      const emails = process.env.ADMIN_EMAILS.split(',').map(e => e.trim()).filter(Boolean)
      for (const email of emails) {
        await db.pool.query(`UPDATE users SET is_admin=1, is_active=1 WHERE email=$1`, [email])
        console.log(`[schema] Granted admin to ${email}`)
      }
    }

    // Always promote username='admin' (case-insensitive) — the app owner's account
    await db.pool.query(`UPDATE users SET is_admin=1, is_active=1 WHERE LOWER(username)='admin'`)

    // If still no admin, promote earliest registered user
    const adminExists = await db.get(`SELECT 1 FROM users WHERE is_admin=1 LIMIT 1`)
    if (!adminExists) {
      await db.pool.query(`UPDATE users SET is_admin=1, is_active=1 WHERE id=(SELECT MIN(id) FROM users)`)
      const firstAdmin = await db.get(`SELECT email, username FROM users WHERE is_admin=1 LIMIT 1`)
      console.log(`[schema] No admin found — auto-promoted first user: ${firstAdmin?.email || firstAdmin?.username}`)
    }

    // ── Seed starter resources (only if table is empty) ──────────────────────
    const resCount = await db.get(`SELECT COUNT(*) AS n FROM resources`)
    if (!resCount || resCount.n == 0) {
      const adminUser = await db.get(`SELECT id FROM users WHERE is_admin=1 LIMIT 1`)
      const aid = adminUser?.id || null
      const seedResources = [
        // ── Water Rangers (real partner) ─────────────────────────────────────
        { title: 'Water Rangers — Open Data Portal', description: 'Explore thousands of water quality readings collected by citizen scientists across Canada. Filter by location, date, and parameter. Free and open access.', type: 'dataset', category: 'Community Science', url: 'https://data.waterrangers.ca/', featured: true },
        { title: 'Water Rangers — Interactive Data Map', description: 'Visual map of all Water Rangers monitoring sites across Canada. See real community water quality data plotted geographically in real time.', type: 'link', category: 'Community Science', url: 'https://www.waterrangers.ca/map', featured: true },
        { title: 'Water Rangers — Water Testing Equipment Guide', description: 'Detailed guide to Water Rangers field testing kits: how to use them, what each test measures (pH, turbidity, dissolved oxygen, E. coli, nitrates), and how to log results.', type: 'guide', category: 'Field Work', url: 'https://www.waterrangers.ca/equipment' },
        { title: 'Water Rangers — Learning Hub', description: 'Educational resources and training materials for community water monitors. Covers sampling protocols, parameter interpretation, and data quality.', type: 'guide', category: 'Data Literacy', url: 'https://www.waterrangers.ca/learn' },
        { title: 'Water Rangers Blog — Water Quality Stories', description: 'Frontline stories, science explainers, and community updates from Water Rangers citizen scientists monitoring waters across Canada.', type: 'link', category: 'Community Science', url: 'https://www.waterrangers.ca/blog' },
        { title: 'Water Rangers — About the Program', description: 'Learn how Water Rangers empowers communities to protect water through citizen science, open data, and advocacy. Background on the organization and mission.', type: 'link', category: 'Community Science', url: 'https://www.waterrangers.ca/about' },
        // ── Water Quality Standards ───────────────────────────────────────────
        { title: 'WHO Drinking-water Quality Guidelines (4th Ed.)', description: 'The definitive international reference for drinking-water safety. Covers chemical, microbial, and radiological hazards with evidence-based guideline values.', type: 'guide', category: 'Water Quality', url: 'https://www.who.int/publications/i/item/9789241549950', featured: true },
        { title: 'Health Canada — Drinking Water Quality Guidelines', description: 'Federal guidelines for maximum acceptable concentrations of contaminants in Canadian drinking water, updated regularly with peer-reviewed science.', type: 'guide', category: 'Water Quality', url: 'https://www.canada.ca/en/health-canada/services/environmental-workplace-health/water-quality/drinking-water/drinking-water-quality-guidelines-supporting-documents.html' },
        { title: 'Ontario Drinking Water Standards & Objectives', description: 'Ontario-specific parameters regulated under the Safe Drinking Water Act — the legal reference for municipal water treatment in the province.', type: 'document', category: 'Water Quality', url: 'https://www.ontario.ca/document/ontario-drinking-water-quality-standards' },
        { title: 'Health Canada — Blue-Green Algae (Cyanobacteria)', description: 'Federal guidance on detecting, monitoring, and responding to harmful algal blooms in recreational and drinking water sources. Includes health thresholds.', type: 'guide', category: 'Safety', url: 'https://www.canada.ca/en/health-canada/services/publications/healthy-living/blue-green-algae.html' },
        // ── Field Methods ─────────────────────────────────────────────────────
        { title: 'Standard Methods for Water & Wastewater Examination', description: 'APHA/AWWA/WEF standard methods — the gold-standard laboratory procedures for water and wastewater analysis used by certified labs worldwide.', type: 'document', category: 'Field Work', url: 'https://www.standardmethods.org/' },
        { title: 'USGS National Field Manual — Water-Quality Sampling', description: 'Comprehensive USGS procedures for collecting surface-water and groundwater samples for chemical analysis in the field.', type: 'guide', category: 'Field Work', url: 'https://water.usgs.gov/owq/FieldManual/' },
        { title: 'Lake Pulse — Field Sampling Protocols', description: 'Canadian Lake Pulse Network\'s standardized protocols for physical, chemical, and biological lake surveys — designed for reproducible national-scale monitoring.', type: 'document', category: 'Field Work', url: 'https://lakepulse.ca/sampling-protocols/' },
        // ── Datasets ─────────────────────────────────────────────────────────
        { title: 'GEMS/Water — Global Freshwater Quality Database', description: 'UN Environment Programme global database with water quality monitoring data from rivers, lakes, reservoirs, and groundwater across 100+ countries.', type: 'dataset', category: 'Datasets', url: 'https://gemstat.org/', featured: true },
        { title: 'Water Survey of Canada — Hydrometric Data', description: 'Real-time and historical streamflow, water level, and water quality data from thousands of monitoring stations across Canada (Environment & Climate Change Canada).', type: 'dataset', category: 'Datasets', url: 'https://wateroffice.ec.gc.ca/mainmenu/real_time_data_index_e.html' },
        { title: 'EPA Water Quality Portal (STORET)', description: 'US EPA and USGS combined data portal with 400+ million water quality monitoring records from federal, state, and local agencies across North America.', type: 'dataset', category: 'Datasets', url: 'https://www.waterqualitydata.us/' },
        { title: 'Ontario Provincial Water Quality Monitoring', description: 'Ontario government\'s open dataset with Provincial Water Quality Monitoring Network results spanning decades — rivers, streams, and lakes.', type: 'dataset', category: 'Datasets', url: 'https://data.ontario.ca/dataset/provincial-stream-flow-monitoring' },
        // ── Data Literacy ─────────────────────────────────────────────────────
        { title: 'CCME Water Quality Index (WQI) Calculator', description: 'The standardized Canadian tool for aggregating multiple water quality parameters into a single communicable index score — used by provinces and municipalities.', type: 'link', category: 'Data Literacy', url: 'https://ccme.ca/en/resources/canadian_water_quality_guidelines_for_the_protection_of_aquatic_life/water_quality_index_calculator.html' },
        { title: 'Environmental Computing — Data Analysis for Scientists', description: 'Open-access course covering exploratory data analysis, visualisation, and statistical methods specifically for environmental and water quality datasets in R.', type: 'link', category: 'Data Literacy', url: 'https://www.environmentalcomputing.net/' },
        // ── Ecology ──────────────────────────────────────────────────────────
        { title: 'Freshwater Ecoregions of the World (FEOW)', description: 'The definitive biogeographic classification of the world\'s freshwater habitats — essential context for ecological water quality interpretation and basin-level assessments.', type: 'report', category: 'Ecology', url: 'https://www.feow.org/' },
        // ── Indigenous / First Nations Water ─────────────────────────────────
        { title: 'First Nations Safe Drinking Water — SAC Canada', description: 'Federal framework and resources addressing long-term boil water advisories and infrastructure investment for safe drinking water on First Nations reserves.', type: 'report', category: 'Indigenous Water Rights', url: 'https://www.sac-isc.gc.ca/eng/1506514143353/1533317537227' },
        // ── International ─────────────────────────────────────────────────────
        { title: 'International Lake Environment Committee (ILEC)', description: 'Global knowledge base on the management and restoration of lakes and reservoirs, including international case studies and best management practices.', type: 'link', category: 'Community Science', url: 'https://www.ilec.or.jp/en/' },
      ]
      // Ensure featured column exists
      await db.pool.query(`ALTER TABLE resources ADD COLUMN IF NOT EXISTS featured INTEGER DEFAULT 0`).catch(() => {})
      await db.pool.query(`ALTER TABLE resources ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0`).catch(() => {})
      for (const r of seedResources) {
        await db.pool.query(
          `INSERT INTO resources (title,description,resource_type,external_url,category,visibility,featured,created_by) VALUES ($1,$2,$3,$4,$5,'public',$6,$7) ON CONFLICT DO NOTHING`,
          [r.title, r.description, r.type, r.url, r.category, r.featured ? 1 : 0, aid]
        )
      }
      console.log(`[schema] Seeded ${seedResources.length} starter resources`)
    }

    console.log('[schema] PostgreSQL schema ready')
  } else {
    // ── SQLite schema (local dev only) ───────────────────────────────────────
    db.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        role TEXT DEFAULT 'Community member',
        avatar_emoji TEXT DEFAULT '💧',
        avatar_bg_color TEXT DEFAULT '#3B82F6',
        location TEXT, organization TEXT, bio TEXT,
        phone TEXT, title TEXT, research_role TEXT, institution TEXT, research_area TEXT,
        onboarding_completed INTEGER DEFAULT 0,
        is_admin INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        sound_enabled INTEGER DEFAULT 1,
        theme TEXT DEFAULT 'Light',
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        avatar_url TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        last_login TEXT
      );
      CREATE TABLE IF NOT EXISTS quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL, description TEXT, category TEXT,
        difficulty TEXT DEFAULT 'Beginner',
        time_per_question INTEGER DEFAULT 60,
        time_limit INTEGER DEFAULT 0,
        pass_score INTEGER DEFAULT 70,
        shuffle_questions INTEGER DEFAULT 0,
        shuffle_answers INTEGER DEFAULT 0,
        show_answers_after INTEGER DEFAULT 1,
        certificate_enabled INTEGER DEFAULT 0,
        negative_marking REAL DEFAULT 0,
        embed_url TEXT,
        status TEXT DEFAULT 'draft',
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS quiz_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
        question_type TEXT NOT NULL,
        question_text TEXT NOT NULL,
        question_image TEXT, question_audio TEXT, question_video TEXT,
        options TEXT, correct_answers TEXT, explanation TEXT,
        points INTEGER DEFAULT 1,
        negative_points REAL DEFAULT 0,
        sort_order INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id INTEGER REFERENCES quizzes(id),
        user_id INTEGER REFERENCES users(id),
        score REAL, total_points INTEGER, passed INTEGER,
        time_taken INTEGER, answers TEXT,
        started_at TEXT, completed_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, description TEXT,
        latitude REAL NOT NULL, longitude REAL NOT NULL,
        body_of_water TEXT, water_body_type TEXT,
        organization TEXT, dataset_name TEXT,
        access_risk TEXT DEFAULT 'Low',
        safety_spring TEXT, safety_summer TEXT, safety_fall TEXT, safety_winter TEXT,
        parameters_tested TEXT, reference_photo TEXT, community TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id INTEGER REFERENCES sites(id),
        observer_id INTEGER REFERENCES users(id),
        observed_at TEXT DEFAULT (datetime('now')),
        sample_id TEXT,
        current_weather TEXT, current_weather_desc TEXT,
        past24_weather TEXT, past24_weather_desc TEXT,
        ph REAL, ph_equipment TEXT,
        dissolved_oxygen REAL, do_equipment TEXT,
        chlorine REAL, chlorine_equipment TEXT,
        hardness REAL, hardness_equipment TEXT,
        alkalinity REAL, alkalinity_equipment TEXT,
        conductivity REAL, conductivity_equipment TEXT,
        air_temp REAL, air_temp_equipment TEXT,
        water_temp REAL, water_temp_equipment TEXT,
        nitrate_nitrogen REAL, nitrate_n_equipment TEXT,
        chlorophyll_a REAL, chlorophyll_equipment TEXT,
        chloride REAL, chloride_equipment TEXT,
        nitrites REAL, nitrites_equipment TEXT,
        turbidity REAL, turbidity_equipment TEXT,
        tds REAL, tds_equipment TEXT,
        nitrates REAL, nitrates_equipment TEXT,
        phosphorus REAL, phosphorus_equipment TEXT,
        ecoli_samples TEXT, ecoli_equipment TEXT,
        total_coliforms REAL, coliforms_equipment TEXT,
        benthic_assessment TEXT, benthic_notes TEXT,
        secchi_depth REAL, secchi_bottom_visible INTEGER,
        water_depth REAL, water_color TEXT, water_odor TEXT, surface_condition TEXT,
        photos TEXT, notes TEXT,
        out_of_range_flags TEXT,
        flagged INTEGER DEFAULT 0,
        qa_status TEXT DEFAULT 'pending', qa_notes TEXT
      );
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        content TEXT, post_type TEXT DEFAULT 'text',
        media TEXT, hashtags TEXT, location_tag TEXT,
        poll_options TEXT, poll_question TEXT,
        pinned INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS post_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        reaction_type TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(post_id, user_id, reaction_type)
      );
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        parent_comment_id INTEGER REFERENCES comments(id),
        content TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS direct_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER REFERENCES users(id),
        receiver_id INTEGER REFERENCES users(id),
        content TEXT, media TEXT,
        voice_note TEXT,
        message_type TEXT DEFAULT 'text',
        read INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0,
        edited INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL, description TEXT,
        resource_type TEXT, file_path TEXT, external_url TEXT,
        category TEXT, tags TEXT, thumbnail TEXT,
        visibility TEXT DEFAULT 'public',
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS resource_bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        resource_id INTEGER REFERENCES resources(id),
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, resource_id)
      );
      CREATE TABLE IF NOT EXISTS sponsors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        website_url TEXT,
        logo_path TEXT,
        logo_public_id TEXT,
        alt_text TEXT,
        tagline TEXT,
        status TEXT DEFAULT 'active',
        is_active INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now')),
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id INTEGER REFERENCES sites(id),
        parameter TEXT, current_value REAL, threshold_value REAL,
        severity TEXT DEFAULT 'info', message TEXT,
        active INTEGER DEFAULT 1,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS research_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL, description TEXT,
        start_date TEXT, end_date TEXT,
        team_members TEXT, objectives TEXT, methodology TEXT,
        status TEXT DEFAULT 'active',
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS project_datasets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES research_projects(id) ON DELETE CASCADE,
        file_name TEXT, file_path TEXT, file_size INTEGER,
        row_count INTEGER, column_names TEXT,
        data_preview TEXT, basic_stats TEXT,
        ai_analysis TEXT,
        uploaded_by INTEGER REFERENCES users(id),
        uploaded_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        action TEXT NOT NULL, target_type TEXT, target_id INTEGER,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS communities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS ai_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_hash TEXT UNIQUE, answer TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS leaderboard_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        points INTEGER DEFAULT 0, action TEXT,
        month TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS game_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        game_name TEXT NOT NULL,
        score INTEGER, level INTEGER,
        completed_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        type TEXT, title TEXT, message TEXT,
        link TEXT, read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS cms_quick_actions (
        action_id TEXT PRIMARY KEY,
        label TEXT, description TEXT, icon TEXT,
        path TEXT, gradient TEXT,
        visible INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS cms_overrides (
        element_key TEXT PRIMARY KEY,
        text_content TEXT,
        html_content TEXT,
        styles TEXT DEFAULT '{}',
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS cms_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_key TEXT NOT NULL,
        block_key TEXT NOT NULL,
        field TEXT NOT NULL,
        value TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(page_key, block_key, field)
      );
      CREATE TABLE IF NOT EXISTS cms_site_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS cms_page_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_key TEXT NOT NULL,
        block_type TEXT NOT NULL,
        content TEXT DEFAULT '{}',
        order_index INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_obs_site ON observations(site_id);
      CREATE INDEX IF NOT EXISTS idx_leaderboard_month ON leaderboard_points(month, user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
      CREATE INDEX IF NOT EXISTS idx_sponsors_active_order ON sponsors(is_active, display_order);
    `)
    // SQLite migrations: add columns that may be missing from older local DBs
    const sqliteMigrations = [
      `ALTER TABLE direct_messages ADD COLUMN deleted INTEGER DEFAULT 0`,
      `ALTER TABLE direct_messages ADD COLUMN edited INTEGER DEFAULT 0`,
      `ALTER TABLE direct_messages ADD COLUMN message_type TEXT DEFAULT 'text'`,
      `ALTER TABLE direct_messages ADD COLUMN media TEXT`,
      `ALTER TABLE direct_messages ADD COLUMN voice_note TEXT`,
      `ALTER TABLE quizzes ADD COLUMN embed_url TEXT`,
      `ALTER TABLE quiz_attempts ADD COLUMN grading_status TEXT DEFAULT 'auto'`,
      `ALTER TABLE sponsors ADD COLUMN alt_text TEXT`,
      `ALTER TABLE sponsors ADD COLUMN logo_public_id TEXT`,
      `ALTER TABLE sponsors ADD COLUMN is_active INTEGER DEFAULT 1`,
      `ALTER TABLE sponsors ADD COLUMN display_order INTEGER DEFAULT 0`,
      `ALTER TABLE sponsors ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))`,
      `UPDATE sponsors SET is_active = CASE WHEN status = 'inactive' THEN 0 ELSE 1 END`,
    ]
    for (const m of sqliteMigrations) {
      try { db.sqlite.exec(m) } catch (_) {} // ignore "duplicate column" errors
    }
    console.log('[schema] SQLite schema ready')
  }
}

module.exports = { initSchema }
