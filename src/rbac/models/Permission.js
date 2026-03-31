const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, unique: true, trim: true },
  description: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Permission', permissionSchema);
