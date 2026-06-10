const mongoose = require('mongoose');

const anticheatLogSchema = new mongoose.Schema({
    userId:     { type: String, required: true, index: true },
    type:       { type: String, required: true },
    detail:     { type: String, required: true },
    severity:   { type: String, enum: ['critical', 'warning'], default: 'warning' },
    balanceBefore: { type: Number, default: 0 },
    bankBefore:    { type: Number, default: 0 },
    balanceAfter:  { type: Number, default: null },
    bankAfter:     { type: Number, default: null },
    autoFixed:  { type: Boolean, default: false },
    dismissed:  { type: Boolean, default: false },
    timestamp:  { type: Number, default: Date.now },
});

module.exports = mongoose.models.AnticheatLog || mongoose.model('AnticheatLog', anticheatLogSchema);
