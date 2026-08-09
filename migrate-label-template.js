/**
 * One-time migration script to force-update all LabelTemplate documents
 * in MongoDB with the official AK Logistics A4 Shipping Label design.
 *
 * Run: node migrate-label-template.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('./config');
const LabelTemplate = require('./models/LabelTemplate');

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
            Support Tel: <strong>{{supportPhone}}</strong> | Email: <strong>{{supportEmail}}</strong><br>
            <span style="font-size: 10px; color: #64748b;">Address: {{supportAddress}}</span>
        </div>
    </div>
</div>`;

const correctDimensions = { width: 210, height: 297, unit: 'mm' };
const correctStyle = {
  fontSize: 12,
  fontFamily: 'Arial, Helvetica, sans-serif',
  alignment: 'left',
  backgroundColor: '#ffffff',
  textColor: '#0f172a',
  borderWidth: 2,
  borderColor: '#0f172a'
};
const correctVariables = [
  { name: 'fromAddress', label: 'From Address', type: 'text', required: true },
  { name: 'toAddress', label: 'To Address', type: 'text', required: true },
  { name: 'itemDescription', label: 'Item Description', type: 'text', required: true },
  { name: 'itemCost', label: 'Cost Value (₹)', type: 'text', required: true },
  { name: 'chargedWeight', label: 'Weight (kg)', type: 'text', required: true },
  { name: 'trackingId', label: 'Tracking Number', type: 'text', required: true }
];

async function migrate() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(config.mongo.uri, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000
    });
    console.log('✅ Connected to MongoDB');

    // Find all label templates
    const templates = await LabelTemplate.find({});
    console.log(`📋 Found ${templates.length} label template(s) in database`);

    if (templates.length === 0) {
      console.log('⚠️  No templates found. Creating default AK Logistics A4 template...');
      const newTemplate = new LabelTemplate({
        name: 'AK Logistics Official A4 Label',
        description: 'Official AK Logistics A4 Shipping Label with System Tracking Barcode and Website QR Code',
        template: AK_LOGISTICS_A4_TEMPLATE_HTML,
        dimensions: correctDimensions,
        style: correctStyle,
        variables: correctVariables,
        createdBy: new mongoose.Types.ObjectId('000000000000000000000000')
      });
      await newTemplate.save();
      console.log(`✅ Created new template: ${newTemplate._id}`);
    } else {
      for (const t of templates) {
        console.log(`\n🏷️  Updating template: "${t.name}" (ID: ${t._id})`);
        console.log(`   Old dimensions: ${t.dimensions?.width}×${t.dimensions?.height}${t.dimensions?.unit}`);
        console.log(`   Old fontSize: ${t.style?.fontSize}`);

        const result = await LabelTemplate.updateOne(
          { _id: t._id },
          {
            $set: {
              name: 'AK Logistics Official A4 Label',
              description: 'Official AK Logistics A4 Shipping Label with System Tracking Barcode and Website QR Code',
              template: AK_LOGISTICS_A4_TEMPLATE_HTML,
              dimensions: correctDimensions,
              style: correctStyle,
              variables: correctVariables
            }
          }
        );

        console.log(`   ✅ Updated! (matched: ${result.matchedCount}, modified: ${result.modifiedCount})`);
        console.log(`   New dimensions: 210×297mm`);
        console.log(`   New fontSize: 12`);
      }
    }

    // Verify
    const updated = await LabelTemplate.find({});
    console.log(`\n🔍 Verification — ${updated.length} template(s) in database:`);
    for (const t of updated) {
      console.log(`   ✅ "${t.name}" — ${t.dimensions.width}×${t.dimensions.height}${t.dimensions.unit} — fontSize: ${t.style.fontSize} — has 'Delivering the Future': ${t.template.includes('Delivering the Future, Today')}`);
    }

    console.log('\n🎉 Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

migrate();
