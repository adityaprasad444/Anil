const Permission = require('../models/Permission');
const AppError = require('../utils/AppError');

exports.createPermission = async (data) => {
  const existingPermission = await Permission.findOne({ code: data.code }).lean();
  if (existingPermission) {
    throw new AppError(`A permission with code ${data.code} already exists.`, 400);
  }
  return await Permission.create(data);
};

exports.getAllPermissions = async () => {
  return await Permission.find().lean();
};
