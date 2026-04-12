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
        name TEXT NOT NULL, website_url TEXT, logo_path TEXT,
        tagline TEXT, tier TEXT DEFAULT 'Gold',
        placement TEXT, status TEXT DEFAULT 'active',
        start_date TEXT, end_date TEXT, custom_html TEXT,
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

    // Ensure admin@sourcewater.app always has admin privileges
    await db.pool.query(
      `UPDATE users SET is_admin=1 WHERE email='admin@sourcewater.app' AND is_admin=0`
    )

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
        name TEXT NOT NULL, website_url TEXT, logo_path TEXT,
        tagline TEXT, tier TEXT DEFAULT 'Gold',
        placement TEXT, status TEXT DEFAULT 'active',
        start_date TEXT, end_date TEXT, custom_html TEXT,
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
      CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_obs_site ON observations(site_id);
      CREATE INDEX IF NOT EXISTS idx_leaderboard_month ON leaderboard_points(month, user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
    `)
    console.log('[schema] SQLite schema ready')
  }
}

module.exports = { initSchema }
