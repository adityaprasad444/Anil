const bwipjs = require('bwip-js');
const QRCode = require('qrcode');

class BarcodeService {
    async generateBarcode(data, options = {}) {
        try {
            const defaultOptions = {
                bcid: 'code128',       // Barcode type
                text: data,            // Text to encode
                scale: 3,              // 3x scaling
                height: 10,            // Bar height, in mm
                includetext: true,     // Show human-readable text
                textxalign: 'center',  // Always good
                textsize: 8            // Font size
            };

            const barcodeOptions = { ...defaultOptions, ...options };
            
            // Generate barcode as PNG buffer
            const png = await bwipjs.toBuffer(barcodeOptions);
            return png.toString('base64');
        } catch (error) {
            console.error('Barcode generation error:', error);
            throw new Error(`Failed to generate barcode: ${error.message}`);
        }
    }

    async generateQRCode(data, options = {}) {
        try {
            const defaultOptions = {
                type: 'png',
                width: 200,
                margin: 1,
                color: {
                    dark: '#000000',  // Black dots
                    light: '#FFFFFF'  // White background
                }
            };

            const qrOptions = { ...defaultOptions, ...options };
            
            // Generate QR code as base64
            const qrDataUrl = await QRCode.toDataURL(data, qrOptions);
            return qrDataUrl.replace('data:image/png;base64,', '');
        } catch (error) {
            console.error('QR Code generation error:', error);
            throw new Error(`Failed to generate QR code: ${error.message}`);
        }
    }

    async generateBarcodeHTML(data, options = {}) {
        try {
            const base64 = await this.generateBarcode(data, options);
            return `<img src="data:image/png;base64,${base64}" alt="Barcode: ${data}" style="max-width: 100%; height: auto;">`;
        } catch (error) {
            // Fallback to text representation
            return `<div style="font-family: monospace; font-size: 12px; border: 1px solid #ccc; padding: 5px; text-align: center;">[BARCODE: ${data}]</div>`;
        }
    }

    async generateQRCodeHTML(data, options = {}) {
        try {
            const base64 = await this.generateQRCode(data, options);
            return `<img src="data:image/png;base64,${base64}" alt="QR Code: ${data}" style="max-width: 100%; height: auto;">`;
        } catch (error) {
            // Fallback to text representation
            return `<div style="font-family: monospace; font-size: 12px; border: 1px solid #ccc; padding: 5px; text-align: center;">[QRCODE: ${data}]</div>`;
        }
    }

    // Process template content - generates Barcode for tracking ID & QR Code for website URL
    async processTemplateContent(template, variables) {
        try {
            let processedContent = template;
            const trackingId = variables.trackingId || variables.originalTrackingId || 'AK102938LG';
            const websiteUrl = variables.websiteUrl || variables.website || 'https://aklogistics.org';

            // 1. Process Barcode placeholders for system tracking number
            const barcodeRegex = /\[BARCODE:([^\]]+)\]/g;
            const barcodeMatches = template.match(barcodeRegex) || [];
            for (const match of barcodeMatches) {
                const param = match.replace('[BARCODE:', '').replace(']', '');
                const val = variables[param] || trackingId;
                try {
                    const barcodeHTML = await this.generateBarcodeHTML(val);
                    processedContent = processedContent.replace(match, barcodeHTML);
                } catch (err) {
                    processedContent = processedContent.replace(match, `<div style="font-family: monospace; font-size: 15px; font-weight: bold; border: 1px solid #000; padding: 4px 8px; text-align: center; background: #fff;">|||||| |||| ||| ${val}</div>`);
                }
            }

            // 2. Process QR Code placeholders for website URL
            const qrRegex = /\[QRCODE:([^\]]+)\]/g;
            const qrMatches = template.match(qrRegex) || [];
            for (const match of qrMatches) {
                const param = match.replace('[QRCODE:', '').replace(']', '');
                const val = (param.startsWith('http') ? param : (variables[param] || websiteUrl));
                try {
                    const qrHTML = await this.generateQRCodeHTML(val);
                    processedContent = processedContent.replace(match, qrHTML);
                } catch (err) {
                    processedContent = processedContent.replace(match, `<div style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold; font-size: 10px; background: #fff;">[QR: ${val}]</div>`);
                }
            }

            return processedContent;
        } catch (error) {
            console.error('Template processing error:', error);
            return template;
        }
    }
}

module.exports = new BarcodeService();
