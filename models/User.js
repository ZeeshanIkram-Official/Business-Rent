const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'booking_agent'], default: 'booking_agent' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('User', userSchema);