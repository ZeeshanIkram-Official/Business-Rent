const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const Car     = require('../models/Car');
const Booking = require('../models/Booking');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/car-images');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only images allowed'));
}});

// List all cars
router.get('/', isAuthenticated, async (req, res) => {
  const { search, status, bookingType } = req.query;
  let filter = { isActive: true };
  if (search) filter.$or = [
    { name: new RegExp(search, 'i') },
    { numberPlate: new RegExp(search, 'i') },
    { model: new RegExp(search, 'i') }
  ];
  if (status)      filter.status      = status;
  if (bookingType) filter.bookingType = bookingType;
  const cars = await Car.find(filter).sort({ createdAt: -1 });
  const stats = {
    total:       await Car.countDocuments({ isActive: true }),
    available:   await Car.countDocuments({ isActive: true, status: 'available' }),
    booked:      await Car.countDocuments({ isActive: true, status: 'booked' }),
    maintenance: await Car.countDocuments({ isActive: true, status: 'maintenance' })
  };
  res.render('Cars/index', {
    title: 'Car Fleet', cars, stats,
    search: search || '', status: status || '', bookingType: bookingType || ''
  });
});

// Add form
router.get('/add', isAuthenticated, isAdmin, (req, res) => {
  res.render('Cars/add', { title: 'Add Car' });
});

// Add POST
router.post('/', isAuthenticated, isAdmin, upload.single('carImage'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.carImage = '/uploads/car-images/' + req.file.filename;
    await Car.create(data);
    req.flash('success', 'Car added successfully');
    res.redirect('/cars');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/cars/add');
  }
});

// Detail
router.get('/:id', isAuthenticated, async (req, res) => {
  const car = await Car.findById(req.params.id);
  if (!car) { req.flash('error', 'Car not found'); return res.redirect('/cars'); }
  const bookings = await Booking.find({ car: car._id, isActive: true })
    .populate('driver').sort({ startDate: -1 }).limit(10);
  const totalRevenue = await Booking.aggregate([
    { $match: { car: car._id, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);
  res.render('Cars/detail', { title: car.name, car, bookings, totalRevenue: totalRevenue[0]?.total || 0 });
});

// Edit form
router.get('/:id/edit', isAuthenticated, isAdmin, async (req, res) => {
  const car = await Car.findById(req.params.id);
  if (!car) { req.flash('error', 'Car not found'); return res.redirect('/cars'); }
  res.render('Cars/edit', { title: 'Edit Car', car });
});

// Edit PUT
router.put('/:id', isAuthenticated, isAdmin, upload.single('carImage'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.carImage = '/uploads/car-images/' + req.file.filename;
    await Car.findByIdAndUpdate(req.params.id, data);
    req.flash('success', 'Car updated successfully');
    res.redirect('/cars');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect(`/cars/${req.params.id}/edit`);
  }
});

// Delete
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) { req.flash('error', 'Car not found'); return res.redirect('/cars'); }
    if (car.carImage) {
      const imgPath = path.join(__dirname, '../public', car.carImage);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    await Car.findByIdAndDelete(req.params.id);
    req.flash('success', 'Car deleted successfully');
    res.redirect('/cars');
  } catch (err) {
    req.flash('error', 'Error deleting car');
    res.redirect('/cars');
  }
});

module.exports = router;