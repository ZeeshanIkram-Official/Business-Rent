const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  expenseId:   { type: String, unique: true, index: true },
  category:    { type: String, enum: ['fuel', 'maintenance', 'salary', 'insurance', 'tax', 'other'], required: true },
  amount:      { type: Number, required: true },
  description: { type: String, trim: true },
  car:         { type: mongoose.Schema.Types.ObjectId, ref: 'Car', default: null },
  driver:      { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
  paidTo:      { type: String, trim: true },
  paymentMethod: { type: String, enum: ['cash', 'bank', 'easypaisa', 'jazzcash', 'other'], default: 'cash' },
  expenseDate: { type: Date, default: Date.now },
  notes:       { type: String, trim: true },
  isActive:    { type: Boolean, default: true },
  createdBy:   { type: String }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Expense', expenseSchema);