const Address = require('../models/Address');

class AddressService {
  async saveOrUpdateAddress(addressData, userId) {
    try {
      const { name, mobile, address, city, pincode, state, type } = addressData;
      if (!name || !city || !pincode || !state || !userId) return null;

      const trimmedName = name.trim();
      const trimmedMobile = (mobile || '').trim();

      // Find existing by name + createdBy (and mobile if provided)
      const query = {
        createdBy: userId,
        name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      };
      if (trimmedMobile) {
        query.mobile = trimmedMobile;
      }

      let existing = await Address.findOne(query);

      if (existing) {
        existing.usageCount += 1;
        existing.lastUsedAt = new Date();
        if (address && address.trim()) existing.address = address.trim();
        existing.city = city.trim();
        existing.pincode = pincode.trim();
        existing.state = state.trim();
        if (type && existing.type !== type && existing.type !== 'both') {
          existing.type = 'both';
        }
        return await existing.save();
      }

      const newAddress = new Address({
        name: trimmedName,
        mobile: trimmedMobile,
        address: (address || '').trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        state: state.trim(),
        type: type || 'sender',
        usageCount: 1,
        lastUsedAt: new Date(),
        createdBy: userId
      });

      return await newAddress.save();
    } catch (err) {
      console.error('❌ Error saving address:', err.message);
      return null;
    }
  }

  async searchAddresses(queryStr, userId, type = 'sender') {
    try {
      const filter = { createdBy: userId };
      
      if (type && type !== 'all') {
        filter.type = { $in: [type, 'both'] };
      }

      if (queryStr && queryStr.trim()) {
        const escaped = queryStr.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        filter.$or = [
          { name: regex },
          { mobile: regex },
          { city: regex },
          { pincode: regex },
          { address: regex }
        ];
      }

      return await Address.find(filter)
        .sort({ usageCount: -1, lastUsedAt: -1 })
        .limit(10);
    } catch (err) {
      console.error('❌ Error searching addresses:', err.message);
      return [];
    }
  }

  async getTopAddresses(userId, type = 'sender', limit = 5) {
    try {
      const filter = { createdBy: userId };
      if (type && type !== 'all') {
        filter.type = { $in: [type, 'both'] };
      }
      return await Address.find(filter)
        .sort({ usageCount: -1, lastUsedAt: -1 })
        .limit(limit);
    } catch (err) {
      console.error('❌ Error fetching top addresses:', err.message);
      return [];
    }
  }
}

module.exports = new AddressService();
