const mongoose = require('mongoose');
const { Schema } = mongoose;

const apiKeySchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

module.exports = ApiKey;
