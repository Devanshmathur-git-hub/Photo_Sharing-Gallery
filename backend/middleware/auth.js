/**
 * Mock auth middleware: sets req.user with a dummy user id.
 * In production, replace with real JWT/session validation.
 */
const User = require('../models/User');

const mockAuth = async (req, res, next) => {
  try {
    let user = await User.findOne();
    if (!user) {
      user = await User.create({
        username: 'demo-user',
        email: 'demo@example.com',
      });
    }
    req.user = { id: user._id.toString() };
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth setup failed' });
  }
};

module.exports = { mockAuth };







