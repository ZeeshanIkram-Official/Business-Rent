const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const Driver  = require('../models/Driver');
const Booking = require('../models/Booking');
const moment  = require('moment');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/drivers');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// List
router.get('/', isAuthenticated, async (req, res) => {
  const { search, status } = req.query;
  let filter = {};
  if (status === 'active') filter.isActive = true;
  else if (status === 'inactive') filter.isActive = false;
  if (search) filter.$or = [
    { name: new RegExp(search, 'i') },
    { phone: new RegExp(search, 'i') },
    { cnic: new RegExp(search, 'i') },
    { licenseNumber: new RegExp(search, 'i') }
  ];
  const drivers = await Driver.find(filter).sort({ createdAt: -1 });
  const stats = {
    total:    await Driver.countDocuments(),
    active:   await Driver.countDocuments({ isActive: true }),
    inactive: await Driver.countDocuments({ isActive: false }),
    expiring: await Driver.countDocuments({
      isActive: true,
      licenseExpiry: { $lte: moment().add(30, 'days').toDate(), $gte: new Date() }
    })
  };
  res.render('Drivers/index', { title: 'Driver Management', drivers, stats, search: search || '', status: status || '', moment });
});

// Add form
router.get('/add', isAuthenticated, isAdmin, (req, res) => {
  res.render('Drivers/add', { title: 'Add Driver' });
});

// Add POST
router.post('/', isAuthenticated, isAdmin, upload.single('driverImage'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.driverImage = '/uploads/drivers/' + req.file.filename;
    await Driver.create(data);
    req.flash('success', 'Driver added successfully');
    res.redirect('/drivers');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/drivers/add');
  }
});

// Detail
router.get('/:id', isAuthenticated, async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) { req.flash('error', 'Driver not found'); return res.redirect('/drivers'); }
  const bookings = await Booking.find({ driver: driver._id, isActive: true })
    .populate('car').sort({ startDate: -1 }).limit(10);
  const totalTrips = await Booking.countDocuments({ driver: driver._id, status: 'completed' });
  res.render('Drivers/detail', { title: driver.name, driver, bookings, totalTrips, moment });
});

// Edit form
router.get('/:id/edit', isAuthenticated, isAdmin, async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) { req.flash('error', 'Driver not found'); return res.redirect('/drivers'); }
  res.render('Drivers/edit', { title: 'Edit Driver', driver, moment });
});

// Edit PUT
router.put('/:id', isAuthenticated, isAdmin, upload.single('driverImage'), async (req, res) => {
  try {
    const data = { ...req.body };
    data.isActive = data.isActive === 'on';
    if (req.file) data.driverImage = '/uploads/drivers/' + req.file.filename;
    await Driver.findByIdAndUpdate(req.params.id, data);
    req.flash('success', 'Driver updated');
    res.redirect('/drivers');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect(`/drivers/${req.params.id}/edit`);
  }
});

// ✅ Baad mein (permanent delete)
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) { req.flash('error', 'Driver not found'); return res.redirect('/drivers'); }

    // Image bhi disk se delete karo
    if (driver.driverImage) {
      const imgPath = path.join(__dirname, '../public', driver.driverImage);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await Driver.findByIdAndDelete(req.params.id);
    req.flash('success', 'Driver deleted successfully');
    res.redirect('/drivers');
  } catch (err) {
    req.flash('error', 'Error deleting driver');
    res.redirect('/drivers');
  }
});

module.exports = router;
