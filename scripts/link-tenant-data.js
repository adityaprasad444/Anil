const mongoose = require('mongoose');
const { connectDB } = require('../db');
const Tenant = require('../src/rbac/models/Tenant');

const MIGRATION_COLLECTIONS = [
  'users',
  'trackingdatas',
  'providers',
  'bulkuploads',
  'emailconfigs',
  'emaillogs',
  'reports',
  'emailtemplates',
  'cronlogs'
];

async function runMigration() {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB');

    let defaultTenant = await Tenant.findOne({ name: 'aklogistics' });
    if (!defaultTenant) {
      defaultTenant = await Tenant.create({
        name: 'aklogistics',
        domain: 'aklogistics.com',
        status: 'active'
      });
      console.log('🎉 Created default tenant:', defaultTenant.name);
    } else {
      console.log('🔹 Default tenant already exists:', defaultTenant.name);
    }

    const tenantId = defaultTenant._id;
    const db = mongoose.connection.db;

    for (const collectionName of MIGRATION_COLLECTIONS) {
      try {
        const collection = db.collection(collectionName);
        const result = await collection.updateMany(
          { tenant_id: { $exists: false } },
          { $set: { tenant_id: tenantId } }
        );
        console.log(`✅ Successfully linked ${result.modifiedCount} records in [${collectionName}].`);
      } catch (err) {
        console.warn(`⚠️ Warning: Collection [${collectionName}] could not be updated.`);
      }
    }

    console.log('🚀 Migration complete! All existing data is now gracefully linked to aklogistics.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
