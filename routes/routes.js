const express = require('express');
const router  = express.Router();
const Route   = require('../models/Route');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// ✅ RouteId generator
async function generateRouteId() {
  const count = await Route.countDocuments();
  return 'RT-' + String(count + 1).padStart(4, '0');
}

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get('/', isAuthenticated, async (req, res) => {
  const { search } = req.query;
  let filter = {};
  if (search) {
    filter.$or = [
      { origin:      new RegExp(search, 'i') },
      { destination: new RegExp(search, 'i') },
      { name:        new RegExp(search, 'i') },
      { routeId:     new RegExp(search, 'i') },
      { company:     new RegExp(search, 'i') }
    ];
  }
  const routes = await Route.find(filter).sort({ createdAt: -1 });
  res.render('routes/index', { title: 'Routes', routes, filters: { search: search || '' } });
});

// ── ADD FORM ──────────────────────────────────────────────────────────────────
router.get('/add', isAuthenticated, isAdmin, (req, res) => {
  res.render('routes/add', { title: 'Add Route' });
});

// ── CHECK DUPLICATE API ───────────────────────────────────────────────────────
router.get('/check-duplicate', isAuthenticated, async (req, res) => {
  const { company, origin, destination } = req.query;
  const exists = await Route.findOne({
    company:     new RegExp(`^${company}$`, 'i'),
    origin:      new RegExp(`^${origin}$`, 'i'),
    destination: new RegExp(`^${destination}$`, 'i')
  });
  res.json({ exists: !!exists });
});

// ── ADD POST ──────────────────────────────────────────────────────────────────
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { company, origin, destination, price, notes } = req.body;
    const routeId = await generateRouteId();
    const name = `${origin.trim()} → ${destination.trim()}`;
    await Route.create({
      routeId, name, company, origin, destination,
      price: parseFloat(price) || 0,
      notes
    });
    req.flash('success', `Route "${name}" added successfully`);
    res.redirect('/routes');
  } catch (err) {
    if (err.code === 11000) {
      req.flash('error', `Route "${req.body.origin} → ${req.body.destination}" already exists for this company`);
    } else {
      req.flash('error', err.message);
    }
    res.redirect('/routes/add');
  }
});

// ── EDIT FORM ─────────────────────────────────────────────────────────────────
router.get('/:id/edit', isAuthenticated, isAdmin, async (req, res) => {
  const route = await Route.findById(req.params.id);
  if (!route) { req.flash('error', 'Route not found'); return res.redirect('/routes'); }
  res.render('routes/edit', { title: 'Edit Route', route });
});

// ── EDIT PUT ──────────────────────────────────────────────────────────────────
router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { company, origin, destination, price, notes } = req.body;
    const name = `${origin.trim()} → ${destination.trim()}`;
    await Route.findByIdAndUpdate(req.params.id, {
      name, company, origin, destination,
      price: parseFloat(price) || 0,
      notes
    });
    req.flash('success', 'Route updated successfully');
    res.redirect('/routes');
  } catch (err) {
    if (err.code === 11000) {
      req.flash('error', `Route "${req.body.origin} → ${req.body.destination}" already exists for this company`);
    } else {
      req.flash('error', err.message);
    }
    res.redirect(`/routes/${req.params.id}/edit`);
  }
});

// ── TOGGLE STATUS ─────────────────────────────────────────────────────────────
router.put('/:id/toggle', isAuthenticated, isAdmin, async (req, res) => {
  const route = await Route.findById(req.params.id);
  if (!route) { req.flash('error', 'Route not found'); return res.redirect('/routes'); }
  await Route.findByIdAndUpdate(req.params.id, { isActive: !route.isActive });
  res.redirect('/routes');
});

// ── DELETE ────────────────────────────────────────────────────────────────────
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const route = await Route.findByIdAndDelete(req.params.id);
    if (!route) {
      req.flash('error', 'Route not found');
      return res.redirect('/routes');
    }
    req.flash('success', 'Route permanently deleted');
    res.redirect('/routes');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/routes');
  }
});

// ── API: get route fare ───────────────────────────────────────────────────────
router.get('/:id/fare', isAuthenticated, async (req, res) => {
  const route = await Route.findById(req.params.id);
  if (!route) return res.json({ baseFare: 0 });
  res.json({ baseFare: route.baseFare, distanceKm: route.distanceKm, estimatedHours: route.estimatedHours });
});

module.exports = router;