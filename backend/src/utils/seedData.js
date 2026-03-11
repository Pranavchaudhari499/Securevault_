require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/securevault');
  await User.deleteMany({});

  const users = [
    { name: 'Demo User', email: 'user@demo.com', password: 'Demo@1234', role: 'user', phone: '9876543210', upiId: 'user@securevault', accountNumber: '1234567890', balance: 50000, riskScore: 0, riskLevel: 'low' },
    { name: 'Gateway Admin', email: 'admin@vault.com', password: 'Admin@1234', role: 'gateway_admin', phone: '9876543211' },
    { name: 'Bank Officer', email: 'officer@bank.com', password: 'Bank@1234', role: 'bank_officer', phone: '9876543212' },
    { name: 'Rahul Sharma', email: 'rahul@demo.com', password: 'Demo@1234', role: 'user', upiId: 'rahul@securevault', accountNumber: '9876543210', balance: 75000, riskScore: 0, riskLevel: 'low' }
  ];

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 12);
    await User.create({ ...u, password: hashed });
  }

  console.log('✅ Seed data inserted successfully');
  console.log('Demo User: user@demo.com / Demo@1234');
  console.log('Gateway Admin: admin@vault.com / Admin@1234');
  console.log('Bank Officer: officer@bank.com / Bank@1234');
  mongoose.disconnect();
}

seed().catch(console.error);
