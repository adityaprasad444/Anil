const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  domain: { type: String, unique: true, sparse: true, trim: true },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Tenant', tenantSchema);
