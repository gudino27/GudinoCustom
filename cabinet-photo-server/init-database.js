const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
  console.log('Starting database initialization...\n');

  const dbPath = path.join(__dirname, 'database', 'cabinet_photos.db');

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    // Enable WAL mode for better concurrency
    await db.exec('PRAGMA journal_mode=WAL');

    console.log(' Creating basic tables...');
    await createBasicTables(db);

    console.log(' Adding design tables...');
    await addDesignTables(db);

    console.log(' Adding price tables...');
    await addPriceTables(db);

    console.log(' Adding user tables...');
    await addUserTables(db);

    console.log(' Adding analytics tables...');
    await addAnalyticsTables(db);

    console.log(' Adding testimonial tables...');
    await addTestimonialTables(db);

    console.log(' Adding invoice tables...');
    await addInvoiceTables(db);

    console.log(' Adding SMS routing settings...');
    await addSmsRoutingTables(db);

    console.log(' Checking and fixing payroll schema...');
    await fixPayrollSchema(db);

    console.log(' Adding quick quote tables...');
    await addQuickQuoteTables(db);

    console.log(' Adding before/after photo columns...');
    await addBeforeAfterPhotoColumns(db);

    console.log(' Adding Instagram tables...');
    await addInstagramTables(db);

    console.log(' Updating timeline tables for standalone support...');
    await updateTimelineTablesForStandalone(db);

    console.log(' Adding appointment booking tables...');
    await addAppointmentTables(db);

    console.log(' Adding virtual showroom tables...');
    await addShowroomTables(db);

    console.log(' Adding showroom material swapping tables...');
    await addShowroomMaterialTables(db);

    console.log('\n✅ Database initialization completed successfully!');

  } catch (error) {
    console.error(' Error during database initialization:', error);
    throw error;
  } finally {
    await db.close();
  }

  // Run data cleanup for privacy compliance (24-month retention)
  // Runs after database initialization with its own connection
  console.log(' Running data cleanup (privacy compliance)...');
  const { cleanupOldAnalytics } = require('./utils/data-cleanup');
  await cleanupOldAnalytics();
}

async function createBasicTables(db) {
  // Photos table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS photos(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT,
      category TEXT NOT NULL,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      file_size INTEGER,
      mime_type TEXT,
      width INTEGER,
      height INTEGER,
      featured BOOLEAN DEFAULT 0,
      display_order INTEGER DEFAULT 0,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Categories table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      icon TEXT,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Photo metadata table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS photo_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      photo_id INTEGER NOT NULL,
      meta_key TEXT NOT NULL,
      meta_value TEXT,
      FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
    )
  `);

  // Employees table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      bio TEXT,
      email TEXT,
      phone TEXT,
      photo_path TEXT,
      photo_filename TEXT,
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      joined_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_photos_category ON photos(category);
    CREATE INDEX IF NOT EXISTS idx_photos_featured ON photos(featured);
    CREATE INDEX IF NOT EXISTS idx_photos_uploaded ON photos(uploaded_at);
    CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
    CREATE INDEX IF NOT EXISTS idx_employees_order ON employees(display_order);
  `);

  // Insert default categories
  const categories = [
    { name: 'Kitchen', slug: 'kitchen', icon: '🍳', order: 1 },
    { name: 'Bathroom', slug: 'bathroom', icon: '🚿', order: 2 },
    { name: 'Living Room', slug: 'livingroom', icon: '🛋️', order: 3 },
    { name: 'Bedroom', slug: 'bedroom', icon: '🛏️', order: 4 },
    { name: 'Laundry Room', slug: 'laundryroom', icon: '🧺', order: 5 },
    { name: 'Showcase', slug: 'showcase', icon: '✨', order: 6 }
  ];

  for (const cat of categories) {
    await db.run(
      'INSERT OR IGNORE INTO categories (name, slug, icon, display_order) VALUES (?, ?, ?, ?)',
      [cat.name, cat.slug, cat.icon, cat.order]
    );
  }

  console.log(' Created basic tables and default categories');
}

