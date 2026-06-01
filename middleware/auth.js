const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) return next();
  req.flash('error', 'Please login to continue');
  res.redirect('/login');
};

const isAdmin = (req, res, next) => {
  if (req.session && req.session.userRole === 'admin') return next();
  req.flash('error', 'Admin access required');
  res.redirect('/dashboard');
};

const isAdminOrBookingAgent = (req, res, next) => {
  if (req.session && ['admin', 'booking_agent'].includes(req.session.userRole)) return next();
  req.flash('error', 'Access denied');
  res.redirect('/login');
};

module.exports = { isAuthenticated, isAdmin, isAdminOrBookingAgent };
