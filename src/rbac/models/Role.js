const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, uppercase: true, trim: true },
  description: { type: String, trim: true },
  tenant_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: function() { return !this.is_system_role; },
    default: null
  },
  is_system_role: { type: Boolean, default: false },
  parent_role_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null }
}, { timestamps: true });

roleSchema.index({ name: 1, tenant_id: 1 }, { unique: true });

module.exports = mongoose.model('Role', roleSchema);
