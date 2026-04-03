/**
 * scripts/seedPermissions.js
 * Seed all system permissions derived from the full API surface.
 * Run: node scripts/seedPermissions.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config');

// Reuse the RBAC Permission model
const Permission = require('../src/rbac/models/Permission');

const PERMISSIONS = [
  // ── Tracking ──────────────────────────────────────────────────────
  { code: 'TRACKING_READ',          description: 'View tracking entries list and details' },
  { code: 'TRACKING_CREATE',        description: 'Create a new tracking ID (single)' },
  { code: 'TRACKING_EDIT',          description: 'Edit an existing tracking entry' },
  { code: 'TRACKING_DELETE',        description: 'Delete a single tracking entry' },
  { code: 'TRACKING_REFRESH',       description: 'Manually refresh a specific tracking ID from carrier' },
  { code: 'TRACKING_REFRESH_ALL',   description: 'Trigger bulk refresh of all active tracking data' },
  { code: 'TRACKING_BULK_UPLOAD',   description: 'Bulk create tracking IDs via CSV upload' },
  { code: 'TRACKING_BULK_DELETE',   description: 'Delete multiple tracking entries at once' },
  { code: 'TRACKING_BULK_STATUS',   description: 'Update status for multiple tracking entries at once' },
  { code: 'TRACKING_STATS_READ',    description: 'View dashboard statistics (counts by status)' },

  // ── Providers ─────────────────────────────────────────────────────
  { code: 'PROVIDER_READ',          description: 'View list of carriers/providers' },
  { code: 'PROVIDER_CREATE',        description: 'Add a new carrier/provider' },
  { code: 'PROVIDER_UPDATE',        description: 'Edit an existing carrier/provider configuration' },
  { code: 'PROVIDER_DELETE',        description: 'Delete a carrier/provider' },

  // ── Reports ───────────────────────────────────────────────────────
  { code: 'REPORT_READ',            description: 'View available report types' },
  { code: 'REPORT_GENERATE',        description: 'Generate and run reports' },

  // ── Email Logs ────────────────────────────────────────────────────
  { code: 'EMAIL_LOG_READ',         description: 'View email notification logs' },
  { code: 'EMAIL_LOG_PREVIEW',      description: 'Preview HTML content of an email log entry' },

  // ── Email Configuration ───────────────────────────────────────────
  { code: 'EMAIL_CONFIG_READ',      description: 'View SMTP / email configuration' },
  { code: 'EMAIL_CONFIG_UPDATE',    description: 'Update SMTP / email configuration' },

  // ── RBAC: Roles ───────────────────────────────────────────────────
  { code: 'ROLE_READ',              description: 'View roles for the current tenant' },
  { code: 'ROLE_CREATE',            description: 'Create a new role for the current tenant' },
  { code: 'ROLE_DELETE',            description: 'Delete a non-system role for the current tenant' },

  // ── RBAC: Permissions ─────────────────────────────────────────────
  { code: 'PERMISSION_READ',        description: 'View all system permissions' },
  { code: 'PERMISSION_CREATE',      description: 'Add a new permission code to the system' },

  // ── RBAC: Tenants ─────────────────────────────────────────────────
  { code: 'TENANT_READ',            description: 'View all tenants' },
  { code: 'TENANT_CREATE',          description: 'Create a new tenant' },

  // ── RBAC: User–Role Assignment ────────────────────────────────────
  { code: 'USER_ROLE_ASSIGN',       description: 'Assign a role to a user' },

  // ── System ────────────────────────────────────────────────────────
  { code: 'SYSTEM_HEALTH_READ',     description: 'View server health and DB connection status' },
  { code: 'SYSTEM_CRON_TRIGGER',    description: 'Manually trigger cron jobs (e.g. daily report)' },
];

async function seedPermissions() {
  await mongoose.connect(config.mongo.uri);
  console.log('✅ Connected to MongoDB');

  let created = 0;
  let skipped = 0;

  for (const perm of PERMISSIONS) {
    const exists = await Permission.findOne({ code: perm.code }).lean();
    if (exists) {
      console.log(`  ⏭  Skipped (already exists): ${perm.code}`);
      skipped++;
    } else {
      await Permission.create(perm);
      console.log(`  ✅ Created: ${perm.code}`);
      created++;
    }
  }

  console.log(`\n🎉 Done. Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

seedPermissions().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