async function addDesignTables(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS designs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      client_email TEXT,
      client_phone TEXT,
      contact_preference TEXT NOT NULL,
      kitchen_data TEXT,
      bathroom_data TEXT,
      include_kitchen BOOLEAN DEFAULT 0,
      include_bathroom BOOLEAN DEFAULT 0,
      total_price DECIMAL(10, 2),
      comments TEXT,
      pdf_data BLOB,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      viewed_at DATETIME,
      viewed_by TEXT,
      floor_plan_image TEXT,
      wall_view_images TEXT
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_designs_status ON designs(status);
    CREATE INDEX IF NOT EXISTS idx_designs_created ON designs(created_at);
    CREATE INDEX IF NOT EXISTS idx_designs_client ON designs(client_name);
  `);

  console.log(' Created designs table');
}

async function addPriceTables(db) {
  // Cabinet prices table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS cabinet_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cabinet_type TEXT NOT NULL UNIQUE,
      base_price DECIMAL(10, 2) NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )
  `);

  // Create material pricing table with old structure first, then migrate
  await db.exec(`
    CREATE TABLE IF NOT EXISTS material_pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_type TEXT NOT NULL UNIQUE,
      multiplier DECIMAL(3, 2) NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )
  `);

  // Now migrate to bilingual structure if needed
  try {
    // Check if old structure exists
    const tableInfo = await db.all("PRAGMA table_info(material_pricing)");
    const hasOldStructure = tableInfo.some(col => col.name === 'material_type');
    const hasNewStructure = tableInfo.some(col => col.name === 'material_name_en');

    if (hasOldStructure && !hasNewStructure) {
      console.log('🔄 Migrating material_pricing table to bilingual structure...');

      // Get existing data
      const existingMaterials = await db.all('SELECT * FROM material_pricing');

      // Create new table with bilingual structure
      await db.exec(`
        CREATE TABLE material_pricing_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          material_name_en TEXT NOT NULL,
          material_name_es TEXT NOT NULL,
          multiplier DECIMAL(3, 2) NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_by TEXT,
          UNIQUE(material_name_en, material_name_es)
        )
      `);

      // Migrate data with appropriate translations
      const materialTranslations = {
        'laminate': { en: 'Laminate', es: 'Laminado' },
        'wood': { en: 'Wood', es: 'Madera' },
        'plywood': { en: 'Plywood', es: 'Madera Contrachapada' }
      };

      for (const material of existingMaterials) {
        const translation = materialTranslations[material.material_type.toLowerCase()] || {
          en: material.material_type.charAt(0).toUpperCase() + material.material_type.slice(1),
          es: material.material_type.charAt(0).toUpperCase() + material.material_type.slice(1)
        };

        await db.run(
          'INSERT INTO material_pricing_new (material_name_en, material_name_es, multiplier, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)',
          [translation.en, translation.es, material.multiplier, material.updated_at, material.updated_by]
        );
      }

      // Replace old table
      await db.exec('DROP TABLE material_pricing');
      await db.exec('ALTER TABLE material_pricing_new RENAME TO material_pricing');

      console.log('✓ Successfully migrated material_pricing table to bilingual structure');
    } else if (!hasOldStructure && !hasNewStructure) {
      // Fresh install - create with new structure
      await db.exec('DROP TABLE material_pricing');
      await db.exec(`
        CREATE TABLE material_pricing (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          material_name_en TEXT NOT NULL,
          material_name_es TEXT NOT NULL,
          multiplier DECIMAL(3, 2) NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_by TEXT,
          UNIQUE(material_name_en, material_name_es)
        )
      `);
      console.log('✓ Created material_pricing table with bilingual structure');
    }
  } catch (error) {
    console.error('Error handling material_pricing table structure:', error);
    throw error;
  }

  // Color pricing table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS color_pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      color_count TEXT NOT NULL UNIQUE,
      price_addition DECIMAL(10, 2) NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )
  `);

  // Wall availability table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS wall_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_type TEXT NOT NULL UNIQUE,
      is_enabled BOOLEAN DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )
  `);

  // Insert default data
  const defaultCabinetPrices = [
    ['base', 250.00], ['sink-base', 320.00], ['wall', 180.00],
    ['tall', 450.00], ['corner', 380.00], ['drawer-base', 280.00],
    ['double-drawer-base', 350.00], ['glass-wall', 220.00], ['open-shelf', 160.00],
    ['island-base', 580.00], ['peninsula-base', 420.00], ['pantry', 520.00],
    ['corner-wall', 210.00], ['lazy-susan', 450.00], ['blind-corner', 320.00],
    ['appliance-garage', 280.00], ['wine-rack', 350.00], ['spice-rack', 180.00],
    ['tray-divider', 200.00], ['pull-out-drawer', 250.00], ['soft-close-drawer', 300.00],
    ['under-cabinet-lighting', 150.00], ['vanity', 280.00], ['vanity-sink', 350.00],
    ['double-vanity', 650.00], ['floating-vanity', 420.00], ['corner-vanity', 380.00],
    ['vanity-tower', 320.00], ['medicine', 120.00], ['medicine-mirror', 180.00],
    ['linen', 350.00], ['linen-tower', 420.00], ['wall-hung-vanity', 380.00],
    ['vessel-sink-vanity', 400.00], ['undermount-sink-vanity', 380.00], ['powder-room-vanity', 250.00],
    ['master-bath-vanity', 750.00], ['kids-bathroom-vanity', 220.00]
  ];

  for (const [type, price] of defaultCabinetPrices) {
    await db.run(
      'INSERT OR IGNORE INTO cabinet_prices (cabinet_type, base_price) VALUES (?, ?)',
      [type, price]
    );
  }

  // Insert default materials (check structure first)
  const tableInfo = await db.all("PRAGMA table_info(material_pricing)");
  const hasNewStructure = tableInfo.some(col => col.name === 'material_name_en');

  if (hasNewStructure) {
    // New bilingual structure
    const defaultMaterials = [
      ['Laminate', 'Laminado', 1.0],
      ['Wood', 'Madera', 1.5],
      ['Plywood', 'Madera Contrachapada', 1.3]
    ];
    for (const [materialEn, materialEs, multiplier] of defaultMaterials) {
      await db.run(
        'INSERT OR IGNORE INTO material_pricing (material_name_en, material_name_es, multiplier) VALUES (?, ?, ?)',
        [materialEn, materialEs, multiplier]
      );
    }
  } else {
    // Old structure (should not happen due to migration above, but fallback)
    const defaultMaterials = [['laminate', 1.0], ['wood', 1.5], ['plywood', 1.3]];
    for (const [material, multiplier] of defaultMaterials) {
      await db.run(
        'INSERT OR IGNORE INTO material_pricing (material_type, multiplier) VALUES (?, ?)',
        [material, multiplier]
      );
    }
  }

  const defaultColors = [['1', 0], ['2', 100], ['3', 200], ['custom', 500]];
  for (const [count, price] of defaultColors) {
    await db.run(
      'INSERT OR IGNORE INTO color_pricing (color_count, price_addition) VALUES (?, ?)',
      [count, price]
    );
  }

  const defaultWallAvailability = [['addWall', 1], ['removeWall', 1]];
  for (const [service, enabled] of defaultWallAvailability) {
    await db.run(
      'INSERT OR IGNORE INTO wall_availability (service_type, is_enabled) VALUES (?, ?)',
      [service, enabled]
    );
  }

  // Every item the designer offers (refrigerator cabinet, appliances,
  // fixtures) and the pantry prices; never overwrites a price already set
  const { seedMissingPrices } = require('./utils/price-defaults');
  const seeded = await seedMissingPrices(db);
  if (seeded.cabinetPrices.length || seeded.wallPricing.length) {
    console.log(' Added missing prices:', seeded);
  }

  console.log(' Created price tables and default data');
}

