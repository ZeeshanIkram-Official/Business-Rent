const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  model:       { type: String, required: true, trim: true },
  year:        { type: Number },
  numberPlate: { type: String, required: true, unique: true, trim: true, uppercase: true },
  color:       { type: String, trim: true },
  fuelType:    { type: String, enum: ['petrol', 'diesel', 'cng', 'hybrid', 'electric'], default: 'petrol' },
  transmission:{ type: String, enum: ['manual', 'automatic'], default: 'manual' },
  bookingType: { type: String, enum: ['full', 'sharing'], default: 'full' },
  seats:       { type: Number, default: 5 },
  ratePerDay:  { type: Number, default: 0 },
  carImage:    { type: String, default: null },
  status:      { type: String, enum: ['available', 'booked', 'maintenance'], default: 'available' },
  notes:       { type: String, trim: true },
  isActive:    { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

carSchema.index({ name: 1, model: 1 });

module.exports = mongoose.model('Car', carSchema);