const fs = require('fs');
const path = require('path');

function getHomePageContactInfo() {
  const defaultContact = {
    phone: '+91 9182228692',
    whatsapp: '+91 9182228692',
    email: 'Aklogisticsravulapalem@gmail.com',
    address: 'Near BIG C, Beside Madhuri Readymades, Ring Road, Ravulapalem-533238',
    website: 'www.aklogistics.org'
  };

  try {
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf8');

      // Extract primary phone from tel: link
      const phoneMatch = html.match(/href=["']tel:([^"']+)["']/i);
      if (phoneMatch) {
        defaultContact.phone = phoneMatch[1].trim();
      }

      // Extract whatsapp number
      const waMatch = html.match(/href=["']https:\/\/wa\.me\/([^"']+)["']/i);
      if (waMatch) {
        defaultContact.whatsapp = '+' + waMatch[1].trim();
      }

      // Extract mailto email if present
      const emailMatch = html.match(/href=["']mailto:([^"']+)["']/i);
      if (emailMatch) {
        defaultContact.email = emailMatch[1].trim();
      }

      // Extract address block if present
      const addrMatch = html.match(/Near BIG C[^<]*/i) || html.match(/Beside Madhuri Readymades[^<]*/i);
      if (addrMatch) {
        defaultContact.address = addrMatch[0].replace(/<br\s*\/?>/gi, ', ').replace(/\s+/g, ' ').trim();
      }
    }
  } catch (err) {
    console.warn('⚠️ Failed to parse contact info from index.html:', err.message);
  }

  return defaultContact;
}

module.exports = {
  getHomePageContactInfo
};
