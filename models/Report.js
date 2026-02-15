const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Core Metrics', 'Reliability & Health', 'Engagement & Quality']
  },
  lastRefreshed: {
    type: Date,
    default: null
  },
  lastData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
