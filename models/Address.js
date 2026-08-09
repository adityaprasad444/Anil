const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  mobile: {
    type: String,
    trim: true,
    default: ''
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  pincode: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['sender', 'recipient', 'both'],
    default: 'sender'
  },
  usageCount: {
    type: Number,
    default: 1
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

addressSchema.index({ createdBy: 1, type: 1, name: 1, mobile: 1 });
addressSchema.index({ createdBy: 1, usageCount: -1, lastUsedAt: -1 });

module.exports = mongoose.model('Address', addressSchema);
