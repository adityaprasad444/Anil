const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  action: { type: String, required: true },
  resource_id: { type: mongoose.Schema.Types.ObjectId },
  resource_type: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ip_address: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
