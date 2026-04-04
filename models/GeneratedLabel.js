const mongoose = require('mongoose');

const generatedLabelSchema = new mongoose.Schema({
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabelTemplate',
    required: true
  },
  templateName: {
    type: String,
    required: true
  },
  trackingId: {
    type: String,
    required: false
  },
  labelData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  generatedHtml: {
    type: String,
    required: true
  },
  variables: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  dimensions: {
    width: {
      type: Number,
      required: true
    },
    height: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      required: true
    }
  },
  style: {
    fontSize: Number,
    fontFamily: String,
    alignment: String,
    backgroundColor: String,
    textColor: String,
    borderWidth: Number,
    borderColor: String
  },
  status: {
    type: String,
    enum: ['generated', 'printed', 'used'],
    default: 'generated'
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  printedAt: {
    type: Date
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

generatedLabelSchema.index({ generatedBy: 1, generatedAt: -1 });
generatedLabelSchema.index({ trackingId: 1 });
generatedLabelSchema.index({ templateId: 1 });

module.exports = mongoose.model('GeneratedLabel', generatedLabelSchema);