async function addUserTables(db) {
  // Users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      full_name TEXT,
      is_active BOOLEAN DEFAULT 1,
      must_change_password INTEGER DEFAULT 0,
      last_login DATETIME,
      failed_login_attempts INTEGER DEFAULT 0,
      account_locked_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // User sessions table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Push tokens table - stores Expo push notification tokens for users
  await db.exec(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      device_type TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Refresh tokens table - stores long-lived refresh tokens for mobile app
  await db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      device_id TEXT,
      device_type TEXT,
      expires_at DATETIME NOT NULL,
      is_revoked BOOLEAN DEFAULT 0,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      revoked_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Activity logs table - tracks all user actions for audit trail
  await db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id INTEGER,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Password reset tokens table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Invitation tokens table - for employee invitation/sign-up system
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invitation_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      phone TEXT,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      language TEXT NOT NULL DEFAULT 'en',
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_by INTEGER NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Time clock entries table - tracks employee clock in/out
  await db.exec(`
    CREATE TABLE IF NOT EXISTS time_clock_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      employee_name TEXT NOT NULL,
      clock_in_time DATETIME NOT NULL,
      clock_out_time DATETIME,
      total_hours REAL,
      regular_hours REAL,
      overtime_hours REAL,
      break_minutes INTEGER DEFAULT 0,
      notes TEXT,
      location TEXT,
      ip_address TEXT,
      status TEXT DEFAULT 'active',
      entry_method TEXT DEFAULT 'automatic',
      manually_entered_by INTEGER,
      manual_entry_reason TEXT,
      original_clock_in DATETIME,
      original_clock_out DATETIME,
      modification_count INTEGER DEFAULT 0,
      pay_period_id INTEGER,
      is_deleted BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      edited_at DATETIME,
      FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (manually_entered_by) REFERENCES users(id),
      FOREIGN KEY (pay_period_id) REFERENCES pay_periods(id)
    )
  `);

  // Time clock breaks table - tracks breaks within shifts
  await db.exec(`
    CREATE TABLE IF NOT EXISTS time_clock_breaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time_entry_id INTEGER NOT NULL,
      break_start DATETIME NOT NULL,
      break_end DATETIME,
      duration_minutes INTEGER,
      break_type TEXT DEFAULT 'unpaid',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (time_entry_id) REFERENCES time_clock_entries(id) ON DELETE CASCADE
    )
  `);

  // Time entry modifications table - audit trail for edits
  await db.exec(`
    CREATE TABLE IF NOT EXISTS time_entry_modifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time_entry_id INTEGER NOT NULL,
      modified_by INTEGER NOT NULL,
      modified_by_name TEXT NOT NULL,
      modification_type TEXT NOT NULL,
      old_clock_in DATETIME,
      old_clock_out DATETIME,
      old_total_hours REAL,
      new_clock_in DATETIME,
      new_clock_out DATETIME,
      new_total_hours REAL,
      reason TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (time_entry_id) REFERENCES time_clock_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (modified_by) REFERENCES users(id)
    )
  `);

  // Employee payroll info table - stores pay configuration per employee
  await db.exec(`
    CREATE TABLE IF NOT EXISTS employee_payroll_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL UNIQUE,
      employment_type TEXT NOT NULL DEFAULT 'hourly',
      pay_schedule TEXT NOT NULL DEFAULT 'biweekly',
      hourly_rate REAL,
      annual_salary REAL,
      overtime_rate REAL,
      tax_rate REAL,
      save_tax_rate BOOLEAN DEFAULT 0,
      hire_date DATE,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Pay periods table - defines pay period boundaries
  await db.exec(`
    CREATE TABLE IF NOT EXISTS pay_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_type TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      pay_date DATE,
      status TEXT DEFAULT 'active',
      total_employees INTEGER DEFAULT 0,
      total_hours REAL DEFAULT 0,
      total_gross_pay REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      closed_by INTEGER,
      FOREIGN KEY (closed_by) REFERENCES users(id)
    )
  `);

  // Payroll summaries table - summary per employee per pay period
  await db.exec(`
    CREATE TABLE IF NOT EXISTS payroll_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pay_period_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      employee_name TEXT NOT NULL,
      employment_type TEXT NOT NULL,
      total_hours REAL DEFAULT 0,
      regular_hours REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      hourly_rate REAL,
      overtime_rate REAL,
      gross_pay REAL DEFAULT 0,
      estimated_taxes REAL DEFAULT 0,
      estimated_net_pay REAL DEFAULT 0,
      is_approved BOOLEAN DEFAULT 0,
      approved_by INTEGER,
      approved_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pay_period_id) REFERENCES pay_periods(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    )
  `);

  // Admin preferences table - per-admin settings
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL UNIQUE,
      suppress_manual_entry_warning BOOLEAN DEFAULT 0,
      default_export_format TEXT DEFAULT 'csv',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Site analytics table(not used yet but for future use)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS site_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_path TEXT NOT NULL,
      visitor_ip TEXT,
      visitor_id TEXT,
      referrer TEXT,
      user_agent TEXT,
      session_duration INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(is_active);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(is_revoked);
    CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_created ON site_analytics(created_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_page ON site_analytics(page_path);
    CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_reset_expires ON password_reset_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id);
    
    CREATE INDEX IF NOT EXISTS idx_invitation_token ON invitation_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_invitation_expires ON invitation_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_invitation_email ON invitation_tokens(email);
    CREATE INDEX IF NOT EXISTS idx_invitation_phone ON invitation_tokens(phone);
    CREATE INDEX IF NOT EXISTS idx_invitation_created_by ON invitation_tokens(created_by);
    
    CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON time_clock_entries(employee_id);
    CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON time_clock_entries(clock_in_time);
    CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_clock_entries(status);
    CREATE INDEX IF NOT EXISTS idx_time_entries_pay_period ON time_clock_entries(pay_period_id);
    CREATE INDEX IF NOT EXISTS idx_time_entries_deleted ON time_clock_entries(is_deleted);
    CREATE INDEX IF NOT EXISTS idx_time_breaks_entry ON time_clock_breaks(time_entry_id);
    CREATE INDEX IF NOT EXISTS idx_time_mods_entry ON time_entry_modifications(time_entry_id);
    CREATE INDEX IF NOT EXISTS idx_time_mods_modified_by ON time_entry_modifications(modified_by);
    CREATE INDEX IF NOT EXISTS idx_payroll_info_employee ON employee_payroll_info(employee_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_info_active ON employee_payroll_info(is_active);
    CREATE INDEX IF NOT EXISTS idx_pay_periods_dates ON pay_periods(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_pay_periods_status ON pay_periods(status);
    CREATE INDEX IF NOT EXISTS idx_payroll_summaries_period ON payroll_summaries(pay_period_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_summaries_employee ON payroll_summaries(employee_id);
    CREATE INDEX IF NOT EXISTS idx_admin_prefs_admin ON admin_preferences(admin_id);
  `);

  // Add admin_note column to designs table if it doesn't exist (migration)
  try {
    await db.exec(`ALTER TABLE designs ADD COLUMN admin_note TEXT`);
    console.log('✓ Added admin_note column to designs table');
  } catch (error) {
    // Column already exists, ignore error
    if (!error.message.includes('duplicate column name')) {
      console.error('Error adding admin_note column:', error);
    }
  }

  // Migration: Add failed login tracking columns to users table if they don't exist
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0`);
    console.log('✓ Added failed_login_attempts column to users table');
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.error('Error adding failed_login_attempts column:', error);
    }
  }

  try {
    await db.exec(`ALTER TABLE users ADD COLUMN account_locked_until DATETIME`);
    console.log('✓ Added account_locked_until column to users table');
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.error('Error adding account_locked_until column:', error);
    }
  }

  // Migration: Add must_change_password column to users table if it doesn't exist
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0`);
    console.log('✓ Added must_change_password column to users table');
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.error('Error adding must_change_password column:', error);
    }
  }

  // Migration: Update existing superadmin user to require password change
 

  // Migration: Add session tracking columns to user_sessions table if they don't exist
  try {
    // SQLite doesn't allow non-constant defaults in ALTER TABLE, so we use NULL and update after
    await db.exec(`ALTER TABLE user_sessions ADD COLUMN last_activity DATETIME`);
    console.log('✓ Added last_activity column to user_sessions table');

    // Set default value for existing rows
    await db.run(`UPDATE user_sessions SET last_activity = created_at WHERE last_activity IS NULL`);
    console.log('✓ Set default values for last_activity column');
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.error('Error adding last_activity column:', error);
    }
  }

  try {
    await db.exec(`ALTER TABLE user_sessions ADD COLUMN ip_address TEXT`);
    console.log('✓ Added ip_address column to user_sessions table');
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.error('Error adding ip_address column:', error);
    }
  }

  try {
    await db.exec(`ALTER TABLE user_sessions ADD COLUMN user_agent TEXT`);
    console.log('✓ Added user_agent column to user_sessions table');
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.error('Error adding user_agent column:', error);
    }
  }

  // Migration: Add user_name and details columns to activity_logs table if they don't exist
  try {
    await db.exec(`ALTER TABLE activity_logs ADD COLUMN user_name TEXT`);
    console.log('✓ Added user_name column to activity_logs table');
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.error('Error adding user_name column:', error);
    }
  }

  try {
    await db.exec(`ALTER TABLE activity_logs ADD COLUMN details TEXT`);
    console.log('✓ Added details column to activity_logs table');
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.error('Error adding details column:', error);
    }
  }

  // Create default admin user
  const existingAdmin = await db.get('SELECT id FROM users WHERE username = ?', ['superadmin']);

  if (!existingAdmin) {
    const defaultPassword = await bcrypt.hash('changeme123', 12);

    await db.run(
      'INSERT INTO users (username, email, password_hash, role, full_name, must_change_password) VALUES (?, ?, ?, ?, ?, ?)',
      ['superadmin', 'admin@gudinocustom.com', defaultPassword, 'super_admin', 'Super Administrator', 1]
    );

    console.log(' Created default super admin user (username: superadmin, password: changeme123)');
    console.log('⚠️  WARNING: You MUST change this password on first login!');
  } else {
    console.log(' Super admin user already exists');
  }

  console.log(' Created user authentication system');
}

