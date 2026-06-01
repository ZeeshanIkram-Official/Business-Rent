const express = require('express');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');

const app = express();
const PORT = process.env.PORT || 8000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/transport_pro';

// ================= DATABASE =================
// ================= DATABASE =================
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected');

    const User = require('./models/User');
    const adminExists = await User.findOne({ username: 'admin' });

    if (!adminExists) {
      await User.create({
        name: 'Administrator',
        username: 'admin',
        password: 'admin123',
        role: 'admin'
      });
      console.log('✅ Default Admin Created  →  username: admin  |  password: admin123');
    }
  })
  .catch(err => console.log('❌ MongoDB Error:', err.message));

// ================= VIEW ENGINE =================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ================= MIDDLEWARE =================
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// ================= SESSION =================
app.use(session({
  secret: process.env.SESSION_SECRET || 'transport_pro_secret_2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000, httpOnly: true }
}));

// ================= FLASH =================
app.use(flash());

// ================= GLOBAL LOCALS =================
app.use((req, res, next) => {
  res.locals.success    = req.flash('success');
  res.locals.error      = req.flash('error');
  res.locals.warning    = req.flash('warning');
  res.locals.currentUser   = req.session.userName   || null;
  res.locals.currentRole   = req.session.userRole   || null;
  res.locals.currentUserId = req.session.userId     || null;
  next();
});

// ================= ROUTES =================
app.use('/',          require('./routes/auth'));
app.use('/cars',      require('./routes/cars'));
app.use('/drivers',   require('./routes/drivers'));
app.use('/bookings',  require('./routes/bookings'));
app.use('/reports',   require('./routes/reports'));
app.use('/expenses', require('./routes/expenses'));
app.use('/routes',   require('./routes/routes'));
// ================= DASHBOARD =================
const { isAuthenticated } = require('./middleware/auth');
const Booking = require('./models/Booking');
const Car     = require('./models/Car');
const Driver  = require('./models/Driver');
const moment  = require('moment');

app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const today     = moment().startOf('day').toDate();
    const thisMonth = moment().startOf('month').toDate();

    const [
      totalCars, activeCars,
      totalDrivers, activeDrivers,
      totalBookings, activeBookings,
      pendingBookings, completedBookings,
      todayBookings, monthlyRevenue,
      recentBookings, upcomingReturns,
      unpaidBookings
    ] = await Promise.all([
      Car.countDocuments(),
      Car.countDocuments({ isActive: true }),
      Driver.countDocuments(),
      Driver.countDocuments({ isActive: true }),
      Booking.countDocuments({ isActive: true }),
      Booking.countDocuments({ status: { $in: ['confirmed', 'ongoing'] }, isActive: true }),
      Booking.countDocuments({ status: 'pending', isActive: true }),
      Booking.countDocuments({ status: 'completed', isActive: true }),
      Booking.countDocuments({ travelDate: { $gte: today }, isActive: true }),
      Booking.aggregate([
        { $match: { createdAt: { $gte: thisMonth }, isActive: true } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, advance: { $sum: '$advancePaid' } } }
      ]),
      Booking.find({ isActive: true })
        .populate('car driver')
        .sort({ createdAt: -1 })
        .limit(5),
      Booking.find({
        status: { $in: ['confirmed', 'ongoing'] },
        travelDate: { $gte: today, $lte: moment().add(3, 'days').toDate() },
        isActive: true
      }).populate('car').sort({ travelDate: 1 }).limit(5),
      Booking.countDocuments({ paymentStatus: { $in: ['unpaid', 'partial'] }, isActive: true })
    ]);

    const revenue = monthlyRevenue[0] || { total: 0, advance: 0 };

    res.render('dashboard', {
      stats: {
        totalCars, activeCars,
        totalDrivers, activeDrivers,
        totalBookings, activeBookings,
        pendingBookings, completedBookings,
        todayBookings, unpaidBookings,
        monthlyRevenue: revenue.total || 0,
        monthlyCollected: revenue.advance || 0
      },
      recentBookings,
      upcomingReturns,
      moment
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Dashboard load error');
    res.redirect('/');
  }
});

// Root redirect
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.redirect('/login');
});

// 404
app.use((req, res) => {
  res.status(404).render('404', { url: req.originalUrl });
});

// ================= START =================
app.listen(PORT, () => {
  console.log(`🚀 TransPort Pro running at http://localhost:${PORT}`);
  console.log(`📋 Login: admin / admin123`);
});
