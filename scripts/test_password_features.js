const axios = require('axios');
const mongoose = require('mongoose');
const { connectDB } = require('../db');
const User = require('../models/User');

const BASE_URL = 'http://localhost:3001';

async function runTests() {
  console.log('🧪 Starting Automated Password Features Verification Tests...\n');

  await connectDB();

  // Ensure test admin user exists in DB
  let user = await User.findOne({ username: 'admin' });
  if (!user) {
    console.log('Creating initial test admin user...');
    user = new User({ username: 'admin', password: 'admin123', role: 'admin', email: 'admin@example.com' });
    await user.save();
  } else {
    // Reset password to admin123 for test reproducibility
    user.password = 'admin123';
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
  }

  // Create axios instance with cookie jar support
  const client = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
    validateStatus: () => true
  });

  let cookieHeader = '';

  // Step 1: Login with initial credentials
  console.log('1️⃣ Testing Login with admin/admin123...');
  const loginRes = await client.post('/api/login', { username: 'admin', password: 'admin123' });
  if (loginRes.status === 200) {
    console.log('   ✅ Login successful');
    if (loginRes.headers['set-cookie']) {
      cookieHeader = loginRes.headers['set-cookie'].join('; ');
    }
  } else {
    throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
  }

  const authHeaders = { headers: { Cookie: cookieHeader } };

  // Step 2: Test Change Password - Same old and new password error check
  console.log('\n2️⃣ Testing Change Password: Same old & new password check...');
  const samePassRes = await client.post('/api/change-password', {
    currentPassword: 'admin123',
    newPassword: 'admin123',
    confirmPassword: 'admin123'
  }, authHeaders);

  if (samePassRes.status === 400 && samePassRes.data.error.includes('cannot be the same')) {
    console.log('   ✅ Properly rejected same old & new password:', samePassRes.data.error);
  } else {
    throw new Error(`Failed same password validation test. Got status ${samePassRes.status}: ${JSON.stringify(samePassRes.data)}`);
  }

  // Step 3: Test Change Password - Wrong current password check
  console.log('\n3️⃣ Testing Change Password: Incorrect current password check...');
  const wrongCurrRes = await client.post('/api/change-password', {
    currentPassword: 'wrongPassword',
    newPassword: 'newPassword123',
    confirmPassword: 'newPassword123'
  }, authHeaders);

  if (wrongCurrRes.status === 400 && wrongCurrRes.data.error.includes('incorrect')) {
    console.log('   ✅ Properly rejected wrong current password:', wrongCurrRes.data.error);
  } else {
    throw new Error(`Failed wrong current password test. Got status ${wrongCurrRes.status}: ${JSON.stringify(wrongCurrRes.data)}`);
  }

  // Step 4: Test Change Password - Valid password change
  console.log('\n4️⃣ Testing Change Password: Valid password update (to admin321)...');
  const changeRes = await client.post('/api/change-password', {
    currentPassword: 'admin123',
    newPassword: 'admin321',
    confirmPassword: 'admin321'
  }, authHeaders);

  if (changeRes.status === 200 && changeRes.data.success) {
    console.log('   ✅ Password updated successfully');
  } else {
    throw new Error(`Failed password update. Got status ${changeRes.status}: ${JSON.stringify(changeRes.data)}`);
  }

  // Step 5: Verify login with new password (admin321)
  console.log('\n5️⃣ Testing Login with updated password (admin321)...');
  const newLoginRes = await client.post('/api/login', { username: 'admin', password: 'admin321' });
  if (newLoginRes.status === 200) {
    console.log('   ✅ Login with updated password successful');
  } else {
    throw new Error(`Failed login with new password. Got status ${newLoginRes.status}`);
  }

  // Step 6: Test Forgot Password request (24-hour token)
  console.log('\n6️⃣ Testing Forgot Password token generation...');
  const forgotRes = await client.post('/api/forgot-password', { usernameOrEmail: 'admin' });
  if (forgotRes.status === 200 && forgotRes.data.success) {
    console.log('   ✅ Forgot password API responded successfully:', forgotRes.data.message);
  } else {
    throw new Error(`Forgot password API failed with status ${forgotRes.status}`);
  }

  // Retrieve token from database
  const updatedUser = await User.findOne({ username: 'admin' });
  if (!updatedUser.resetPasswordToken || !updatedUser.resetPasswordExpires) {
    throw new Error('Reset token or expiry date was not saved to User record in MongoDB');
  }
  const token = updatedUser.resetPasswordToken;
  console.log('   ✅ Generated 24-hour reset token in DB:', token.substring(0, 10) + '...');
  console.log('   ✅ Expiry date set to:', updatedUser.resetPasswordExpires.toISOString());

  // Step 7: Test Reset Password with token
  console.log('\n7️⃣ Testing Reset Password with 24-hour token (resetting back to admin123)...');
  const resetRes = await client.post('/api/reset-password', {
    token: token,
    newPassword: 'admin123',
    confirmPassword: 'admin123'
  });

  if (resetRes.status === 200 && resetRes.data.success) {
    console.log('   ✅ Password reset via token successful!');
  } else {
    throw new Error(`Reset password API failed with status ${resetRes.status}: ${JSON.stringify(resetRes.data)}`);
  }

  // Step 8: Verify token is invalidated after use
  console.log('\n8️⃣ Verifying token reuse prevention (should fail second use)...');
  const reuseRes = await client.post('/api/reset-password', {
    token: token,
    newPassword: 'anotherPassword',
    confirmPassword: 'anotherPassword'
  });

  if (reuseRes.status === 400) {
    console.log('   ✅ Token single-use check passed. Properly rejected reused token.');
  } else {
    throw new Error(`Token reuse check failed. Expected 400 but got ${reuseRes.status}`);
  }

  // Step 9: Verify final login with admin123
  console.log('\n9️⃣ Verifying final login with reset password (admin123)...');
  const finalLoginRes = await client.post('/api/login', { username: 'admin', password: 'admin123' });
  if (finalLoginRes.status === 200) {
    console.log('   ✅ Final login successful!');
  } else {
    throw new Error(`Final login failed with status ${finalLoginRes.status}`);
  }

  console.log('\n🎉 ALL PASSWORD FEATURE VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err.message || err);
  process.exit(1);
});
