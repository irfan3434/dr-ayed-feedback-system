const express = require('express');
const validator = require('validator');
const xss = require('xss');
const Feedback = require('../models/Feedback');

const router = express.Router();

// POST /api/feedback - Submit new feedback
router.post('/', async (req, res) => {
  try {
    console.log('📥 Feedback submission received:', {
      name: req.body.name,
      suggestionCount: req.body.suggestions?.length,
      timestamp: new Date().toISOString()
    });

    const { name, email, suggestions } = req.body;

    // Basic validation
    if (!name || !suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'VALIDATION_ERROR'
      });
    }

    // Sanitize inputs
    const sanitizedData = {
      name: xss(name.trim()),
      email: email ? xss(email.trim().toLowerCase()) : '',
      suggestions: suggestions.map((suggestion, index) => ({
        suggestionNumber: index + 1,
        issueDescription: xss(suggestion.issueDescription?.trim() || ''),
        suggestedImprovement: xss(suggestion.suggestedImprovement?.trim() || '')
      })),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    // Validate email if provided
    if (sanitizedData.email && !validator.isEmail(sanitizedData.email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Validate suggestions
    if (sanitizedData.suggestions.length > 4) {
      return res.status(400).json({
        error: 'Maximum 4 suggestions allowed',
        code: 'TOO_MANY_SUGGESTIONS'
      });
    }

    // Create and save feedback
    const feedback = new Feedback(sanitizedData);
    const savedFeedback = await feedback.save();

    console.log('✅ Feedback saved successfully:', {
      id: savedFeedback._id,
      name: savedFeedback.name,
      suggestionCount: savedFeedback.suggestions.length
    });

    res.status(201).json({
      message: 'Feedback submitted successfully',
      code: 'SUCCESS',
      data: {
        id: savedFeedback._id,
        submittedAt: savedFeedback.submittedAt,
        suggestionCount: savedFeedback.suggestions.length
      }
    });

  } catch (error) {
    console.error('❌ Error saving feedback:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// GET /api/feedback - Get all feedback (for testing)
router.get('/', async (req, res) => {
  try {
    const feedback = await Feedback.find().sort({ submittedAt: -1 });
    res.json({
      message: 'Feedback retrieved successfully',
      data: feedback,
      count: feedback.length
    });
  } catch (error) {
    console.error('❌ Error retrieving feedback:', error);
    res.status(500).json({
      error: 'Failed to retrieve feedback',
      code: 'SERVER_ERROR'
    });
  }
});

// TEMPORARY: Delete all feedback (add this anywhere in your routes file)
router.get('/reset', async (req, res) => {
  try {
    const result = await Feedback.deleteMany({});
    console.log('🗑️ Database reset - Deleted:', result.deletedCount, 'items');
    
    res.json({
      message: `Database reset successful! Deleted ${result.deletedCount} feedback items.`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Reset failed', details: error.message });
  }
});

module.exports = router;