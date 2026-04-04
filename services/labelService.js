const LabelTemplate = require('../models/LabelTemplate');
const GeneratedLabel = require('../models/GeneratedLabel');
const { TrackingData } = require('../db');
const barcodeService = require('./barcodeService');

class LabelService {
  async createTemplate(templateData, userId) {
    try {
      const template = new LabelTemplate({
        ...templateData,
        createdBy: userId
      });
      return await template.save();
    } catch (error) {
      throw new Error(`Failed to create label template: ${error.message}`);
    }
  }

  async getTemplates(userId, isActive = true) {
    try {
      const query = {};
      if (isActive !== null) {
        query.isActive = isActive;
      }
      
      const templates = await LabelTemplate.find(query).sort({ createdAt: -1 });
      return templates;
    } catch (error) {
      throw new Error(`Failed to fetch label templates: ${error.message}`);
    }
  }

  async getTemplateById(templateId, userId) {
    try {
      const template = await LabelTemplate.findOne({ _id: templateId });
      if (!template) {
        throw new Error('Label template not found');
      }
      return template;
    } catch (error) {
      throw new Error(`Failed to fetch label template: ${error.message}`);
    }
  }

  async updateTemplate(templateId, updateData, userId) {
    try {
      const template = await LabelTemplate.findOneAndUpdate(
        { _id: templateId },
        updateData,
        { new: true, runValidators: true }
      );
      if (!template) {
        throw new Error('Label template not found');
      }
      return template;
    } catch (error) {
      throw new Error(`Failed to update label template: ${error.message}`);
    }
  }

  async deleteTemplate(templateId, userId) {
    try {
      const template = await LabelTemplate.findOneAndDelete({ _id: templateId });
      if (!template) {
        throw new Error('Label template not found');
      }
      return template;
    } catch (error) {
      throw new Error(`Failed to delete label template: ${error.message}`);
    }
  }

  async generateLabel(templateId, data, userId) {
    try {
      // Validate template ID
      if (!templateId) {
        throw new Error('Template ID is required');
      }

      // Get template
      const template = await this.getTemplateById(templateId, userId);
      
      // Validate data is an object
      if (!data || typeof data !== 'object') {
        throw new Error('Label data must be an object');
      }
      
      // Validate required variables
      const missingVars = template.variables
        .filter(v => v.required && (!data[v.name] || data[v.name].trim() === ''))
        .map(v => v.name);
      
      if (missingVars.length > 0) {
        throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
      }

      // Validate variable types and formats
      const validationErrors = [];
      template.variables.forEach(variable => {
        const value = data[variable.name];
        
        if (value !== undefined && value !== null && value !== '') {
          switch (variable.type) {
            case 'number':
              if (isNaN(Number(value))) {
                validationErrors.push(`${variable.name} must be a valid number`);
              }
              break;
            case 'date':
              const dateValue = new Date(value);
              if (isNaN(dateValue.getTime())) {
                validationErrors.push(`${variable.name} must be a valid date`);
              }
              break;
            case 'email':
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (value && !emailRegex.test(value)) {
                validationErrors.push(`${variable.name} must be a valid email address`);
              }
              break;
            case 'phone':
              const phoneRegex = /^[\d\s\-\+\(\)]+$/;
              if (value && !phoneRegex.test(value)) {
                validationErrors.push(`${variable.name} must be a valid phone number`);
              }
              break;
            case 'url':
              try {
                if (value && !value.startsWith('http')) {
                  new URL('https://' + value);
                } else if (value) {
                  new URL(value);
                }
              } catch {
                validationErrors.push(`${variable.name} must be a valid URL`);
              }
              break;
          }
        }
      });

      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      // Prepare variables with defaults and formatting
      const variables = {};
      template.variables.forEach(variable => {
        let value = data[variable.name] || variable.defaultValue || '';
        
        // Apply formatting based on variable type
        variables[variable.name] = this.formatVariable(value, variable.type);
      });

      // Process template variables
      let processedTemplate = template.template;
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        processedTemplate = processedTemplate.replace(regex, variables[key]);
      });

      // Process barcode and QR code placeholders
      processedTemplate = await barcodeService.processTemplateContent(processedTemplate, data);