async function addAnalyticsTables(db) {
  // Page analytics table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS page_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_path TEXT NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      referrer TEXT,
      session_id TEXT,
      user_id INTEGER,
      time_spent_seconds INTEGER,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create indexes for analytics
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_page_analytics_path ON page_analytics(page_path);
    CREATE INDEX IF NOT EXISTS idx_page_analytics_viewed ON page_analytics(viewed_at);
    CREATE INDEX IF NOT EXISTS idx_page_analytics_session ON page_analytics(session_id);
    CREATE INDEX IF NOT EXISTS idx_page_analytics_user ON page_analytics(user_id);
  `);

  console.log(' Created analytics tables');
}

async function addTestimonialTables(db) {
  // Testimonial tokens table for tracking sent links
  await db.exec(`
    CREATE TABLE IF NOT EXISTS testimonial_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      project_type TEXT,
      sent_by INTEGER,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      opened_count INTEGER DEFAULT 0,
      first_opened_at DATETIME,
      last_opened_at DATETIME,
      status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'opened', 'submitted')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sent_by) REFERENCES users(id)
    )
  `);

  // Testimonials table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      client_email TEXT,
      message TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      project_type TEXT,
      is_visible BOOLEAN DEFAULT 1,
      token_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      approved_by INTEGER,
      FOREIGN KEY (token_id) REFERENCES testimonial_tokens(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    )
  `);

  // Testimonial photos table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS testimonial_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      testimonial_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      file_size INTEGER,
      mime_type TEXT,
      width INTEGER,
      height INTEGER,
      display_order INTEGER DEFAULT 0,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (testimonial_id) REFERENCES testimonials(id) ON DELETE CASCADE
    )
  `);

  // Testimonial link tracking table for tracking link opens
  // Privacy-compliant: Only stores city-level geolocation (NO precise lat/long)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS testimonial_link_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL,
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      user_agent TEXT,
      referer TEXT,
      city TEXT,
      region TEXT,
      country TEXT,
      country_code TEXT,
      FOREIGN KEY (token) REFERENCES testimonial_tokens(token) ON DELETE CASCADE
    )
  `);

  // Migration: Add new columns to existing testimonial_tokens table
  try {
    // Check if columns exist and add them if they don't
    const tableInfo = await db.all('PRAGMA table_info(testimonial_tokens)');
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('opened_count')) {
      await db.exec('ALTER TABLE testimonial_tokens ADD COLUMN opened_count INTEGER DEFAULT 0');
    }
    if (!columnNames.includes('first_opened_at')) {
      await db.exec('ALTER TABLE testimonial_tokens ADD COLUMN first_opened_at DATETIME');
    }
    if (!columnNames.includes('last_opened_at')) {
      await db.exec('ALTER TABLE testimonial_tokens ADD COLUMN last_opened_at DATETIME');
    }
    if (!columnNames.includes('status')) {
      await db.exec("ALTER TABLE testimonial_tokens ADD COLUMN status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'opened', 'submitted'))");
    }
  } catch (migrationError) {
    console.warn(' Migration warning:', migrationError.message);
  }

  // Migration: Remove latitude and longitude columns for privacy compliance
  try {
    console.log(' 🔒 Privacy compliance migration: Removing precise geolocation data...');
    const trackingTableInfo = await db.all('PRAGMA table_info(testimonial_link_tracking)');
    const trackingColumnNames = trackingTableInfo.map(col => col.name);

    if (trackingColumnNames.includes('latitude') || trackingColumnNames.includes('longitude')) {
      console.log('   Found lat/long columns in testimonial_link_tracking, removing...');

      // SQLite doesn't support DROP COLUMN in older versions, so we recreate the table
      await db.exec('BEGIN TRANSACTION');

      // Create new table without lat/long
      await db.exec(`
        CREATE TABLE IF NOT EXISTS testimonial_link_tracking_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT NOT NULL,
          opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          ip_address TEXT,
          user_agent TEXT,
          referer TEXT,
          city TEXT,
          region TEXT,
          country TEXT,
          country_code TEXT,
          FOREIGN KEY (token) REFERENCES testimonial_tokens(token) ON DELETE CASCADE
        )
      `);

      // Copy data from old table (excluding lat/long)
      await db.exec(`
        INSERT INTO testimonial_link_tracking_new
        (id, token, opened_at, ip_address, user_agent, referer, city, region, country, country_code)
        SELECT id, token, opened_at, ip_address, user_agent, referer, city, region, country, country_code
        FROM testimonial_link_tracking
      `);

      // Drop old table
      await db.exec('DROP TABLE testimonial_link_tracking');

      // Rename new table
      await db.exec('ALTER TABLE testimonial_link_tracking_new RENAME TO testimonial_link_tracking');

      await db.exec('COMMIT');
      console.log('   ✅ Removed latitude and longitude columns (privacy compliance)');
    } else {
      console.log('   ✅ Lat/long columns already removed or never existed');
    }
  } catch (migrationError) {
    console.error('   ❌ Migration error (rolling back):', migrationError.message);
    try {
      await db.exec('ROLLBACK');
    } catch (rollbackError) {
      // Ignore rollback errors
    }
  }

  // Create indexes for testimonials
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_testimonial_tokens_token ON testimonial_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_testimonial_tokens_expires ON testimonial_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_testimonial_tokens_email ON testimonial_tokens(client_email);
    CREATE INDEX IF NOT EXISTS idx_testimonial_tokens_status ON testimonial_tokens(status);
    CREATE INDEX IF NOT EXISTS idx_testimonials_visible ON testimonials(is_visible);
    CREATE INDEX IF NOT EXISTS idx_testimonials_rating ON testimonials(rating);
    CREATE INDEX IF NOT EXISTS idx_testimonials_created ON testimonials(created_at);
    CREATE INDEX IF NOT EXISTS idx_testimonial_photos_testimonial ON testimonial_photos(testimonial_id);
    CREATE INDEX IF NOT EXISTS idx_testimonial_photos_order ON testimonial_photos(display_order);
    CREATE INDEX IF NOT EXISTS idx_testimonial_link_tracking_token ON testimonial_link_tracking(token);
    CREATE INDEX IF NOT EXISTS idx_testimonial_link_tracking_opened ON testimonial_link_tracking(opened_at);
  `);

  console.log(' Created testimonial tables and indexes');
}

async function addInvoiceTables(db) {
  // Clients table for invoice system
  await db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      is_business BOOLEAN DEFAULT 0,
      tax_exempt_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Line item labels for customizable dropdown options
  await db.exec(`
    CREATE TABLE IF NOT EXISTS line_item_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label_name TEXT NOT NULL UNIQUE,
      default_unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Invoices table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      invoice_number TEXT NOT NULL UNIQUE,
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      status TEXT DEFAULT 'draft',
      subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      tax_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.00,
      tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      discount_amount DECIMAL(10, 2) DEFAULT 0.00,
      markup_amount DECIMAL(10, 2) DEFAULT 0.00,
      total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      logo_url TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    )
  `);

  // Invoice line items
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      title TEXT,
      description TEXT NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
      unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      total_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      item_type TEXT DEFAULT 'material',
      line_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `);

  // Add title column to invoice_line_items if it doesn't exist (migration)
  try {
    await db.exec(`ALTER TABLE invoice_line_items ADD COLUMN title TEXT`);
    console.log(' Added title column to invoice_line_items table');
  } catch (error) {
    // Column already exists or other error - this is expected for new databases
    if (!error.message.includes('duplicate column name')) {
      console.log(' Title column already exists or other error:', error.message);
    }
  }

  // Invoice tokens for persistent client access
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      invoice_id INTEGER NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      viewed_at DATETIME,
      view_count INTEGER DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `);

  // Invoice payments tracking
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      payment_amount DECIMAL(10, 2) NOT NULL,
      payment_method TEXT NOT NULL,
      check_number TEXT,
      payment_date DATE NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Invoice reminders tracking
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      reminder_type TEXT NOT NULL, -- 'email', 'sms', 'both'
      days_overdue INTEGER DEFAULT 0,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_by INTEGER,
      message TEXT,
      successful BOOLEAN DEFAULT 1,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (sent_by) REFERENCES users(id)
    )
  `);

  // Invoice reminder settings (per invoice override)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_reminder_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL UNIQUE,
      reminders_enabled BOOLEAN DEFAULT 0, -- Default: no reminders
      reminder_days TEXT DEFAULT '7,14,30', -- Days after due date to send reminders
      last_reminder_sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `);

  // Tax rates table for multi-state support
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tax_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      state_code TEXT NOT NULL,
      city TEXT,
      tax_rate DECIMAL(5, 4) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT 1,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER,
      FOREIGN KEY (updated_by) REFERENCES users(id)
    )
  `);

  // Add description column to tax_rates table if it doesn't exist
  try {
    await db.exec(`ALTER TABLE tax_rates ADD COLUMN description TEXT`);
  } catch (error) {
    // Column might already exist, ignore error
    if (!error.message.includes('duplicate column name')) {
      console.log('Note: description column may already exist in tax_rates table');
    }
  }

  // Add balance_due column to invoices table if it doesn't exist
  try {
    await db.exec(`ALTER TABLE invoices ADD COLUMN balance_due DECIMAL(10, 2) DEFAULT 0.00`);
    console.log('✓ Added balance_due column to invoices table');

    // Update existing invoices with correct balance_due values
    const invoices = await db.all('SELECT id, total_amount FROM invoices WHERE balance_due IS NULL OR balance_due = 0');
    for (const invoice of invoices) {
      const paymentsResult = await db.get(
        'SELECT SUM(payment_amount) as total_paid FROM invoice_payments WHERE invoice_id = ?',
        [invoice.id]
      );
      const totalPaid = paymentsResult.total_paid || 0;
      const balanceDue = Math.max(0, (invoice.total_amount || 0) - totalPaid);

      await db.run('UPDATE invoices SET balance_due = ? WHERE id = ?', [balanceDue, invoice.id]);
    }
    console.log(`✓ Updated balance_due for ${invoices.length} existing invoices`);
  } catch (error) {
    // Column might already exist, ignore error
    if (!error.message.includes('duplicate column name')) {
      console.log('Note: balance_due column may already exist in invoices table');
    }
  }

  // Add client_notes and admin_notes columns to invoices table if they don't exist
  // Migration: Split existing 'notes' field into 'client_notes' (visible to clients) and 'admin_notes' (internal only)
  try {
    await db.exec(`ALTER TABLE invoices ADD COLUMN client_notes TEXT`);
    console.log('✓ Added client_notes column to invoices table');
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.log('Note: client_notes column may already exist in invoices table');
    }
  }

  try {
    await db.exec(`ALTER TABLE invoices ADD COLUMN admin_notes TEXT`);
    console.log('✓ Added admin_notes column to invoices table');
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      console.log('Note: admin_notes column may already exist in invoices table');
    }
  }

  // Migrate existing notes to client_notes (preserve backward compatibility)
  try {
    const result = await db.run(`
      UPDATE invoices
      SET client_notes = notes
      WHERE notes IS NOT NULL
        AND notes != ''
        AND (client_notes IS NULL OR client_notes = '')
    `);
    if (result.changes > 0) {
      console.log(`✓ Migrated existing notes to client_notes for ${result.changes} invoices`);
    }
  } catch (error) {
    console.log('Note: Could not migrate existing notes:', error.message);
  }

  // Create indexes for invoice tables
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
    CREATE INDEX IF NOT EXISTS idx_clients_business ON clients(is_business);
    CREATE INDEX IF NOT EXISTS idx_clients_created ON clients(created_at);
    CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON invoice_line_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_token ON invoice_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_tokens_invoice ON invoice_tokens(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_active ON invoice_tokens(is_active);
    CREATE INDEX IF NOT EXISTS idx_payments_invoice ON invoice_payments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_payments_date ON invoice_payments(payment_date);
    CREATE INDEX IF NOT EXISTS idx_tax_rates_state ON tax_rates(state_code);
    CREATE INDEX IF NOT EXISTS idx_tax_rates_active ON tax_rates(is_active);
    CREATE INDEX IF NOT EXISTS idx_reminders_invoice ON invoice_reminders(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_sent_at ON invoice_reminders(sent_at);
    CREATE INDEX IF NOT EXISTS idx_reminder_settings_invoice ON invoice_reminder_settings(invoice_id);
  `);

  // Create invoice view tracking table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      client_ip TEXT,
      user_agent TEXT,
      country TEXT,
      region TEXT,
      city TEXT,
      timezone TEXT,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_invoice_views_invoice ON invoice_views(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_invoice_views_token ON invoice_views(token);
    CREATE INDEX IF NOT EXISTS idx_invoice_views_viewed_at ON invoice_views(viewed_at);
  `);

  // Add location columns to existing invoice_views table if they don't exist
  try {
    await db.exec(`
      ALTER TABLE invoice_views ADD COLUMN country TEXT;
      ALTER TABLE invoice_views ADD COLUMN region TEXT;
      ALTER TABLE invoice_views ADD COLUMN city TEXT;
      ALTER TABLE invoice_views ADD COLUMN timezone TEXT;
    `);
  } catch (error) {
    // Columns already exist, ignore error
    console.log('Location columns already exist in invoice_views table');
  }

  // Project Timeline tables for client project tracking
  await db.exec(`
    CREATE TABLE IF NOT EXISTS project_timelines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      client_language TEXT DEFAULT 'en', -- 'en' or 'es' for bilingual support
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS timeline_phases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timeline_id INTEGER NOT NULL,
      phase_name_key TEXT NOT NULL, -- Translation key: 'design', 'materials', 'fabrication', 'installation', 'completion'
      status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
      start_date DATE,
      estimated_completion DATE,
      actual_completion DATE,
      notes TEXT,
      photos TEXT, -- JSON array of photo URLs
      phase_order INTEGER DEFAULT 0, -- For custom ordering
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (timeline_id) REFERENCES project_timelines(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for timeline tables
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_timelines_invoice ON project_timelines(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_phases_timeline ON timeline_phases(timeline_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_phases_status ON timeline_phases(status);
    CREATE INDEX IF NOT EXISTS idx_timeline_phases_order ON timeline_phases(phase_order);
  `);

  console.log(' Created invoice system tables and default data');
}

