const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  trackingIdFormat: {
    type: String,
    enum: ['legacy', 'custom'],
    default: 'legacy'
  },
  customPrefix: {
    type: String,
    default: 'AK',
    trim: true
  },
  customSuffix: {
    type: String,
    default: '',
    trim: true
  },
  randomLength: {
    type: Number,
    default: 6,
    min: 4,
    max: 12
  }
}, { timestamps: true });

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
