const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
    userId:        { type: String, required: true, unique: true },
    totalVotes:    { type: Number, default: 0 },
    voteStreak:    { type: Number, default: 0 },
    lastVoted:     { type: Number, default: 0 },
    tier:          { type: Number, default: 0 },
    tierProgress:  { type: Number, default: 0 },
    claimedTiers:  { type: [Number], default: [] },
});

module.exports = mongoose.models.Vote || mongoose.model('Vote', voteSchema);
