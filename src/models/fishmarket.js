const mongoose = require('mongoose');

const fishMarketSchema = new mongoose.Schema({
    guildId:    { type: String, required: true },
    fishType:   { type: String, required: true },
    soldLast24h:{ type: Number, default: 0 },
    lastReset:  { type: Date,   default: Date.now },
});

fishMarketSchema.index({ guildId: 1, fishType: 1 }, { unique: true });

module.exports = mongoose.model('FishMarket', fishMarketSchema);
