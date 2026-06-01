const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const Driver = require('../models/Driver');
const Route = require('../models/Route');
const moment = require('moment');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

async function generateBookingId() {
  const count = await Booking.countDocuments();
  return 'BK-' + String(count + 1).padStart(4, '0');
}

// List
router.get('/', isAuthenticated, async (req, res) => {
  const { search, status, payment, dateFrom, dateTo } = req.query;
  let filter = {};

  if (search) {
    filter.$or = [
      { customerName: new RegExp(search, 'i') },
      { customerPhone: new RegExp(search, 'i') },
      { bookingId: new RegExp(search, 'i') }
    ];
  }
  if (status) filter.status = status;
  if (payment) filter.paymentStatus = payment;

  if (dateFrom || dateTo) {
    filter.travelDate = {};
    if (dateFrom) filter.travelDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.travelDate.$lte = end;
    } else if (dateFrom) {
      // dateTo nahi diya to sirf usi din ki bookings
      const end = new Date(dateFrom);
      end.setHours(23, 59, 59, 999);
      filter.travelDate.$lte = end;
    }
  }

  const bookings = await Booking.find(filter)
    .populate('car', 'name numberPlate')
    .populate('driver', 'name')
    .populate('route', 'name origin destination')
    .sort({ createdAt: -1 });

  const all = await Booking.find({});
  const stats = {
    total: all.length,
    pending: all.filter(b => b.status === 'pending').length,
    ongoing: all.filter(b => b.status === 'ongoing').length,
    completed: all.filter(b => b.status === 'completed').length,
    unpaid: all.filter(b => b.paymentStatus === 'unpaid').length,
  };

  res.render('bookings/index', {
    title: 'Bookings', bookings, stats, moment,
    filters: { search: search || '', status: status || '', payment: payment || '', dateFrom: dateFrom || '', dateTo: dateTo || '' }
  });
});

// Add form
router.get('/add', isAuthenticated, async (req, res) => {
  const cars = await Car.find({ isActive: true }).sort({ name: 1 });
  const drivers = await Driver.find({ isActive: true }).sort({ name: 1 });
  const routes = await Route.find({ isActive: true }).sort({ name: 1 });
  res.render('bookings/add', { title: 'New Booking', cars, drivers, routes, moment });
});

// Add POST
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const d = req.body;

    const bookingType = d.bookingType || 'full';
    const passengers = parseInt(d.passengers) || 1;
    const tripFare = parseFloat(d.tripFare) || 0;
    const extraCharges = parseFloat(d.extraCharges) || 0;
    const discount = parseFloat(d.discount) || 0;

    // Sharing mein fare × passengers, Full mein sirf fare
    const fareTotal = bookingType === 'sharing' ? tripFare * passengers : tripFare;
    const totalAmount = Math.max(0, fareTotal + extraCharges - discount);

    const advancePaid = parseFloat(d.advancePaid) || 0;
    const remaining = Math.max(0, totalAmount - advancePaid);

    let paymentStatus = 'unpaid';
    if (advancePaid >= totalAmount && totalAmount > 0) paymentStatus = 'paid';
    else if (advancePaid > 0) paymentStatus = 'partial';

    const bookingId = await generateBookingId();

    const booking = await Booking.create({
      bookingId,
      customerName: d.customerName,
      customerPhone: d.customerPhone,
      customerCnic: d.customerCnic || '',
      customerAddress: d.customerAddress || '',
      route: d.route || null,
      car: d.car || null,
      driver: d.driver || null,
      travelDate: new Date(d.travelDate),
      passengers: bookingType === 'sharing' ? passengers : 1,
      pickupLocation: d.pickupLocation || '',
      dropoffLocation: d.dropoffLocation || '',
      tripFare,
      extraCharges,
      discount,
      totalAmount,
      advancePaid,
      remainingAmount: remaining,
      paymentStatus,
      paymentMethod: d.paymentMethod,
      status: d.status || 'pending',
      notes: d.notes || '',
      createdBy: req.session.userName,
      paymentHistory: advancePaid > 0 ? [{
        amount: advancePaid,
        method: d.paymentMethod,
        receivedBy: req.session.userName,
        note: 'Advance payment at booking'
      }] : []
    });

    if (d.car && ['confirmed', 'ongoing'].includes(booking.status)) {
      await Car.findByIdAndUpdate(d.car, { status: 'booked' });
    }

    req.flash('success', `Booking ${booking.bookingId} created successfully`);
    res.redirect('/bookings/' + booking._id);
  } catch (err) {
    console.error(err);
    req.flash('error', err.message);
    res.redirect('/bookings/add');
  }
});

// Detail
router.get('/:id', isAuthenticated, async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('car driver route');
  if (!booking) { req.flash('error', 'Booking not found'); return res.redirect('/bookings'); }
  res.render('bookings/detail', { title: 'Booking Detail', booking, moment });
});

