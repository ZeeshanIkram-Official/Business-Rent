const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  fatherName:  { type: String, trim: true },
  phone:       { type: String, required: true, trim: true },
  whatsapp:    { type: String, trim: true },
  email:       { type: String, trim: true, lowercase: true },
  cnic:        { type: String, required: true, trim: true },
  address:     { type: String, trim: true },
  city:        { type: String, trim: true },

  licenseNumber: { type: String, required: true, trim: true },
  licenseType:   { type: String, enum: ['LTV', 'HTV', 'MC', 'PSV', 'other'], default: 'LTV' },
  licenseExpiry: { type: Date },

  driverImage:    { type: String, default: null },
  dateOfBirth:    { type: Date },
  gender:         { type: String, enum: ['male', 'female', 'other'], default: 'male' },
  maritalStatus:  { type: String, enum: ['single', 'married', 'divorced', 'widowed'] },

  emergencyContactName:  { type: String, trim: true },
  emergencyContactPhone: { type: String, trim: true },
  emergencyRelation:     { type: String, trim: true },

  experienceYears: { type: Number, default: 0 },
  salary:          { type: Number, default: 0 },
  salaryType:      { type: String, enum: ['fixed', 'per-trip', 'per-day'], default: 'fixed' },

  isActive:    { type: Boolean, default: true },
  joiningDate: { type: Date, default: Date.now },
  notes:       { type: String }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Driver', driverSchema);
