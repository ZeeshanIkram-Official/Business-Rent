const express  = require('express');
const router   = express.Router();
const Expense  = require('../models/Expense');
const Car      = require('../models/Car');
const Driver   = require('../models/Driver');
const moment   = require('moment');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

async function generateExpenseId() {
  const count = await Expense.countDocuments();
  return 'EXP-' + String(count + 1).padStart(4, '0');
}

// List
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { search, category, from, to } = req.query;
    let filter = { isActive: true };
    if (category) filter.category = category;
    if (from || to) {
      filter.expenseDate = {};
      if (from) filter.expenseDate.$gte = new Date(from);
      if (to)   filter.expenseDate.$lte = new Date(to + 'T23:59:59');
    }
    if (search) filter.$or = [
      { expenseId:   new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
      { paidTo:      new RegExp(search, 'i') }
    ];

    const expenses = await Expense.find(filter)
      .populate('car driver')
      .sort({ expenseDate: -1 });

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    const stats = {
      total:       await Expense.countDocuments({ isActive: true }),
      thisMonth:   await Expense.countDocuments({ isActive: true, expenseDate: { $gte: moment().startOf('month').toDate() } }),
      totalAmount,
      fuel:        await Expense.aggregate([{ $match: { isActive: true, category: 'fuel' } },        { $group: { _id: null, total: { $sum: '$amount' } } }]),
      maintenance: await Expense.aggregate([{ $match: { isActive: true, category: 'maintenance' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    };

    res.render('expenses/index', {
      title: 'Expenses', expenses, stats, moment,
      filters: { search: search || '', category: category || '', from: from || '', to: to || '' }
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/dashboard');
  }
});

// Add form
router.get('/add', isAuthenticated, async (req, res) => {
  const cars    = await Car.find({ isActive: true }).sort({ name: 1 });
  const drivers = await Driver.find({ isActive: true }).sort({ name: 1 });
  res.render('expenses/add', { title: 'Add Expense', cars, drivers, moment });
});

// Add POST
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const d = req.body;
    const expenseId = await generateExpenseId();
    await Expense.create({
      expenseId,
      category:      d.category,
      amount:        parseFloat(d.amount) || 0,
      description:   d.description,
      car:           d.car || null,
      driver:        d.driver || null,
      paidTo:        d.paidTo,
      paymentMethod: d.paymentMethod,
      expenseDate:   d.expenseDate ? new Date(d.expenseDate) : new Date(),
      notes:         d.notes,
      createdBy:     req.session.userName
    });
    req.flash('success', `Expense ${expenseId} added successfully`);
    res.redirect('/expenses');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/expenses/add');
  }
});

// Edit form
router.get('/:id/edit', isAuthenticated, async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) { req.flash('error', 'Not found'); return res.redirect('/expenses'); }
  const cars    = await Car.find({ isActive: true }).sort({ name: 1 });
  const drivers = await Driver.find({ isActive: true }).sort({ name: 1 });
  res.render('expenses/edit', { title: 'Edit Expense', expense, cars, drivers, moment });
});

// Edit PUT
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const d = req.body;
    await Expense.findByIdAndUpdate(req.params.id, {
      category:      d.category,
      amount:        parseFloat(d.amount) || 0,
      description:   d.description,
      car:           d.car || null,
      driver:        d.driver || null,
      paidTo:        d.paidTo,
      paymentMethod: d.paymentMethod,
      expenseDate:   d.expenseDate ? new Date(d.expenseDate) : new Date(),
      notes:         d.notes
    });
    req.flash('success', 'Expense updated');
    res.redirect('/expenses');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect(`/expenses/${req.params.id}/edit`);
  }
});

// Delete
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  await Expense.findByIdAndUpdate(req.params.id, { isActive: false });
  req.flash('success', 'Expense deleted');
  res.redirect('/expenses');
});

module.exports = router;