async function addSmsRoutingTables(db) {
  // SMS routing settings for different message types
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sms_routing_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_type TEXT NOT NULL UNIQUE, -- 'design_submission', 'invoice_reminder', 'test_sms'
      is_enabled BOOLEAN DEFAULT 1,
      routing_mode TEXT DEFAULT 'single', -- 'single', 'all', 'rotation'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // SMS routing recipients for each message type
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sms_routing_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_type TEXT NOT NULL,
      employee_id INTEGER,
      phone_number TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      priority_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
    )
  `);

  // SMS routing history for tracking message delivery
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sms_routing_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_type TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      recipient_name TEXT,
      message_content TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      delivery_status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'failed'
      twilio_sid TEXT,
      error_message TEXT
    )
  `);

  // Create indexes for SMS routing tables
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sms_routing_message_type ON sms_routing_settings(message_type);
    CREATE INDEX IF NOT EXISTS idx_sms_recipients_message_type ON sms_routing_recipients(message_type);
    CREATE INDEX IF NOT EXISTS idx_sms_recipients_active ON sms_routing_recipients(is_active);
    CREATE INDEX IF NOT EXISTS idx_sms_recipients_priority ON sms_routing_recipients(priority_order);
    CREATE INDEX IF NOT EXISTS idx_sms_history_message_type ON sms_routing_history(message_type);
    CREATE INDEX IF NOT EXISTS idx_sms_history_sent_at ON sms_routing_history(sent_at);
  `);

 
  try {
    await db.run(`DELETE FROM sms_routing_recipients
      WHERE rowid NOT IN (
        SELECT MIN(rowid) FROM sms_routing_recipients GROUP BY message_type, phone_number
      )`);

    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_recipient_unique ON sms_routing_recipients(message_type, phone_number)`);
  } catch (err) {
    console.warn('Could not dedupe/create unique index for sms_routing_recipients:', err.message);
  }

  console.log(' Created SMS routing tables');
}

