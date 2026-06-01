const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  routeId:     { type: String, unique: true, index: true },
  company:     { type: String, required: true, trim: true },
  name:        { type: String, required: true, trim: true },
  origin:      { type: String, required: true, trim: true },
  destination: { type: String, required: true, trim: true },
  price:       { type: Number, default: 0 },
  notes:       { type: String, trim: true },
  isActive:    { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

routeSchema.index(
  { company: 1, origin: 1, destination: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

module.exports = mongoose.model('Route', routeSchema);
