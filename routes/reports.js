const express = require('express');
const router  = express.Router();
const Booking = require('../models/Booking');
const Car     = require('../models/Car');
const Driver  = require('../models/Driver');
const Expense = require('../models/Expense');
const moment  = require('moment');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { from, to } = req.query;
    const start = from ? new Date(from) : moment().startOf('month').toDate();
    const end   = to   ? new Date(to + 'T23:59:59') : moment().endOf('month').toDate();

    // ─── BOOKINGS ────────────────────────────────────────────────
    const bookings = await Booking.find({
      isActive: true,
      createdAt: { $gte: start, $lte: end }
    }).populate('car driver').sort({ createdAt: -1 });

    const totalRevenue   = bookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const totalCollected = bookings.reduce((s, b) => s + (b.advancePaid || 0), 0);
    const totalPending   = bookings.reduce((s, b) => s + (b.remainingAmount || 0), 0);
    const totalBookings  = bookings.length;
    const completed      = bookings.filter(b => b.status === 'completed').length;
    const cancelled      = bookings.filter(b => b.status === 'cancelled').length;
    const totalCost      = bookings.reduce((s, b) => s + (b.totalCost || 0), 0);
    const grossProfit    = totalRevenue - totalCost;

    // ─── EXPENSES ────────────────────────────────────────────────
    const expenses = await Expense.find({
      isActive: true,
      expenseDate: { $gte: start, $lte: end }   // ✅ FIXED: expenseDate
    });

    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const netProfit     = grossProfit - totalExpenses;

    // ─── EXPENSE CATEGORY BREAKDOWN ──────────────────────────────
    const expenseCategoryTotals = await Expense.aggregate([
      { $match: { isActive: true, expenseDate: { $gte: start, $lte: end } } },  // ✅ FIXED
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } }
    ]);

    // ─── DAILY CHART DATA ─────────────────────────────────────────
    const dailyBookings = await Booking.aggregate([
      { $match: { isActive: true, createdAt: { $gte: start, $lte: end } } },
      { $group: {
          _id:     { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          cost:    { $sum: { $ifNull: ['$totalCost', 0] } },
          count:   { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Expense per day map
    const expenseByDay = {};
    expenses.forEach(e => {
      const day = moment(e.expenseDate).format('YYYY-MM-DD');  // ✅ FIXED
      expenseByDay[day] = (expenseByDay[day] || 0) + (e.amount || 0);
    });

    // Merge: booking days + expense-only days
    const allDays = new Set([
      ...dailyBookings.map(d => d._id),
      ...Object.keys(expenseByDay)
    ]);

    const bookingMap = {};
    dailyBookings.forEach(d => { bookingMap[d._id] = d; });

    const dailyData = [...allDays].sort().map(date => {
      const b = bookingMap[date] || { revenue: 0, cost: 0, count: 0 };
      const exp = expenseByDay[date] || 0;
      return {
        _id:      date,
        revenue:  b.revenue,
        cost:     b.cost,
        count:    b.count,
        expenses: exp,
        gross:    b.revenue - b.cost,
        net:      b.revenue - b.cost - exp
      };
    });

    // ─── TOP CARS ─────────────────────────────────────────────────
    const topCars = await Booking.aggregate([
      { $match: { isActive: true, status: 'completed', createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$car', revenue: { $sum: '$totalAmount' }, trips: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'cars', localField: '_id', foreignField: '_id', as: 'car' } },
      { $unwind: '$car' }
    ]);

    // ─── TOP DRIVERS ──────────────────────────────────────────────
    const topDrivers = await Booking.aggregate([
      { $match: { isActive: true, driver: { $ne: null }, status: 'completed', createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$driver', trips: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { trips: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'drivers', localField: '_id', foreignField: '_id', as: 'driver' } },
      { $unwind: '$driver' }
    ]);

    res.render('reports/index', {
      title: 'Reports & Analytics',
      bookings,
      totalRevenue, totalCollected, totalPending,
      totalBookings, completed, cancelled,
      totalCost, grossProfit,
      totalExpenses, netProfit,
      expenseCategoryTotals,
      dailyData,
      topCars, topDrivers,
      filters: {
        from: moment(start).format('YYYY-MM-DD'),
        to:   moment(end).format('YYYY-MM-DD')
      },
      moment
    });

  } catch (err) {
    console.error(err);
    req.flash('error', err.message);
    res.redirect('/dashboard');
  }
});

module.exports = router;
