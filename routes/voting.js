const express = require('express');
const Vote = require('../models/Vote');
const VotingSuggestion = require('../models/VotingSuggestion'); // FIXED: Added missing import

const router = express.Router();

// Generate voter fingerprint
function generateFingerprint(ip, userAgent) {
  const crypto = require('crypto');
  const fingerprint = crypto
    .createHash('sha256')
    .update(ip + userAgent)
    .digest('hex')
    .substring(0, 32);
  return fingerprint;
}

// GET /api/voting/suggestions - Get all ACTIVE VotingSuggestion items with vote counts
router.get('/suggestions', async (req, res) => {
  try {
    console.log('📊 Loading active suggestions for voting...');
    
    // Only get ACTIVE VotingSuggestion items for voting
    const suggestions = await VotingSuggestion.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .populate('originalFeedbackId', 'name email submittedAt');

    const suggestionsWithVotes = [];

    for (const suggestion of suggestions) {
      const suggestionId = suggestion._id.toString();
      const voteCounts = await Vote.getVoteCounts(suggestionId);
      
      suggestionsWithVotes.push({
        suggestionId,
        title: suggestion.title,
        issueDescription: suggestion.issueDescription,
        suggestedImprovement: suggestion.suggestedImprovement,
        submitter: suggestion.submitterName,
        submitterEmail: suggestion.submitterEmail,
        priority: suggestion.priority,
        createdAt: suggestion.createdAt,
        votes: voteCounts,
        originalFeedback: suggestion.originalFeedbackId
      });
    }

    console.log(`✅ Loaded ${suggestionsWithVotes.length} active suggestions for voting`);

    res.json({
      message: 'Active suggestions retrieved successfully',
      data: suggestionsWithVotes,
      count: suggestionsWithVotes.length
    });

  } catch (error) {
    console.error('❌ Error retrieving voting suggestions:', error);
    res.status(500).json({
      error: 'Failed to retrieve suggestions',
      code: 'SERVER_ERROR'
    });
  }
});

// POST /api/voting/suggestions/:id/vote - Submit vote for a VotingSuggestion
router.post('/suggestions/:id/vote', async (req, res) => {
  try {
    const { id: suggestionId } = req.params; // Clean MongoDB ObjectId
    const { vote } = req.body;
    
    console.log(`🗳️ Vote submission - Suggestion: ${suggestionId}, Vote: ${vote}`);
    
    // Validate vote
    if (!vote || !['agree', 'disagree'].includes(vote)) {
      return res.status(400).json({
        error: 'Invalid vote. Must be "agree" or "disagree"',
        code: 'INVALID_VOTE'
      });
    }

    // Verify VotingSuggestion exists and is active
    const suggestion = await VotingSuggestion.findOne({ 
      _id: suggestionId, 
      status: 'active' 
    });
    
    if (!suggestion) {
      return res.status(404).json({
        error: 'Active suggestion not found',
        code: 'SUGGESTION_NOT_FOUND'
      });
    }

    // Generate voter fingerprint
    const voterFingerprint = generateFingerprint(
      req.ip || req.connection.remoteAddress,
      req.get('User-Agent') || ''
    );

    // Check if user already voted
    const existingVote = await Vote.findOne({
      suggestionId,
      voterFingerprint
    });

    if (existingVote) {
      return res.status(409).json({
        error: 'You have already voted on this suggestion',
        code: 'ALREADY_VOTED',
        existingVote: existingVote.vote
      });
    }

    // Create new vote
    const newVote = new Vote({
      suggestionId,
      feedbackId: suggestion.originalFeedbackId, // Optional reference to original feedback
      suggestionNumber: null, // Not applicable for VotingSuggestion items
      vote,
      voterFingerprint,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || ''
    });

    await newVote.save();

    // Get updated vote counts
    const voteCounts = await Vote.getVoteCounts(suggestionId);

    console.log(`✅ Vote recorded: ${vote} on suggestion ${suggestionId}`);

    res.status(201).json({
      message: 'Vote recorded successfully',
      code: 'SUCCESS',
      data: {
        suggestionId,
        vote,
        voteCounts
      }
    });

  } catch (error) {
    console.error('❌ Error recording vote:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Duplicate vote detected',
        code: 'DUPLICATE_VOTE'
      });
    }

    res.status(500).json({
      error: 'Failed to record vote',
      code: 'SERVER_ERROR'
    });
  }
});

// GET /api/voting/suggestions/:id/votes - Get vote counts for specific VotingSuggestion
router.get('/suggestions/:id/votes', async (req, res) => {
  try {
    const { id: suggestionId } = req.params;
    
    // Verify suggestion exists and is active
    const suggestion = await VotingSuggestion.findOne({ 
      _id: suggestionId, 
      status: 'active' 
    });
    
    if (!suggestion) {
      return res.status(404).json({
        error: 'Active suggestion not found',
        code: 'SUGGESTION_NOT_FOUND'
      });
    }

    const voteCounts = await Vote.getVoteCounts(suggestionId);
    
    res.json({
      message: 'Vote counts retrieved successfully',
      data: {
        suggestionId,
        votes: voteCounts
      }
    });

  } catch (error) {
    console.error('❌ Error retrieving vote counts:', error);
    res.status(500).json({
      error: 'Failed to retrieve vote counts',
      code: 'SERVER_ERROR'
    });
  }
});

// GET /api/voting/check/:id - Check if user has voted on VotingSuggestion
router.get('/check/:id', async (req, res) => {
  try {
    const { id: suggestionId } = req.params;
    
    // Verify suggestion exists and is active
    const suggestion = await VotingSuggestion.findOne({ 
      _id: suggestionId, 
      status: 'active' 
    });
    
    if (!suggestion) {
      return res.status(404).json({
        error: 'Active suggestion not found',
        code: 'SUGGESTION_NOT_FOUND'
      });
    }
    
    const voterFingerprint = generateFingerprint(
      req.ip || req.connection.remoteAddress,
      req.get('User-Agent') || ''
    );

    const existingVote = await Vote.findOne({
      suggestionId,
      voterFingerprint
    });

    res.json({
      message: 'Vote check completed',
      data: {
        hasVoted: !!existingVote,
        vote: existingVote ? existingVote.vote : null
      }
    });

  } catch (error) {
    console.error('❌ Error checking vote:', error);
    res.status(500).json({
      error: 'Failed to check vote',
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;