require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const config = require('./config');

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongo.uri, config.mongo.options);
    console.log('Connected to MongoDB');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ username: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists, updating password...');
      existingAdmin.password = 'admin123';
      await existingAdmin.save();
      console.log('Admin password updated successfully');
      process.exit(0);
    }

    // Create admin user
    const adminUser = new User({
      username: 'admin',
      password: 'admin123',
      role: 'admin'
    });

    await adminUser.save();
    console.log('Admin user created successfully');
  } catch (error) {
    console.error('Error creating/updating admin user:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdminUser(); 