async function addQuickQuoteTables(db) {
  // Quick quote submissions table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS quick_quote_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      client_phone TEXT,
      client_language TEXT DEFAULT 'en',
      project_type TEXT NOT NULL,
      room_dimensions TEXT,
      budget_range TEXT,
      preferred_materials TEXT,
      preferred_colors TEXT,
      message TEXT,
      photos TEXT,
      status TEXT DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'quote_sent', 'converted', 'closed')),
      assigned_employee_id INTEGER,
      priority BOOLEAN DEFAULT 0,
      internal_notes TEXT,
      ip_address TEXT,
      geolocation TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      contacted_at DATETIME,
      converted_at DATETIME,
      FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL
    )
  `);

  // Create indexes for quick quotes
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_quick_quotes_status ON quick_quote_submissions(status);
    CREATE INDEX IF NOT EXISTS idx_quick_quotes_submitted ON quick_quote_submissions(submitted_at);
    CREATE INDEX IF NOT EXISTS idx_quick_quotes_email ON quick_quote_submissions(client_email);
    CREATE INDEX IF NOT EXISTS idx_quick_quotes_assigned ON quick_quote_submissions(assigned_employee_id);
    CREATE INDEX IF NOT EXISTS idx_quick_quotes_priority ON quick_quote_submissions(priority);
  `);

  console.log(' Created quick quote tables and indexes');
}

async function addBeforeAfterPhotoColumns(db) {
  try {
    console.log('   Checking photos table schema...');

    // Get current table schema
    const tableInfo = await db.all(`PRAGMA table_info(photos)`);
    const columnNames = tableInfo.map(col => col.name);

    // Add photo_type column if it doesn't exist
    if (!columnNames.includes('photo_type')) {
      console.log('   Adding photo_type column...');
      // SQLite doesn't support CHECK constraints in ALTER TABLE, so add column without it
      await db.exec(`ALTER TABLE photos ADD COLUMN photo_type TEXT DEFAULT 'regular'`);
      console.log('   ✓ Added photo_type column');
    } else {
      console.log('   ✓ photo_type column already exists');
    }

    // Add comparison_pair_id column if it doesn't exist
    if (!columnNames.includes('comparison_pair_id')) {
      console.log('   Adding comparison_pair_id column...');
      await db.exec(`
        ALTER TABLE photos ADD COLUMN comparison_pair_id INTEGER
      `);
      console.log('   ✓ Added comparison_pair_id column');
    } else {
      console.log('   ✓ comparison_pair_id column already exists');
    }

    // Create index for before/after queries
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_photos_comparison_pair ON photos(comparison_pair_id);
      CREATE INDEX IF NOT EXISTS idx_photos_type ON photos(photo_type);
    `);
    console.log('   ✓ Created indexes for before/after queries');

  } catch (error) {
    console.error('   ⚠️  Error adding before/after columns:', error.message);
    // Don't throw - this is a non-critical migration
  }

  console.log(' Before/after photo columns ready');
}

async function addInstagramTables(db) {
  try {
    // Create instagram_posts table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS instagram_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id TEXT NOT NULL UNIQUE,
        media_type TEXT NOT NULL,
        media_url TEXT NOT NULL,
        permalink TEXT NOT NULL,
        caption TEXT,
        timestamp DATETIME NOT NULL,
        approved BOOLEAN DEFAULT 0,
        display_order INTEGER DEFAULT 0,
        fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for Instagram posts
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_instagram_approved ON instagram_posts(approved);
      CREATE INDEX IF NOT EXISTS idx_instagram_display_order ON instagram_posts(display_order);
      CREATE INDEX IF NOT EXISTS idx_instagram_timestamp ON instagram_posts(timestamp);
    `);

    // Create instagram_settings table for storing API credentials and refresh token
    // UPDATED: Added instagram_business_account_id for new Instagram Graph API (Basic Display API deprecated Dec 4, 2024)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS instagram_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        access_token TEXT,
        token_expires_at DATETIME,
        last_fetch_at DATETIME,
        auto_refresh_enabled BOOLEAN DEFAULT 0,
        instagram_business_account_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add instagram_business_account_id column if it doesn't exist (migration for existing databases)
    try {
      await db.exec(`ALTER TABLE instagram_settings ADD COLUMN instagram_business_account_id TEXT`);
      console.log('[DB INIT] Added instagram_business_account_id column to instagram_settings');
    } catch (e) {
      // Column already exists, ignore error
    }

    // Insert default settings row if it doesn't exist
    await db.exec(`
      INSERT OR IGNORE INTO instagram_settings (id, auto_refresh_enabled)
      VALUES (1, 0)
    `);

    // Create instagram_oembed_posts table for Meta oEmbed Read permission demo
    // This is separate from instagram_posts - only stores posts admin explicitly picks
    await db.exec(`
      CREATE TABLE IF NOT EXISTS instagram_oembed_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id TEXT NOT NULL UNIQUE,
        permalink TEXT NOT NULL,
        media_url TEXT,
        caption TEXT,
        timestamp DATETIME,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for oEmbed posts display order
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_instagram_oembed_display_order ON instagram_oembed_posts(display_order);
    `);

    console.log('   ✓ Created Instagram tables and indexes');
  } catch (error) {
    console.error('   ⚠️  Error creating Instagram tables:', error.message);
    // Don't throw - allow initialization to continue
  }

  console.log(' Instagram tables ready');
}

