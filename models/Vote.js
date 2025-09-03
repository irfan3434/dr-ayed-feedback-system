const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  suggestionId: {
    type: String,
    required: true,
    index: true
  },
  feedbackId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feedback',
    required: false // Made optional since VotingSuggestion might not have originalFeedbackId
  },
  suggestionNumber: {
    type: Number,
    required: false // Not applicable for VotingSuggestion items
  },
  vote: {
    type: String,
    enum: ['agree', 'disagree'],
    required: true
  },
  voterFingerprint: {
    type: String,
    required: true,
    index: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  votedAt: {
    type: Date,
    default: Date.now
  },
  // New fields for better tracking
  voteType: {
    type: String,
    enum: ['feedback_suggestion', 'voting_suggestion'],
    default: 'voting_suggestion' // Default to new VotingSuggestion system
  },
  votingSuggestionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VotingSuggestion',
    required: false // Reference to VotingSuggestion if applicable
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate votes
voteSchema.index({ suggestionId: 1, voterFingerprint: 1 }, { unique: true });

// Additional indexes for performance
voteSchema.index({ voteType: 1 });
voteSchema.index({ votingSuggestionId: 1 });
voteSchema.index({ votedAt: -1 });

// Static method to get vote counts for a suggestion
voteSchema.statics.getVoteCounts = async function(suggestionId) {
  try {
    const counts = await this.aggregate([
      { $match: { suggestionId } },
      {
        $group: {
          _id: '$vote',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = { agree: 0, disagree: 0, total: 0 };
    counts.forEach(item => {
      result[item._id] = item.count;
      result.total += item.count;
    });

    return result;
  } catch (error) {
    console.error('Error getting vote counts:', error);
    return { agree: 0, disagree: 0, total: 0 };
  }
};

// Static method to get detailed voting statistics
voteSchema.statics.getVotingStats = async function() {
  try {
    const stats = await this.aggregate([
      {
        $group: {
          _id: null,
          totalVotes: { $sum: 1 },
          agreeVotes: {
            $sum: { $cond: [{ $eq: ['$vote', 'agree'] }, 1, 0] }
          },
          disagreeVotes: {
            $sum: { $cond: [{ $eq: ['$vote', 'disagree'] }, 1, 0] }
          },
          uniqueVoters: { $addToSet: '$voterFingerprint' }
        }
      },
      {
        $project: {
          totalVotes: 1,
          agreeVotes: 1,
          disagreeVotes: 1,
          uniqueVoters: { $size: '$uniqueVoters' }
        }
      }
    ]);

    return stats[0] || {
      totalVotes: 0,
      agreeVotes: 0,
      disagreeVotes: 0,
      uniqueVoters: 0
    };
  } catch (error) {
    console.error('Error getting voting stats:', error);
    return {
      totalVotes: 0,
      agreeVotes: 0,
      disagreeVotes: 0,
      uniqueVoters: 0
    };
  }
};

// Static method to check if user has voted on suggestion
voteSchema.statics.hasUserVoted = async function(suggestionId, voterFingerprint) {
  try {
    const vote = await this.findOne({ suggestionId, voterFingerprint });
    return vote ? { hasVoted: true, vote: vote.vote } : { hasVoted: false, vote: null };
  } catch (error) {
    console.error('Error checking user vote:', error);
    return { hasVoted: false, vote: null };
  }
};

// Instance method to get related voting suggestion
voteSchema.methods.getVotingSuggestion = async function() {
  if (this.voteType === 'voting_suggestion' && this.votingSuggestionId) {
    const VotingSuggestion = mongoose.model('VotingSuggestion');
    return await VotingSuggestion.findById(this.votingSuggestionId);
  }
  return null;
};

// Pre-save middleware to set votingSuggestionId if suggestionId is a valid ObjectId
voteSchema.pre('save', function(next) {
  // If suggestionId looks like a MongoDB ObjectId and voteType is voting_suggestion
  if (this.voteType === 'voting_suggestion' && 
      mongoose.Types.ObjectId.isValid(this.suggestionId) &&
      !this.votingSuggestionId) {
    this.votingSuggestionId = this.suggestionId;
  }
  next();
});

module.exports = mongoose.model('Vote', voteSchema);