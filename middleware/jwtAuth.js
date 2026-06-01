const jwt = require('jsonwebtoken');

const JWT_SECRET =
  process.env.JWT_SECRET ||
  'carpos_jwt_secret_change_in_production';

const JWT_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN || '8h';


// =====================
// Generate JWT Token
// =====================

function generateToken(user) {

  return jwt.sign(
    {
      userId: user._id,
      username: user.username,
      name: user.name,
      role: user.role
    },

    JWT_SECRET,

    {
      expiresIn: JWT_EXPIRES_IN
    }
  );
}


// =====================
// Verify JWT Middleware
// =====================

function verifyJWT(req, res, next) {

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {

    return res.status(401).json({
      success: false,
      error: 'Token missing. Format: Bearer <token>'
    });

  }

  const token = authHeader.split(' ')[1];

  try {

    const decoded = jwt.verify(token, JWT_SECRET);

    req.jwtUser = decoded;

    next();

  } catch (err) {

    if (err.name === 'TokenExpiredError') {

      return res.status(401).json({
        success: false,
        error: 'Token expire ho gaya. Dobara login karein.'
      });

    }

    return res.status(401).json({
      success: false,
      error: 'Invalid token.'
    });

  }
}


// =====================
// Admin Middleware
// =====================

function jwtAdmin(req, res, next) {

  if (
    req.jwtUser &&
    req.jwtUser.role === 'admin'
  ) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Sirf admin allowed hai.'
  });
}


module.exports = {
  generateToken,
  verifyJWT,
  jwtAdmin,
  JWT_SECRET
};