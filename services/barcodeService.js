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

    // Process template content to replace barcode/QR placeholders with actual images
    async processTemplateContent(template, variables) {
        try {
            let processedContent = template;

            // Find all barcode placeholders
            const barcodeRegex = /\[BARCODE:([^\]]+)\]/g;
            const barcodeMatches = template.match(barcodeRegex) || [];
            
            for (const match of barcodeMatches) {
                const data = match.replace('[BARCODE:', '').replace(']', '');
                const variableValue = variables[data] || data;
                
                try {
                    const barcodeHTML = await this.generateBarcodeHTML(variableValue);
                    processedContent = processedContent.replace(match, barcodeHTML);
                } catch (error) {
                    console.error(`Failed to generate barcode for ${data}:`, error);
                    // Keep original placeholder if generation fails
                }
            }

            // Find all QR code placeholders
            const qrRegex = /\[QRCODE:([^\]]+)\]/g;
            const qrMatches = template.match(qrRegex) || [];
            
            for (const match of qrMatches) {
                const data = match.replace('[QRCODE:', '').replace(']', '');
                const variableValue = variables[data] || data;
                
                try {
                    const qrHTML = await this.generateQRCodeHTML(variableValue);
                    processedContent = processedContent.replace(match, qrHTML);
                } catch (error) {
                    console.error(`Failed to generate QR code for ${data}:`, error);
                    // Keep original placeholder if generation fails
                }
            }

            return processedContent;
        } catch (error) {
            console.error('Template processing error:', error);
            throw new Error(`Failed to process template: ${error.message}`);
        }
    }
}

module.exports = new BarcodeService();
