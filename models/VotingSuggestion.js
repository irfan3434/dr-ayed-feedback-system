const mongoose = require('mongoose');

const votingSuggestionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  issueDescription: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  suggestedImprovement: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  submitterName: {
    type: String,
    required: true,
    trim: true
  },
  submitterEmail: {
    type: String,
    trim: true
  },
  originalFeedbackId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feedback'
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'closed'],
    default: 'draft'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  createdBy: {
    type: String,
    required: true,
    default: 'admin'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better performance
votingSuggestionSchema.index({ status: 1 });
votingSuggestionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('VotingSuggestion', votingSuggestionSchema);