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
        UNIQUE(post_id, user_id)
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS post_bookmarks (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(post_id, user_id)
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
    // User-defined threshold watches. When a watch's condition is met against
    // the latest observation for (site_id, parameter), the checker inserts a
    // row into the alerts table above. Real data only — no seed data.
    await db.exec(`
      CREATE TABLE IF NOT EXISTS alert_watches (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
        parameter TEXT NOT NULL,
        comparator TEXT NOT NULL,
        threshold REAL NOT NULL,
        severity TEXT DEFAULT 'medium',
        label TEXT,
        active INTEGER DEFAULT 1,
        last_checked_at TIMESTAMPTZ,
        last_triggered_at TIMESTAMPTZ,
        last_value REAL,
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
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT`,
      `ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS deleted INTEGER DEFAULT 0`,
      `ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS edited INTEGER DEFAULT 0`,
      `ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text'`,
      `ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS media TEXT`,
      `ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS voice_note TEXT`,
      `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS embed_url TEXT`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS grading_status TEXT DEFAULT 'auto'`,
      // Brightspace-style admin grading additions. All NULL by default —
      // pre-existing attempts keep their auto-calculated score and pass
      // status untouched. The override_score, when non-null, takes
      // precedence over `score` for display + transcript export.
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS override_score INTEGER`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS override_reason TEXT`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS feedback TEXT`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS graded_by INTEGER`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ`,
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
      // external_source / external_id let a site row reference a partner system
      // (e.g. Water Rangers location). NULL = local-only site (current behaviour).
      // The alert checker reads these columns to decide whether to look up the
      // latest reading in our DB or fetch live from the WR API.
      `ALTER TABLE sites ADD COLUMN IF NOT EXISTS external_source TEXT`,
      `ALTER TABLE sites ADD COLUMN IF NOT EXISTS external_id TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_sites_external ON sites(external_source, external_id)`,
      // Per-user field waypoints dropped on the Monitoring Map. Strictly scoped
      // to the owning user — every query in routes/waypoints.js filters by
      // user_id, so one volunteer's pins never leak into another's view.
      `CREATE TABLE IF NOT EXISTS waypoints (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        name TEXT NOT NULL,
        note TEXT,
        category TEXT DEFAULT 'general',
        color TEXT DEFAULT '#f59e0b',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_waypoints_user ON waypoints(user_id)`,
      // Community stories layer for the Monitoring Map. Globally visible to
      // all signed-in users (NOT scoped per-user like waypoints) — this is
      // the layer that differentiates SOURCE Water from Water Rangers' map:
      // WR shows scientific monitoring, we add community context on top.
      // Text-only by design (no photos) to keep moderation simple and
      // payloads small.
      `CREATE TABLE IF NOT EXISTS map_stories (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        vibe TEXT NOT NULL DEFAULT 'curious',
        text TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_map_stories_user ON map_stories(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_map_stories_created ON map_stories(created_at DESC)`,
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

    // Optional: auto-promote emails listed in ADMIN_EMAILS env var. Opt-in
    // only — no hardcoded emails. If you want a specific account to always
    // be admin (e.g. for disaster recovery), set ADMIN_EMAILS in Render env.
    // Removing an admin via the dashboard now actually sticks across deploys
    // because there are no implicit re-grant rules.
    if (process.env.ADMIN_EMAILS) {
      const emails = process.env.ADMIN_EMAILS.split(',').map(e => e.trim()).filter(Boolean)
      for (const email of emails) {
        await db.pool.query(`UPDATE users SET is_admin=1, is_active=1 WHERE email=$1`, [email])
        console.log(`[schema] Granted admin to ${email} (via ADMIN_EMAILS)`)
      }
    }

    // ── Seed starter resources ───────────────────────────────────────────────
    // Curated to ONLY Water Rangers (community science partner) + DataStream
    // (Gordon Foundation's open water-quality data hub for Canada). Both are
    // real, vetted, and the data the rest of SOURCE Water already depends on.
    // Anything else lives in the table only if a user/admin explicitly added it.
    const adminUser = await db.get(`SELECT id FROM users WHERE is_admin=1 LIMIT 1`)
    const aid = adminUser?.id || null
    // Ensure required columns exist before INSERT
    await db.pool.query(`ALTER TABLE resources ADD COLUMN IF NOT EXISTS featured INTEGER DEFAULT 0`).catch(() => {})
    await db.pool.query(`ALTER TABLE resources ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0`).catch(() => {})

    const curatedResources = [
      // ── Water Rangers — community science partner ────────────────────────
      { title: 'Water Rangers — Open Data Portal', description: 'Browse and download every water-quality reading logged by Water Rangers citizen scientists across Canada and beyond. Filter by location, date, and parameter. Free and open access.', type: 'dataset', category: 'Datasets', url: 'https://data.waterrangers.ca/', featured: true },
      { title: 'Water Rangers — Live Monitoring Map', description: 'Visual map of every Water Rangers monitoring site (the same sites SOURCE Water plots on its Monitoring Map). Real community readings, plotted geographically.', type: 'link', category: 'Community Science', url: 'https://www.waterrangers.ca/map', featured: true },
      { title: 'Water Rangers — Test-Kit Equipment Guide', description: 'Field guide to the Water Rangers test kits: pH, dissolved oxygen, turbidity, conductivity, alkalinity, hardness, E. coli. How each test works and how to log it correctly.', type: 'guide', category: 'Field Work', url: 'https://www.waterrangers.ca/equipment' },
      { title: 'Water Rangers — Learning Hub', description: 'Free training materials for community water monitors — sampling protocols, parameter interpretation, QA workflows, the same standards SOURCE Water uses.', type: 'guide', category: 'Data Literacy', url: 'https://www.waterrangers.ca/learn' },
      { title: 'Water Rangers — Field Stories Blog', description: 'Frontline stories, science explainers, and community updates from Water Rangers citizen scientists.', type: 'link', category: 'Community Science', url: 'https://www.waterrangers.ca/blog' },
      { title: 'Water Rangers — About the Program', description: 'How Water Rangers empowers communities to protect water through citizen science, open data, and advocacy.', type: 'link', category: 'Community Science', url: 'https://www.waterrangers.ca/about' },

      // ── DataStream — Gordon Foundation\'s open water-quality data hub ────
      { title: 'DataStream — Open Water-Quality Data Hub', description: 'Search, explore, and download open water-quality datasets from across Canada (Atlantic, Mackenzie, Lake Winnipeg, Great Lakes, Pacific). Powered by The Gordon Foundation.', type: 'dataset', category: 'Datasets', url: 'https://datastream.org/en-ca/', featured: true },
      { title: 'DataStream — Atlantic Basin Hub', description: 'Open water-quality datasets and stories from across the Atlantic basin in Canada — community science groups, ENGOs, governments, and Indigenous nations.', type: 'dataset', category: 'Datasets', url: 'https://datastream.org/en-ca/dataset?regionId=atlantic' },
      { title: 'DataStream — Great Lakes Basin Hub', description: 'Open water-quality data hub covering the Great Lakes — Lake Superior, Huron, Erie, Ontario, plus tributaries.', type: 'dataset', category: 'Datasets', url: 'https://datastream.org/en-ca/dataset?regionId=great-lakes' },
      { title: 'DataStream — Mackenzie Basin Hub', description: 'Open water-quality data hub covering the Mackenzie River basin (Yukon, NWT, Alberta, BC).', type: 'dataset', category: 'Datasets', url: 'https://datastream.org/en-ca/dataset?regionId=mackenzie' },
      { title: 'DataStream — Lake Winnipeg Basin Hub', description: 'Open water-quality data hub covering the Lake Winnipeg watershed across Manitoba, Saskatchewan, Alberta, Ontario, and the northern US.', type: 'dataset', category: 'Datasets', url: 'https://datastream.org/en-ca/dataset?regionId=lake-winnipeg' },
      { title: 'DataStream — Pacific Basin Hub', description: 'Open water-quality data hub covering the Pacific basin in Canada (BC + Yukon).', type: 'dataset', category: 'Datasets', url: 'https://datastream.org/en-ca/dataset?regionId=pacific' },
      { title: 'DataStream — Data Schema & Download Guide', description: 'How DataStream structures water-quality observations (the WQX-aligned columns), how to download a region\'s full archive, and how to cite the data correctly.', type: 'guide', category: 'Data Literacy', url: 'https://datastream.org/en-ca/info/data-schema' },
      { title: 'DataStream — Contribute Your Dataset', description: 'How a community-science group, watershed council, or Indigenous nation can publish their own water-quality dataset on DataStream for free.', type: 'guide', category: 'Community Science', url: 'https://datastream.org/en-ca/info/contribute' },
    ]

    // One-time cleanup: remove leftover seed entries from the OLD broader
    // catalogue (WHO, Health Canada, USGS, etc.) so the live tab matches the
    // curated list. We match by exact title so any user-added resources with
    // overlapping URLs are preserved. Runs once and is a no-op afterwards.
    const OLD_SEED_TITLES = [
      'WHO Drinking-water Quality Guidelines (4th Ed.)',
      'Health Canada — Drinking Water Quality Guidelines',
      'Ontario Drinking Water Standards & Objectives',
      'Health Canada — Blue-Green Algae (Cyanobacteria)',
      'Standard Methods for Water & Wastewater Examination',
      'USGS National Field Manual — Water-Quality Sampling',
      'Lake Pulse — Field Sampling Protocols',
      'GEMS/Water — Global Freshwater Quality Database',
      'Water Survey of Canada — Hydrometric Data',
      'EPA Water Quality Portal (STORET)',
      'Ontario Provincial Water Quality Monitoring',
      'CCME Water Quality Index (WQI) Calculator',
      'Environmental Computing — Data Analysis for Scientists',
      'Freshwater Ecoregions of the World (FEOW)',
      'First Nations Safe Drinking Water — SAC Canada',
      'International Lake Environment Committee (ILEC)',
      'Water Rangers — Water Testing Equipment Guide',                       // renamed to "Test-Kit Equipment Guide"
      'Water Rangers Blog — Water Quality Stories',                          // renamed to "Field Stories Blog"
    ]
    try {
      for (const t of OLD_SEED_TITLES) {
        await db.pool.query(`DELETE FROM resources WHERE title=$1 AND created_by IS NOT DISTINCT FROM $2`, [t, aid])
      }
    } catch (e) { /* non-fatal */ }

    // Upsert the curated set every boot. Title is the natural key; if a row
    // already exists with the same title we overwrite description / URL /
    // featured so wording fixes always propagate. created_by stays as the
    // admin if present, NULL otherwise.
    for (const r of curatedResources) {
      const existing = await db.get(`SELECT id FROM resources WHERE title=$1 LIMIT 1`, [r.title])
      if (existing) {
        await db.pool.query(
          `UPDATE resources SET description=$1, resource_type=$2, external_url=$3, category=$4, visibility='public', featured=$5 WHERE id=$6`,
          [r.description, r.type, r.url, r.category, r.featured ? 1 : 0, existing.id]
        )
      } else {
        await db.pool.query(
          `INSERT INTO resources (title,description,resource_type,external_url,category,visibility,featured,created_by) VALUES ($1,$2,$3,$4,$5,'public',$6,$7)`,
          [r.title, r.description, r.type, r.url, r.category, r.featured ? 1 : 0, aid]
        )
      }
    }
    console.log(`[schema] Curated resources synced (WR + DataStream, ${curatedResources.length} entries)`)

    // ── Migration: one reaction per (post, user) — FB-style ───────────────
    // Legacy UNIQUE was (post_id, user_id, reaction_type), which let users
    // stack every emoji on the same post and inflate XP. Dedupe + refund.
    try {
      const dupesExist = await db.get(
        `SELECT 1 AS x FROM (
           SELECT post_id, user_id, COUNT(*) AS c
           FROM post_reactions
           GROUP BY post_id, user_id
           HAVING COUNT(*) > 1
         ) t LIMIT 1`, [])
      if (dupesExist) {
        const refunds = await db.all(
          `SELECT user_id, SUM(c - 1) AS extra FROM (
             SELECT user_id, post_id, COUNT(*) AS c
             FROM post_reactions
             GROUP BY user_id, post_id
             HAVING COUNT(*) > 1
           ) t
           GROUP BY user_id`, [])
        await db.pool.query(
          `DELETE FROM post_reactions
           WHERE id NOT IN (
             SELECT MAX(id) FROM post_reactions GROUP BY post_id, user_id
           )`)
        const month = new Date().toISOString().slice(0, 7)
        for (const r of refunds) {
          const extra = parseInt(r.extra || 0)
          if (extra <= 0) continue
          await db.pool.query(
            `UPDATE users SET xp = GREATEST(xp - $1, 0) WHERE id = $2`,
            [extra, r.user_id])
          await db.pool.query(
            `INSERT INTO leaderboard_points (user_id, points, action, month)
             VALUES ($1, $2, 'reaction_dedupe', $3)`,
            [r.user_id, -extra, month])
        }
        console.log(`[schema] deduped stacked reactions, refunded ${refunds.length} users`)
      }
      // Drop old per-type UNIQUE constraint (auto-named) if present, then
      // ensure the new (post_id, user_id) UNIQUE is in place.
      await db.pool.query(
        `ALTER TABLE post_reactions
           DROP CONSTRAINT IF EXISTS post_reactions_post_id_user_id_reaction_type_key`)
      const hasNew = await db.get(
        `SELECT 1 AS x FROM pg_constraint
         WHERE conname = 'post_reactions_post_user_uniq'`, [])
      if (!hasNew) {
        await db.pool.query(
          `ALTER TABLE post_reactions
             ADD CONSTRAINT post_reactions_post_user_uniq UNIQUE (post_id, user_id)`)
        console.log('[schema] added UNIQUE(post_id, user_id) to post_reactions')
      }
    } catch (e) {
      console.error('[schema] reaction migration error:', e.message)
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
        UNIQUE(post_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS post_bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(post_id, user_id)
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
      CREATE TABLE IF NOT EXISTS alert_watches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
        parameter TEXT NOT NULL,
        comparator TEXT NOT NULL,
        threshold REAL NOT NULL,
        severity TEXT DEFAULT 'medium',
        label TEXT,
        active INTEGER DEFAULT 1,
        last_checked_at TEXT,
        last_triggered_at TEXT,
        last_value REAL,
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
      // Partner-system pointer (Water Rangers etc.) — see PG migration above.
      `ALTER TABLE sites ADD COLUMN external_source TEXT`,
      `ALTER TABLE sites ADD COLUMN external_id TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_sites_external ON sites(external_source, external_id)`,
      // Per-user field waypoints — see PG migration above.
      `CREATE TABLE IF NOT EXISTS waypoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        name TEXT NOT NULL,
        note TEXT,
        category TEXT DEFAULT 'general',
        color TEXT DEFAULT '#f59e0b',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_waypoints_user ON waypoints(user_id)`,
      // Community map_stories — see PG migration above for rationale.
      `CREATE TABLE IF NOT EXISTS map_stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        vibe TEXT NOT NULL DEFAULT 'curious',
        text TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_map_stories_user ON map_stories(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_map_stories_created ON map_stories(created_at DESC)`,
    ]
    for (const m of sqliteMigrations) {
      try { db.sqlite.exec(m) } catch (_) {} // ignore "duplicate column" errors
    }
    console.log('[schema] SQLite schema ready')
  }
}

module.exports = { initSchema }
