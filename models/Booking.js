const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
  amount:        { type: Number, required: true },
  method:        { type: String, enum: ['cash', 'bank', 'easypaisa', 'jazzcash', 'other'], default: 'cash' },
  receivedBy:    { type: String },
  note:          { type: String },
  receivedAt:    { type: Date, default: Date.now }
}, { _id: true });

const bookingSchema = new mongoose.Schema({
  bookingId:       { type: String, unique: true, index: true },

  customerName:    { type: String, required: true, trim: true },
  customerPhone:   { type: String, required: true, trim: true },
  customerCnic:    { type: String, trim: true },
  customerAddress: { type: String, trim: true },

  route:   { type: mongoose.Schema.Types.ObjectId, ref: 'Route', default: null },
  car:     { type: mongoose.Schema.Types.ObjectId, ref: 'Car', default: null },
  driver:  { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },

  bookingType:  { type: String, enum: ['full', 'sharing'], default: 'full' },  // ← NEW

  travelDate:   { type: Date, required: true },
  passengers:   { type: Number, default: 1 },

  pickupLocation:  { type: String, trim: true },
  dropoffLocation: { type: String, trim: true },

  tripFare:        { type: Number, default: 0 },
  extraCharges:    { type: Number, default: 0 },
  discount:        { type: Number, default: 0 },
  totalAmount:     { type: Number, default: 0 },
  advancePaid:     { type: Number, default: 0 },
  remainingAmount: { type: Number, default: 0 },

  paymentStatus:   { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
  paymentMethod:   { type: String, enum: ['cash', 'bank', 'easypaisa', 'jazzcash', 'other'], default: 'cash' },

  paymentHistory: [paymentHistorySchema],

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'ongoing', 'completed', 'cancelled'],
    default: 'pending'
  },
  cancelReason: { type: String },

  notes:     { type: String, trim: true },
  isActive:  { type: Boolean, default: true },
  createdBy: { type: String }

}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Booking', bookingSchema);