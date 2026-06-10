const User = require('../models/user');

const MAX_BALANCE = 999_999_999_999_999;

// The economy is global - every server shares the same balances/inventories/etc.
// User documents no longer carry a guildId; one document per user, period.
// GLOBAL_GUILD_ID is kept only as the "home" Discord server - e.g. for posting
// global announcements (lottery draws, etc.) to a real channel.
const GLOBAL_GUILD_ID = '1495938292506562621';

async function getUser(userId) {
    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId });
    return user;
}

async function anticheat(client, userId) {
    const { anticheat: runAnticheat } = require('./anticheat/anticheat');
    return runAnticheat(client, userId);
}

module.exports = { getUser, anticheat, GLOBAL_GUILD_ID, MAX_BALANCE };
