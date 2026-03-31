const Tenant = require('../models/Tenant');
const AppError = require('../utils/AppError');

exports.createTenant = async (data) => {
  const existingTenant = await Tenant.findOne({ name: data.name }).lean();
  if (existingTenant) {
    throw new AppError(`A tenant with name ${data.name} already exists.`, 400);
  }
  return await Tenant.create(data);
};

exports.getTenants = async () => {
  return await Tenant.find().lean();
};
