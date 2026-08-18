const LabelTemplate = require('../models/LabelTemplate');
const GeneratedLabel = require('../models/GeneratedLabel');
const { TrackingData } = require('../db');
const barcodeService = require('./barcodeService');
const contactService = require('./contactService');

const AK_LOGISTICS_A4_TEMPLATE_HTML = `<div style="font-family: Arial, Helvetica, sans-serif; width: 100%; max-width: 680px; min-height: 520px; margin: 0 auto; background: #ffffff; border: 2px solid #0f172a; border-radius: 16px; padding: 24px 20px 20px 20px; box-sizing: border-box; color: #0f172a; page-break-inside: avoid; break-inside: avoid;">
    <div class="ak-label-header-v2" style="display: flex; align-items: center; justify-content: flex-start; gap: 14px; padding-bottom: 14px; border-bottom: 2px solid #0f172a;">
        <img src="/Logos/logo.jpeg" alt="AK Logistics" style="height: 60px; max-width: 120px; object-fit: contain; display: block; flex-shrink: 0;" />
        <div style="text-align: left;">
            <div style="font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px; text-transform: uppercase;">AK Logistics</div>
            <div style="font-size: 13px; color: #475569; font-style: italic; font-weight: 600;">Delivering the Future, Today</div>
        </div>
    </div>
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding: 16px 10px; gap: 12px;">
        <div style="width: 90px; text-align: center; flex-shrink: 0;">
            [QRCODE:https://aklogistics.org]
        </div>
        <div style="flex-grow: 1; text-align: left; padding-left: 14px;">
            <div style="margin-bottom: 6px;">
                [BARCODE:{{trackingId}}]
            </div>
            <div style="font-size: 11px; font-weight: 800; color: #475569; letter-spacing: 0.5px; text-transform: uppercase;">TRACKING NUMBER:</div>
            <div style="font-size: 24px; font-weight: 900; color: #000; letter-spacing: 1px;">{{trackingId}}</div>
        </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; border-bottom: 2px solid #0f172a;">
        <div style="padding: 16px 14px; border-right: 2px solid #0f172a;">
            <div style="font-size: 14px; font-weight: 900; color: #000; margin-bottom: 8px; text-transform: uppercase;">TO:</div>
            <div style="font-size: 13px; line-height: 1.5; color: #1e293b;">{{toAddress}}</div>
        </div>
        <div style="padding: 16px 14px;">
            <div style="font-size: 14px; font-weight: 900; color: #000; margin-bottom: 8px; text-transform: uppercase;">FROM:</div>
            <div style="font-size: 13px; line-height: 1.5; color: #1e293b;">{{fromAddress}}</div>
        </div>
    </div>
    <div style="border-bottom: 2px solid #0f172a;">
        <div style="font-size: 13px; font-weight: 900; color: #000; padding: 8px 14px; background: #f1f5f9; border-bottom: 1px solid #0f172a; text-transform: uppercase;">
            SHIPMENT DETAILS:
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
                <tr style="background: #f8fafc; border-bottom: 1px solid #0f172a;">
                    <th style="padding: 10px 14px; text-align: left; font-weight: 800; width: 55%; border-right: 1px solid #cbd5e1;">Item Description</th>
                    <th style="padding: 10px 14px; text-align: center; font-weight: 800; width: 20%; border-right: 1px solid #cbd5e1;">Weight (kg)</th>
                    <th style="padding: 10px 14px; text-align: right; font-weight: 800; width: 25%;">Value (₹)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 12px 14px; font-weight: 600; color: #1e293b; border-right: 1px solid #cbd5e1;">{{itemDescription}}</td>
                    <td style="padding: 12px 14px; text-align: center; font-weight: 700; color: #1e293b; border-right: 1px solid #cbd5e1;">{{chargedWeight}}</td>
                    <td style="padding: 12px 14px; text-align: right; font-weight: 800; color: #000;">{{itemCost}}</td>
                </tr>
            </tbody>
        </table>
    </div>
    <div style="padding-top: 18px; padding-bottom: 8px; text-align: center;">
        <div style="font-size: 26px; font-weight: 900; color: #0b192c; letter-spacing: 0.5px;">www.aklogistics.org</div>
        <div style="font-size: 11px; font-weight: 800; color: #475569; margin-top: 6px; text-transform: uppercase;">
            CONTACT INFORMATION:
        </div>
        <div style="font-size: 11px; color: #334155; margin-top: 4px; line-height: 1.5;">
            Support Tel: <strong>{{supportPhone}}</strong> | Email: <strong>{{supportEmail}}</strong>
        </div>
    </div>
</div>`;

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
      
      let templates = await LabelTemplate.find(query).sort({ createdAt: -1 });

      if (templates.length === 0) {
        const defaultTmpl = new LabelTemplate({
          name: 'AK Logistics Official A4 Label',
          description: 'Official AK Logistics A4 Shipping Label with System Tracking Barcode and Website QR Code',
          template: AK_LOGISTICS_A4_TEMPLATE_HTML,
          dimensions: { width: 210, height: 297, unit: 'mm' },
          style: { fontSize: 12, fontFamily: 'Arial', alignment: 'left', backgroundColor: '#ffffff', textColor: '#0f172a', borderWidth: 2, borderColor: '#0f172a' },
          variables: [
            { name: 'fromAddress', label: 'From Address', type: 'text', required: true },
            { name: 'toAddress', label: 'To Address', type: 'text', required: true },
            { name: 'itemDescription', label: 'Item Description', type: 'text', required: true },
            { name: 'itemCost', label: 'Cost Value (₹)', type: 'text', required: true },
            { name: 'chargedWeight', label: 'Weight (kg)', type: 'text', required: true },
            { name: 'trackingId', label: 'Tracking Number', type: 'text', required: true }
          ],
          createdBy: userId || '000000000000000000000000'
        });
        await defaultTmpl.save();
        templates = [defaultTmpl];
      } else {
        const correctDimensions = { width: 210, height: 297, unit: 'mm' };
        const correctStyle = { fontSize: 12, fontFamily: 'Arial, Helvetica, sans-serif', alignment: 'left', backgroundColor: '#ffffff', textColor: '#0f172a', borderWidth: 2, borderColor: '#0f172a' };
        for (let t of templates) {
          // Always force-update if template doesn't match the latest A4 design or contains legacy address field
          const hasLatestTemplate = t.template && t.template.includes('ak-label-header-v2') && t.template.includes('SHIPMENT DETAILS');
          const hasCorrectDimensions = t.dimensions?.width === 210 && t.dimensions?.height === 297;
          const hasCorrectStyle = t.style?.fontSize === 12;
          const hasAddressInTemplate = t.template && t.template.includes('Address:');
          if (!hasLatestTemplate || !hasCorrectDimensions || !hasCorrectStyle || hasAddressInTemplate) {
            t.template = AK_LOGISTICS_A4_TEMPLATE_HTML;
            t.dimensions = correctDimensions;
            t.style = correctStyle;
            await LabelTemplate.updateOne({ _id: t._id }, { $set: { 
              template: AK_LOGISTICS_A4_TEMPLATE_HTML, 
              dimensions: correctDimensions, 
              style: correctStyle 
            } });
            console.log(`🏷️ Force-updated template ${t._id} to latest AK Logistics A4 design`);
          }
        }
      }
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

      // Always merge dynamic Contact Us details from Home Page
      const contactInfo = contactService.getHomePageContactInfo();
      const mergedData = {
        supportPhone: contactInfo.phone,
        supportEmail: contactInfo.email,
        supportAddress: contactInfo.address,
        ...data
      };

      // Prepare variables with defaults and formatting
      const variables = {};
      template.variables.forEach(variable => {
        let value = mergedData[variable.name] || variable.defaultValue || '';
        
        // Apply formatting based on variable type
        variables[variable.name] = this.formatVariable(value, variable.type);
      });

      // Process template variables
      let processedTemplate = template.template;
      Object.keys(mergedData).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        const val = (mergedData[key] !== undefined && mergedData[key] !== null) ? String(mergedData[key]) : (variables[key] || '');
        processedTemplate = processedTemplate.replace(regex, val);
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
      
      const contactInfo = contactService.getHomePageContactInfo();

      const previewData = {
        fromAddress: 'AK Logistics Hub\n100 Port Road\nHyderabad, Telangana - 500001\nPh: +91 9876543210',
        toAddress: 'Anil Kumar\nFlat 402, Sunrise Towers\nMG Road, Bangalore, Karnataka - 560001\nPh: +91 9123456789',
        fromName: 'AK Logistics Hub',
        fromMobile: '+91 9876543210',
        fromCity: 'Hyderabad',
        fromPincode: '500001',
        fromState: 'Telangana',
        toName: 'Anil Kumar',
        toMobile: '+91 9123456789',
        toAddress: 'Flat 402, Sunrise Towers',
        toCity: 'Bangalore',
        toPincode: '560001',
        toState: 'Karnataka',
        itemDescription: 'High-Precision Robotics Controller (Model ARC-50)',
        itemCost: '₹ 1,500.00',
        itemValue: '₹ 1,500.00',
        cost: '₹ 1,500.00',
        declaredValue: '₹ 1,500.00',
        chargedWeight: '1.50 kg',
        itemWeight: '1.50 kg',
        totalWeight: '1.50 kg',
        trackingId: 'AKL-987-654-321-GL',
        originalTrackingId: 'AWB-10928374',
        provider: 'DTDC Express',
        courier: 'DTDC Express',
        supportPhone: contactInfo.phone,
        supportEmail: contactInfo.email,
        supportAddress: contactInfo.address,
        currentDate: new Date().toLocaleDateString('en-IN')
      };

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
      const query = userId ? { generatedBy: userId } : {};
      const labels = await GeneratedLabel.find(query)
        .populate('templateId', 'name')
        .sort({ generatedAt: -1 })
        .limit(limit)
        .skip(offset);
      
      const total = await GeneratedLabel.countDocuments(query);
      
      return { labels, total };
    } catch (error) {
      throw new Error(`Failed to fetch generated labels: ${error.message}`);
    }
  }

  async getGeneratedLabelById(labelId, userId) {
    try {
      const query = userId ? { _id: labelId, generatedBy: userId } : { _id: labelId };
      const label = await GeneratedLabel.findOne(query).populate('templateId');
      
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
      const query = userId ? { _id: labelId, generatedBy: userId } : { _id: labelId };
      const label = await GeneratedLabel.findOneAndUpdate(
        query,
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
      const query = userId ? { _id: labelId, generatedBy: userId } : { _id: labelId };
      const label = await GeneratedLabel.findOneAndDelete(query);
      
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