async function updateTimelineTablesForStandalone(db) {
  try {
    // Check if project_timelines table needs migration
    const tableInfo = await db.all(`PRAGMA table_info(project_timelines)`);
    const columnNames = tableInfo.map(col => col.name);

    // If client_name column doesn't exist, we need to migrate
    if (!columnNames.includes('client_name')) {
      console.log('   Migrating project_timelines table for standalone timeline support...');

      // Create new table with updated schema
      await db.exec(`
        CREATE TABLE IF NOT EXISTS project_timelines_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_id INTEGER, -- Now nullable for standalone timelines
          client_name TEXT, -- For standalone timelines
          client_email TEXT, -- For standalone timelines
          client_phone TEXT, -- For standalone timelines
          client_language TEXT DEFAULT 'en', -- 'en' or 'es' for bilingual support
          access_token TEXT UNIQUE, -- For standalone timeline access
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        )
      `);

      // Copy existing data
      await db.exec(`
        INSERT INTO project_timelines_new (id, invoice_id, client_language, created_at, updated_at)
        SELECT id, invoice_id, client_language, created_at, updated_at
        FROM project_timelines
      `);

      // Drop old table
      await db.exec(`DROP TABLE project_timelines`);

      // Rename new table
      await db.exec(`ALTER TABLE project_timelines_new RENAME TO project_timelines`);

      // Recreate indexes
      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_timelines_invoice ON project_timelines(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_timelines_access_token ON project_timelines(access_token);
      `);

      console.log('   ✓ Migrated project_timelines table for standalone support');
    } else {
      console.log('   ✓ project_timelines table already supports standalone timelines');
    }
  } catch (error) {
    console.error('   ⚠️  Error updating timeline tables:', error.message);
    // Don't throw - allow initialization to continue
  }

  console.log(' Timeline tables updated');
}

async function addAppointmentTables(db) {
  try {
    // Appointments table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        client_language TEXT DEFAULT 'en', -- 'en' or 'es'
        appointment_type TEXT NOT NULL, -- 'consultation', 'measurement', 'estimate', 'followup'
        appointment_date DATETIME NOT NULL,
        duration INTEGER NOT NULL DEFAULT 60, -- Duration in minutes
        status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'cancelled', 'completed', 'no_show'
        location_address TEXT,
        notes TEXT,
        assigned_employee_id INTEGER,
        reminder_sent BOOLEAN DEFAULT 0,
        cancellation_token TEXT UNIQUE, -- Token for cancel/reschedule link
        cancelled_at DATETIME,
        cancellation_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL
      )
    `);

    // Employee availability table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS employee_availability (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_available BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);

    // Blocked times table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS blocked_times (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        start_datetime DATETIME NOT NULL,
        end_datetime DATETIME NOT NULL,
        reason TEXT NOT NULL, -- 'vacation', 'meeting', 'personal', 'other'
        notes TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Create indexes for appointment tables
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
      CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
      CREATE INDEX IF NOT EXISTS idx_appointments_employee ON appointments(assigned_employee_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_client_email ON appointments(client_email);
      CREATE INDEX IF NOT EXISTS idx_appointments_cancellation_token ON appointments(cancellation_token);
      CREATE INDEX IF NOT EXISTS idx_employee_availability_employee ON employee_availability(employee_id);
      CREATE INDEX IF NOT EXISTS idx_employee_availability_day ON employee_availability(day_of_week);
      CREATE INDEX IF NOT EXISTS idx_blocked_times_employee ON blocked_times(employee_id);
      CREATE INDEX IF NOT EXISTS idx_blocked_times_dates ON blocked_times(start_datetime, end_datetime);
    `);

    console.log('   ✓ Created appointment booking tables and indexes');
  } catch (error) {
    console.error('   ⚠️  Error creating appointment tables:', error.message);
    // Don't throw - allow initialization to continue
  }

  console.log(' Appointment booking tables ready');
}

async function fixPayrollSchema(db) {
  try {
    console.log('   Checking employee_payroll_info schema...');
    
    // Get current table schema
    const tableInfo = await db.all(`PRAGMA table_info(employee_payroll_info)`);
    const columnNames = tableInfo.map(col => col.name);
    
    console.log('   Current columns:', columnNames.join(', '));
    
    // Check if we need to migrate from old schema to new schema
    const needsMigration = 
      columnNames.includes('annual_salary') || 
      columnNames.includes('pay_schedule');
    
    if (needsMigration) {
      console.log('   ⚠️  Old schema detected - performing migration...');
      
      // Step 1: Rename old table
      await db.exec(`ALTER TABLE employee_payroll_info RENAME TO employee_payroll_info_old`);
      console.log('   ✓ Renamed old table');
      
      // Step 2: Create new table with correct schema
      await db.exec(`
        CREATE TABLE employee_payroll_info (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id INTEGER NOT NULL UNIQUE,
          employment_type TEXT NOT NULL DEFAULT 'hourly',
          hourly_rate REAL,
          overtime_rate REAL,
          salary REAL,
          pay_period_type TEXT DEFAULT 'biweekly',
          save_tax_rate REAL DEFAULT 0,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('   ✓ Created new table with correct schema');
      
      // Step 3: Migrate data from old table to new table
      const oldData = await db.all(`SELECT * FROM employee_payroll_info_old`);
      
      for (const row of oldData) {
        await db.run(`
          INSERT INTO employee_payroll_info (
            employee_id, employment_type, hourly_rate, overtime_rate, 
            salary, pay_period_type, save_tax_rate, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          row.employee_id,
          row.employment_type || 'hourly',
          row.hourly_rate || null,
          row.overtime_rate || null,
          row.annual_salary || row.salary || null, // Map annual_salary to salary
          row.pay_schedule || row.pay_period_type || 'biweekly', // Map pay_schedule to pay_period_type
          row.save_tax_rate || row.tax_rate || 0,
          row.is_active !== undefined ? row.is_active : 1,
          row.created_at || new Date().toISOString(),
          row.updated_at || new Date().toISOString()
        ]);
      }
      
      console.log(`   ✓ Migrated ${oldData.length} payroll records`);
      
      // Step 4: Drop old table
      await db.exec(`DROP TABLE employee_payroll_info_old`);
      console.log('   ✓ Dropped old table');
      
      console.log('   ✅ Payroll schema migration completed successfully!');
    } else {
      console.log('   ✓ Payroll schema is up to date');
    }
  } catch (error) {
    console.error('   ❌ Error fixing payroll schema:', error.message);
    // Don't throw - allow initialization to continue
  }
}

async function addShowroomTables(db) {
  try {
    // Showroom rooms table - stores 360° panorama images for each room/area
    await db.exec(`
      CREATE TABLE IF NOT EXISTS showroom_rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_name_en TEXT NOT NULL,
        room_name_es TEXT NOT NULL,
        room_description_en TEXT,
        room_description_es TEXT,
        image_360_url TEXT NOT NULL, -- Path to 360° image
        thumbnail_url TEXT, -- Preview thumbnail
        display_order INTEGER DEFAULT 0,
        is_enabled BOOLEAN DEFAULT 1,
        is_starting_room BOOLEAN DEFAULT 0,
        category TEXT DEFAULT 'showroom', -- 'showroom', 'workshop', 'gallery'
        default_yaw FLOAT DEFAULT 0, -- Starting horizontal angle (degrees)
        default_pitch FLOAT DEFAULT 0, -- Starting vertical angle (degrees)
        default_hfov FLOAT DEFAULT 100, -- Horizontal field of view
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Showroom hotspots table - interactive points on 360° images
    await db.exec(`
      CREATE TABLE IF NOT EXISTS showroom_hotspots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        hotspot_type TEXT NOT NULL, -- 'info', 'link_designer', 'link_room', 'link_material'
        position_yaw FLOAT NOT NULL, -- Horizontal position (degrees)
        position_pitch FLOAT NOT NULL, -- Vertical position (degrees)
        icon TEXT DEFAULT 'info', -- Icon identifier: 'info', 'cabinet', 'arrow', 'material'
        title_en TEXT,
        title_es TEXT,
        content_en TEXT, -- Description or info content
        content_es TEXT,
        link_url TEXT, -- For link_designer or link_material types
        link_room_id INTEGER, -- For link_room type (navigation to another room)
        cabinet_type TEXT, -- For link_designer type (pre-select cabinet)
        image_url TEXT, -- Optional image to show in info popup
        is_enabled BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES showroom_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (link_room_id) REFERENCES showroom_rooms(id) ON DELETE SET NULL
      )
    `);

    // Showroom settings table - global settings for the virtual showroom
    await db.exec(`
      CREATE TABLE IF NOT EXISTS showroom_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1), -- Only one row allowed
        welcome_message_en TEXT DEFAULT 'Welcome to our Virtual Showroom',
        welcome_message_es TEXT DEFAULT 'Bienvenido a nuestro Showroom Virtual',
        navigation_style TEXT DEFAULT 'dropdown', -- 'dropdown', 'minimap', 'arrows'
        vr_mode_enabled BOOLEAN DEFAULT 1,
        auto_rotate_enabled BOOLEAN DEFAULT 0,
        auto_rotate_speed FLOAT DEFAULT 0.5, -- Degrees per frame
        mouse_sensitivity FLOAT DEFAULT 1.0,
        show_compass BOOLEAN DEFAULT 1,
        show_zoom_controls BOOLEAN DEFAULT 1,
        showroom_visible BOOLEAN DEFAULT 0, -- Controls if showroom tab appears in navigation
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add showroom_visible column for existing databases
    try {
      await db.exec(`ALTER TABLE showroom_settings ADD COLUMN showroom_visible BOOLEAN DEFAULT 0`);
    } catch (e) {
      // Column already exists, ignore
    }

    // Insert default settings row
    await db.exec(`
      INSERT OR IGNORE INTO showroom_settings (id, welcome_message_en, welcome_message_es)
      VALUES (1, 'Welcome to our Virtual Showroom', 'Bienvenido a nuestro Showroom Virtual')
    `);

    // Create indexes for showroom tables
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_showroom_rooms_enabled ON showroom_rooms(is_enabled);
      CREATE INDEX IF NOT EXISTS idx_showroom_rooms_order ON showroom_rooms(display_order);
      CREATE INDEX IF NOT EXISTS idx_showroom_rooms_category ON showroom_rooms(category);
      CREATE INDEX IF NOT EXISTS idx_showroom_hotspots_room ON showroom_hotspots(room_id);
      CREATE INDEX IF NOT EXISTS idx_showroom_hotspots_type ON showroom_hotspots(hotspot_type);
      CREATE INDEX IF NOT EXISTS idx_showroom_hotspots_enabled ON showroom_hotspots(is_enabled);
    `);

    console.log('   ✓ Created virtual showroom tables and indexes');
  } catch (error) {
    console.error('   ⚠️  Error creating showroom tables:', error.message);
    // Don't throw - allow initialization to continue
  }

  console.log(' Virtual showroom tables ready');
}

// Showroom Material Swapping Tables
// Enables users to click on elements in the 360° panorama and swap materials/finishes
async function addShowroomMaterialTables(db) {
  try {
    // Material categories table (flooring, countertops, cabinet finishes, etc.)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS showroom_material_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_name_en TEXT NOT NULL,
        category_name_es TEXT NOT NULL,
        category_slug TEXT NOT NULL UNIQUE, -- 'flooring', 'countertop', 'cabinet', etc.
        icon TEXT, -- Icon identifier for UI
        display_order INTEGER DEFAULT 0,
        is_enabled BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Materials table - available materials/finishes that can be applied
    await db.exec(`
      CREATE TABLE IF NOT EXISTS showroom_materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        material_name_en TEXT NOT NULL,
        material_name_es TEXT NOT NULL,
        material_code TEXT, -- SKU or product code
        thumbnail_url TEXT, -- Small preview image for UI picker
        texture_url TEXT, -- Full texture image for 3D rendering
        normal_map_url TEXT, -- Optional normal map for surface detail
        color_hex TEXT, -- Fallback color if no texture
        roughness FLOAT DEFAULT 0.5, -- PBR roughness (0-1)
        metalness FLOAT DEFAULT 0.0, -- PBR metalness (0-1)
        repeat_scale_x FLOAT DEFAULT 1.0, -- Texture repeat horizontal
        repeat_scale_y FLOAT DEFAULT 1.0, -- Texture repeat vertical
        price_indicator TEXT, -- '$', '$$', '$$$' for price range display
        is_enabled BOOLEAN DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES showroom_material_categories(id) ON DELETE CASCADE
      )
    `);

    // Swappable elements table - defines clickable regions in the panorama
    await db.exec(`
      CREATE TABLE IF NOT EXISTS showroom_swappable_elements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        element_name_en TEXT NOT NULL,
        element_name_es TEXT NOT NULL,
        element_type TEXT NOT NULL, -- 'floor', 'wall', 'countertop', 'cabinet', 'backsplash', 'furniture'
        uv_bounds TEXT NOT NULL, -- JSON: { minU, maxU, minV, maxV } or polygon points for region
        highlight_color TEXT DEFAULT '#f59e0b', -- Color when hovered/selected
        default_material_id INTEGER, -- Default material variant to show
        is_enabled BOOLEAN DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES showroom_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (default_material_id) REFERENCES showroom_materials(id) ON DELETE SET NULL
      )
    `);

    // Element-material links table - which materials are available for each element
    await db.exec(`
      CREATE TABLE IF NOT EXISTS showroom_element_material_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        element_id INTEGER NOT NULL,
        material_id INTEGER NOT NULL,
        is_default BOOLEAN DEFAULT 0, -- Is this the default material for this element?
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (element_id) REFERENCES showroom_swappable_elements(id) ON DELETE CASCADE,
        FOREIGN KEY (material_id) REFERENCES showroom_materials(id) ON DELETE CASCADE,
        UNIQUE(element_id, material_id)
      )
    `);

    // Add use_threejs_viewer setting to showroom_settings if not exists
    const settingsColumns = await db.all("PRAGMA table_info(showroom_settings)");
    const hasThreejsColumn = settingsColumns.some(col => col.name === 'use_threejs_viewer');
    if (!hasThreejsColumn) {
      await db.exec(`ALTER TABLE showroom_settings ADD COLUMN use_threejs_viewer BOOLEAN DEFAULT 0`);
      console.log('   ✓ Added use_threejs_viewer column to showroom_settings');
    }

    // Add polygon_points column to showroom_swappable_elements if not exists
    // This stores exact polygon points from 3D selection for more accurate overlays
    const elementsColumns = await db.all("PRAGMA table_info(showroom_swappable_elements)");
    const hasPolygonColumn = elementsColumns.some(col => col.name === 'polygon_points');
    if (!hasPolygonColumn) {
      await db.exec(`ALTER TABLE showroom_swappable_elements ADD COLUMN polygon_points TEXT`);
      console.log('   ✓ Added polygon_points column to showroom_swappable_elements');
    }

    // Create indexes for material tables
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_showroom_material_categories_enabled ON showroom_material_categories(is_enabled);
      CREATE INDEX IF NOT EXISTS idx_showroom_material_categories_slug ON showroom_material_categories(category_slug);
      CREATE INDEX IF NOT EXISTS idx_showroom_materials_category ON showroom_materials(category_id);
      CREATE INDEX IF NOT EXISTS idx_showroom_materials_enabled ON showroom_materials(is_enabled);
      CREATE INDEX IF NOT EXISTS idx_showroom_swappable_elements_room ON showroom_swappable_elements(room_id);
      CREATE INDEX IF NOT EXISTS idx_showroom_swappable_elements_enabled ON showroom_swappable_elements(is_enabled);
      CREATE INDEX IF NOT EXISTS idx_showroom_element_material_links_element ON showroom_element_material_links(element_id);
      CREATE INDEX IF NOT EXISTS idx_showroom_element_material_links_material ON showroom_element_material_links(material_id);
    `);

    // Insert default material categories
    await db.exec(`
      INSERT OR IGNORE INTO showroom_material_categories (category_slug, category_name_en, category_name_es, icon, display_order)
      VALUES
        ('flooring', 'Flooring', 'Pisos', 'floor', 1),
        ('countertop', 'Countertops', 'Encimeras', 'counter', 2),
        ('cabinet', 'Cabinet Finishes', 'Acabados de Gabinetes', 'cabinet', 3),
        ('backsplash', 'Backsplash', 'Salpicadero', 'tiles', 4),
        ('wall', 'Wall Colors', 'Colores de Pared', 'paint', 5)
    `);

    console.log('   ✓ Created showroom material swapping tables and indexes');
  } catch (error) {
    console.error('   ⚠️  Error creating showroom material tables:', error.message);
    // Don't throw - allow initialization to continue
  }

  console.log(' Showroom material swapping tables ready');
}

// Only run if this file is executed directly
if (require.main === module) {
  initializeDatabase().catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
}

module.exports = { initializeDatabase };