// Print Invoice
router.get('/:id/print', isAuthenticated, async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('car driver route');
  if (!booking) return res.redirect('/bookings');
  res.render('bookings/invoice', { title: 'Invoice', booking, moment });
});

// Edit form
router.get('/:id/edit', isAuthenticated, async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('car driver route');
  if (!booking) { req.flash('error', 'Booking not found'); return res.redirect('/bookings'); }
  const cars = await Car.find({ isActive: true }).sort({ name: 1 });
  const drivers = await Driver.find({ isActive: true }).sort({ name: 1 });
  const routes = await Route.find({ isActive: true }).sort({ name: 1 });
  res.render('bookings/edit', { title: 'Edit Booking', booking, cars, drivers, routes, moment });
});

// Edit PUT
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const d = req.body;

    const bookingType = d.bookingType || 'full';
    const passengers = parseInt(d.passengers) || 1;
    const tripFare = parseFloat(d.tripFare) || 0;
    const extraCharges = parseFloat(d.extraCharges) || 0;
    const discount = parseFloat(d.discount) || 0;

    // Sharing mein fare × passengers, Full mein sirf fare
    const fareTotal = bookingType === 'sharing' ? tripFare * passengers : tripFare;
    const totalAmount = Math.max(0, fareTotal + extraCharges - discount);

    const advancePaid = parseFloat(d.advancePaid) || 0;
    const remaining = Math.max(0, totalAmount - advancePaid);

    let paymentStatus = 'unpaid';
    if (advancePaid >= totalAmount && totalAmount > 0) paymentStatus = 'paid';
    else if (advancePaid > 0) paymentStatus = 'partial';

    await Booking.findByIdAndUpdate(req.params.id, {
      customerName: d.customerName,
      customerPhone: d.customerPhone,
      customerCnic: d.customerCnic || '',
      customerAddress: d.customerAddress || '',
      route: d.route || null,
      car: d.car || null,
      driver: d.driver || null,
      travelDate: new Date(d.travelDate),
      passengers: bookingType === 'sharing' ? passengers : 1,
      pickupLocation: d.pickupLocation || '',
      dropoffLocation: d.dropoffLocation || '',
      tripFare,
      extraCharges,
      discount,
      totalAmount,
      advancePaid,
      remainingAmount: remaining,
      paymentStatus,
      paymentMethod: d.paymentMethod,
      status: d.status,
      notes: d.notes || ''
    });

    if (d.car && ['confirmed', 'ongoing'].includes(d.status)) {
      await Car.findByIdAndUpdate(d.car, { status: 'booked' });
    } else if (d.car && ['completed', 'cancelled'].includes(d.status)) {
      await Car.findByIdAndUpdate(d.car, { status: 'available' });
    }

    req.flash('success', 'Booking updated');
    res.redirect('/bookings/' + req.params.id);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect(`/bookings/${req.params.id}/edit`);
  }
});

// Add payment
router.post('/:id/payment', isAuthenticated, async (req, res) => {
  try {
    const { amount, method, note } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) { req.flash('error', 'Booking not found'); return res.redirect('/bookings'); }

    const paid = parseFloat(amount) || 0;
    booking.advancePaid += paid;
    booking.remainingAmount = Math.max(0, booking.totalAmount - booking.advancePaid);
    if (booking.advancePaid >= booking.totalAmount) booking.paymentStatus = 'paid';
    else if (booking.advancePaid > 0) booking.paymentStatus = 'partial';

    booking.paymentHistory.push({
      amount: paid, method,
      receivedBy: req.session.userName,
      note: note || '',
      receivedAt: new Date()
    });

    await booking.save();
    req.flash('success', `Payment of SAR ${paid.toLocaleString()} recorded`);
    res.redirect('/bookings/' + req.params.id);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/bookings/' + req.params.id);
  }
});

// Status update
router.post('/:id/status', isAuthenticated, async (req, res) => {
  const { status } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.redirect('/bookings');

  booking.status = status;
  if (status === 'completed') {
    booking.returnedDate = new Date();
    if (booking.car) await Car.findByIdAndUpdate(booking.car, { status: 'available' });
  } else if (status === 'cancelled') {
    booking.cancelReason = req.body.cancelReason;
    if (booking.car) await Car.findByIdAndUpdate(booking.car, { status: 'available' });
  } else if (['confirmed', 'ongoing'].includes(status)) {
    if (booking.car) await Car.findByIdAndUpdate(booking.car, { status: 'booked' });
  }

  await booking.save();
  req.flash('success', 'Status updated to ' + status);
  res.redirect('/bookings/' + booking._id);
});

// Permanent delete
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) { req.flash('error', 'Booking not found'); return res.redirect('/bookings'); }

    if (booking.car) await Car.findByIdAndUpdate(booking.car, { status: 'available' });

    await Booking.findByIdAndDelete(req.params.id);
    req.flash('success', 'Booking deleted successfully');
    res.redirect('/bookings');
  } catch (err) {
    req.flash('error', 'Error deleting booking');
    res.redirect('/bookings');
  }
});

module.exports = router;