      // Check for any unreplaced variables
      const unreplacedVars = processedTemplate.match(/{{\s*[^}]+\s*}}/g);
      if (unreplacedVars) {
        console.warn('Unreplaced variables found:', unreplacedVars);
      }

      // Validate template content
      if (!processedTemplate || processedTemplate.trim() === '') {
        throw new Error('Generated template content is empty');
      }

      return {
        template: processedTemplate,
        dimensions: template.dimensions,
        style: template.style,
        variables: variables,
        templateName: template.name,
        unreplacedVariables: unreplacedVars || []
      };
    } catch (error) {
      throw new Error(`Failed to generate label: ${error.message}`);
    }
  }

  async generateLabelForTracking(trackingId, templateId, userId, additionalData = {}) {
    try {
      const trackingData = await TrackingData.findOne({ trackingId });
      if (!trackingData) {
        throw new Error('Tracking data not found');
      }

      const labelData = {
        trackingId: trackingData.trackingId,
        status: trackingData.status,
        provider: trackingData.provider,
        origin: trackingData.origin,
        destination: trackingData.destination,
        estimatedDelivery: trackingData.estimatedDelivery,
        weight: trackingData.weight,
        ...additionalData
      };

      return await this.generateLabel(templateId, labelData, userId);
    } catch (error) {
      throw new Error(`Failed to generate label for tracking: ${error.message}`);
    }
  }

  formatVariable(value, type) {
    if (!value) return '';
    
    switch (type) {
      case 'date':
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date.toLocaleDateString();
      case 'number':
        const num = Number(value);
        return isNaN(num) ? value : num.toLocaleString();
      case 'email':
        return value.toLowerCase().trim();
      case 'phone':
        // Format phone number to standard format
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length === 10) {
          return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        return value;
      case 'url':
        // Ensure URL has protocol
        if (value && !value.startsWith('http')) {
          return `https://${value}`;
        }
        return value;
      case 'barcode':
        return `[BARCODE:${value}]`;
      case 'qrcode':
        return `[QRCODE:${value}]`;
      case 'text':
      default:
        return String(value).trim();
    }
  }

  async getPreviewData(templateId, userId) {
    try {
      const template = await this.getTemplateById(templateId, userId);
      
      const previewData = {};
      template.variables.forEach(variable => {
        switch (variable.type) {
          case 'text':
            if (variable.name === 'fromAddress') {
              previewData[variable.name] = variable.defaultValue || 'John Doe\n123 Main Street\nSuite 100\nNew York, NY 10001\n(555) 123-4567\njohn@example.com';
            } else if (variable.name === 'toAddress') {
              previewData[variable.name] = variable.defaultValue || 'Jane Smith\n456 Oak Avenue\nApt 2B\nLos Angeles, CA 90001\n(555) 987-6543\njane@example.com';
            } else {
              previewData[variable.name] = variable.defaultValue || 'Sample Text';
            }
            break;
          case 'number':
            previewData[variable.name] = variable.defaultValue || '123';
            break;
          case 'date':
            previewData[variable.name] = variable.defaultValue || new Date().toISOString().split('T')[0];
            break;
          case 'email':
            previewData[variable.name] = variable.defaultValue || 'sample@example.com';
            break;
          case 'phone':
            previewData[variable.name] = variable.defaultValue || '123-456-7890';
            break;
          case 'url':
            previewData[variable.name] = variable.defaultValue || 'https://example.com';
            break;
          case 'barcode':
            previewData[variable.name] = variable.defaultValue || 'AK123456789US';
            break;
          case 'qrcode':
            previewData[variable.name] = variable.defaultValue || 'https://aklogistics.com/track/123456789';
            break;
          default:
            previewData[variable.name] = variable.defaultValue || 'Sample Value';
        }
      });

      return await this.generateLabel(templateId, previewData, userId);
    } catch (error) {
      throw new Error(`Failed to generate preview: ${error.message}`);
    }
  }

  async saveGeneratedLabel(templateId, data, userId, trackingId = null) {
    try {
      console.log('🏷️ LabelService.saveGeneratedLabel called:', { 
        templateId, 
        userId, 
        trackingId,
        hasData: !!data
      });
      
      // Validate required fields
      if (!templateId) {
        throw new Error('Template ID is required');
      }
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Generate the label first
      const generatedLabel = await this.generateLabel(templateId, data, userId);
      
      // Get template details
      const template = await this.getTemplateById(templateId, userId);
      
      // Save to database
      const savedLabel = new GeneratedLabel({
        templateId,
        templateName: template.name,
        trackingId,
        labelData: data,
        generatedHtml: generatedLabel.template,
        variables: generatedLabel.variables,
        dimensions: generatedLabel.dimensions,
        style: generatedLabel.style,
        generatedBy: userId,
        status: 'generated'
      });
      
      console.log('🏷️ About to save label with generatedBy:', userId);
      const result = await savedLabel.save();
      console.log('🏷️ Label saved successfully:', result._id);
      
      return result;
    } catch (error) {
      console.error('❌ LabelService.saveGeneratedLabel error:', error);
      throw new Error(`Failed to save generated label: ${error.message}`);
    }
  }

  async getGeneratedLabels(userId, limit = 50, offset = 0) {
    try {
      const labels = await GeneratedLabel.find({ generatedBy: userId })
        .populate('templateId', 'name')
        .sort({ generatedAt: -1 })
        .limit(limit)
        .skip(offset);
      
      const total = await GeneratedLabel.countDocuments({ generatedBy: userId });
      
      return { labels, total };
    } catch (error) {
      throw new Error(`Failed to fetch generated labels: ${error.message}`);
    }
  }

  async getGeneratedLabelById(labelId, userId) {
    try {
      const label = await GeneratedLabel.findOne({ 
        _id: labelId, 
        generatedBy: userId 
      }).populate('templateId');
      
      if (!label) {
        throw new Error('Generated label not found');
      }
      
      return label;
    } catch (error) {
      throw new Error(`Failed to fetch generated label: ${error.message}`);
    }
  }

  async updateGeneratedLabel(labelId, updateData, userId) {
    try {
      const label = await GeneratedLabel.findOneAndUpdate(
        { _id: labelId, generatedBy: userId },
        updateData,
        { new: true, runValidators: true }
      ).populate('templateId');
      
      if (!label) {
        throw new Error('Generated label not found');
      }
      
      return label;
    } catch (error) {
      throw new Error(`Failed to update generated label: ${error.message}`);
    }
  }

  async deleteGeneratedLabel(labelId, userId) {
    try {
      const label = await GeneratedLabel.findOneAndDelete({ 
        _id: labelId, 
        generatedBy: userId 
      });
      
      if (!label) {
        throw new Error('Generated label not found');
      }
      
      return label;
    } catch (error) {
      throw new Error(`Failed to delete generated label: ${error.message}`);
    }
  }
}

module.exports = new LabelService();
