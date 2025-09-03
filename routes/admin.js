const express = require('express');
const VotingSuggestion = require('../models/VotingSuggestion');
const Feedback = require('../models/Feedback');
const Vote = require('../models/Vote');

const router = express.Router();

// GET /api/admin/feedback - Get all submitted feedback for curation
router.get('/feedback', async (req, res) => {
  try {
    const { status = 'all', limit = 50, page = 1 } = req.query;
    
    let query = {};
    if (status !== 'all') {
      query.status = status;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const feedback = await Feedback.find(query)
      .sort({ submittedAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Feedback.countDocuments(query);

    console.log(`📋 Retrieved ${feedback.length} feedback items for admin review`);
    
    res.json({
      message: 'Feedback retrieved successfully',
      data: feedback,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error retrieving feedback:', error);
    res.status(500).json({
      error: 'Failed to retrieve feedback',
      code: 'SERVER_ERROR'
    });
  }
});


// PUT /api/admin/feedback/:id/status - Update feedback status
router.put('/feedback/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'reviewed', 'approved', 'rejected', 'implemented'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status value',
        code: 'VALIDATION_ERROR'
      });
    }

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!feedback) {
      return res.status(404).json({
        error: 'Feedback not found',
        code: 'NOT_FOUND'
      });
    }

    console.log(`📝 Updated feedback ${id} status to: ${status}`);

    res.json({
      message: 'Feedback status updated successfully',
      data: feedback
    });

  } catch (error) {
    console.error('Error updating feedback status:', error);
    res.status(500).json({
      error: 'Failed to update feedback status',
      code: 'SERVER_ERROR'
    });
  }
});


// POST /api/admin/feedback/:id/promote - Promote feedback suggestion to voting
router.post('/feedback/:id/promote', async (req, res) => {
  try {
    const { id: feedbackId } = req.params;
    const { 
      suggestionNumber, 
      title, 
      editedIssueDescription,
      editedSuggestedImprovement,
      priority = 'medium' 
    } = req.body;
    
    // Validation
    if (!suggestionNumber || !title || !editedIssueDescription || !editedSuggestedImprovement) {
      return res.status(400).json({
        error: 'Missing required fields for promotion',
        code: 'VALIDATION_ERROR'
      });
    }

    // Get original feedback
    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({
        error: 'Original feedback not found',
        code: 'FEEDBACK_NOT_FOUND'
      });
    }

    // Find the specific suggestion
    const originalSuggestion = feedback.suggestions.find(
      s => s.suggestionNumber === parseInt(suggestionNumber)
    );
    
    if (!originalSuggestion) {
      return res.status(404).json({
        error: 'Suggestion not found in feedback',
        code: 'SUGGESTION_NOT_FOUND'
      });
    }

    // Create VotingSuggestion from curated content
    const votingSuggestion = new VotingSuggestion({
      title: title.trim(),
      issueDescription: editedIssueDescription.trim(),
      suggestedImprovement: editedSuggestedImprovement.trim(),
      submitterName: feedback.name,
      submitterEmail: feedback.email,
      originalFeedbackId: feedbackId,
      priority,
      status: 'draft', // Start as draft for admin review
      createdBy: 'admin'
    });

    const savedSuggestion = await votingSuggestion.save();

    console.log(`🚀 Promoted feedback suggestion to voting: ${savedSuggestion._id}`);

    res.status(201).json({
      message: 'Suggestion promoted to voting successfully',
      code: 'SUCCESS',
      data: {
        votingSuggestion: savedSuggestion,
        originalFeedback: {
          id: feedback._id,
          submitter: feedback.name,
          originalSuggestion
        }
      }
    });

  } catch (error) {
    console.error('Error promoting suggestion:', error);
    res.status(500).json({
      error: 'Failed to promote suggestion',
      code: 'SERVER_ERROR'
    });
  }
});


// GET /api/admin/suggestions - Get all VotingSuggestion items with enhanced data
router.get('/suggestions', async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    
    let query = {};
    if (status !== 'all') {
      query.status = status;
    }
    
    const suggestions = await VotingSuggestion.find(query)
      .sort({ createdAt: -1 })
      .populate('originalFeedbackId', 'name email submittedAt');
    
    res.json({
      message: 'Suggestions retrieved successfully',
      data: suggestions,
      count: suggestions.length
    });

  } catch (error) {
    console.error('Error retrieving admin suggestions:', error);
    res.status(500).json({
      error: 'Failed to retrieve suggestions',
      code: 'SERVER_ERROR'
    });
  }
});


