const mongoose = require('mongoose');

const validateId = (req, res, next) => {
  if (req.params.id && !mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid ID format' });
  }
  if (req.params.investmentId && !mongoose.Types.ObjectId.isValid(req.params.investmentId)) {
    return res.status(400).json({ message: 'Invalid investment ID format' });
  }
  next();
};

module.exports = validateId;
