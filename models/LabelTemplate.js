const mongoose = require('mongoose');

const labelTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  template: {
    type: String,
    required: true
  },
  variables: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'barcode', 'qrcode'],
      default: 'text'
    },
    required: {
      type: Boolean,
      default: false
    },
    defaultValue: String
  }],
  dimensions: {
    width: {
      type: Number,
      required: true,
      default: 100
    },
    height: {
      type: Number,
      required: true,
      default: 50
    },
    unit: {
      type: String,
      enum: ['mm', 'in', 'px'],
      default: 'mm'
    }
  },
  style: {
    fontSize: {
      type: Number,
      default: 12
    },
    fontFamily: {
      type: String,
      default: 'Arial'
    },
    alignment: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'center'
    },
    backgroundColor: {
      type: String,
      default: '#ffffff'
    },
    textColor: {
      type: String,
      default: '#000000'
    },
    borderWidth: {
      type: Number,
      default: 1
    },
    borderColor: {
      type: String,
      default: '#000000'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

labelTemplateSchema.index({ createdBy: 1, isActive: 1 });

module.exports = mongoose.model('LabelTemplate', labelTemplateSchema);
