const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  suggestionNumber: {
    type: Number,
    required: true
  },
  issueDescription: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  },
  suggestedImprovement: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  }
});

const feedbackSchema = new mongoose.Schema({
  // Council Member Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    maxlength: 150
  },
  
  // Dynamic Suggestions Array
  suggestions: {
    type: [suggestionSchema],
    required: true,
    validate: {
      validator: function(suggestions) {
        return suggestions.length >= 1 && suggestions.length <= 4;
      },
      message: 'Must have between 1 and 4 suggestions'
    }
  },
  
  // Status and Metadata
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'approved', 'rejected', 'implemented'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  
  // Timestamps and tracking
  submittedAt: {
    type: Date,
    default: Date.now
  },
  
  // IP tracking for security
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Indexes for better performance
feedbackSchema.index({ name: 1 });
feedbackSchema.index({ status: 1 });
feedbackSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);