// POST /api/admin/suggestions - Create new VotingSuggestion manually
router.post('/suggestions', async (req, res) => {
  try {
    const {
      title,
      issueDescription,
      suggestedImprovement,
      submitterName,
      submitterEmail,
      originalFeedbackId,
      priority = 'medium'
    } = req.body;

    // Validation
    if (!title || !issueDescription || !suggestedImprovement || !submitterName) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'VALIDATION_ERROR'
      });
    }

    const newSuggestion = new VotingSuggestion({
      title: title.trim(),
      issueDescription: issueDescription.trim(),
      suggestedImprovement: suggestedImprovement.trim(),
      submitterName: submitterName.trim(),
      submitterEmail: submitterEmail ? submitterEmail.trim() : '',
      originalFeedbackId: originalFeedbackId || null,
      priority,
      status: 'draft'
    });

    const savedSuggestion = await newSuggestion.save();

    console.log('Admin suggestion created:', {
      id: savedSuggestion._id,
      title: savedSuggestion.title
    });

    res.status(201).json({
      message: 'Suggestion created successfully',
      code: 'SUCCESS',
      data: savedSuggestion
    });

  } catch (error) {
    console.error('Error creating suggestion:', error);
    res.status(500).json({
      error: 'Failed to create suggestion',
      code: 'SERVER_ERROR'
    });
  }
});

// PUT /api/admin/suggestions/:id - Update VotingSuggestion
router.put('/suggestions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow changing originalFeedbackId through this route
    delete updates.originalFeedbackId;
    delete updates.createdBy;

    const suggestion = await VotingSuggestion.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!suggestion) {
      return res.status(404).json({
        error: 'Suggestion not found',
        code: 'NOT_FOUND'
      });
    }

    console.log(`📝 Updated suggestion: ${suggestion._id}`);

    res.json({
      message: 'Suggestion updated successfully',
      data: suggestion
    });

  } catch (error) {
    console.error('Error updating suggestion:', error);
    res.status(500).json({
      error: 'Failed to update suggestion',
      code: 'SERVER_ERROR'
    });
  }
});

// DELETE /api/admin/suggestions/:id - Delete VotingSuggestion
router.delete('/suggestions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const suggestion = await VotingSuggestion.findByIdAndDelete(id);

    if (!suggestion) {
      return res.status(404).json({
        error: 'Suggestion not found',
        code: 'NOT_FOUND'
      });
    }

    console.log(`🗑️ Deleted suggestion: ${id}`);

    res.json({
      message: 'Suggestion deleted successfully',
      data: { id, title: suggestion.title }
    });

  } catch (error) {
    console.error('Error deleting suggestion:', error);
    res.status(500).json({
      error: 'Failed to delete suggestion',
      code: 'SERVER_ERROR'
    });
  }
});


// POST /api/admin/suggestions/:id/activate - Activate suggestion for voting
router.post('/suggestions/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;

    const suggestion = await VotingSuggestion.findByIdAndUpdate(
      id,
      { status: 'active' },
      { new: true }
    );

    if (!suggestion) {
      return res.status(404).json({
        error: 'Suggestion not found',
        code: 'NOT_FOUND'
      });
    }

    console.log(`🎯 Activated suggestion for voting: ${suggestion._id}`);

    res.json({
      message: 'Suggestion activated for voting',
      data: suggestion
    });

  } catch (error) {
    console.error('Error activating suggestion:', error);
    res.status(500).json({
      error: 'Failed to activate suggestion',
      code: 'SERVER_ERROR'
    });
  }
});

// POST /api/admin/suggestions/:id/close - Close suggestion voting
router.post('/suggestions/:id/close', async (req, res) => {
  try {
    const { id } = req.params;

    const suggestion = await VotingSuggestion.findByIdAndUpdate(
      id,
      { status: 'closed' },
      { new: true }
    );

    if (!suggestion) {
      return res.status(404).json({
        error: 'Suggestion not found',
        code: 'NOT_FOUND'
      });
    }

    console.log(`🔒 Closed suggestion voting: ${suggestion._id}`);

    res.json({
      message: 'Suggestion voting closed',
      data: suggestion
    });

  } catch (error) {
    console.error('Error closing suggestion:', error);
    res.status(500).json({
      error: 'Failed to close suggestion',
      code: 'SERVER_ERROR'
    });
  }
});

// GET /api/admin/statistics - Get comprehensive admin statistics
router.get('/statistics', async (req, res) => {
  try {
    // Feedback statistics
    const feedbackStats = await Feedback.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // VotingSuggestion statistics  
    const suggestionStats = await VotingSuggestion.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Voting statistics
    const votingStats = await Vote.getVotingStats();

    // Recent activity
    const recentFeedback = await Feedback.find()
      .sort({ submittedAt: -1 })
      .limit(5)
      .select('name submittedAt status suggestions');

    const recentVotes = await Vote.find()
      .sort({ votedAt: -1 })
      .limit(10)
      .select('vote votedAt suggestionId');

    const statistics = {
      feedback: feedbackStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      
      suggestions: suggestionStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      
      voting: votingStats,
      
      recent: {
        feedback: recentFeedback,
        votes: recentVotes
      }
    };

    console.log('📈 Generated admin statistics');

    res.json({
      message: 'Statistics retrieved successfully',
      data: statistics
    });

  } catch (error) {
    console.error('Error generating statistics:', error);
    res.status(500).json({
      error: 'Failed to generate statistics',
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;