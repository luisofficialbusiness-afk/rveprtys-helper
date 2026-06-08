const { EmbedBuilder } = require('discord.js');
const User = require('../models/user');

const MAX_BALANCE = 999_999_999_999_999;

// The economy is global - every server shares the same balances/inventories/etc.
// User documents no longer carry a guildId; one document per user, period.
// GLOBAL_GUILD_ID is kept only as the "home" Discord server - e.g. for posting
// global announcements (lottery draws, etc.) to a real channel.
const GLOBAL_GUILD_ID = '1495938292506562621';

const acLog = new Map();

async function getUser(userId) {
    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId });
    return user;
}

async function anticheat(client, userId) {
    const u = await getUser(userId);
    const flags = [];

    if (u.balance + u.bank > MAX_BALANCE) flags.push('max_balance');
    if (isNaN(u.balance) || isNaN(u.bank)) flags.push('nan_balance');
    if (u.balance < 0) flags.push('negative_wallet');
    if (u.bank < 0) flags.push('negative_bank');

    const now = Date.now();
    const last = acLog.get(userId);
    if (last) {
        const timeDiff = now - last.ts;
        const gainedSince = (u.balance + u.bank) - last.total;
        if (timeDiff < 60000 && gainedSince > 10_000_000) flags.push('rapid_gain');
    }
    acLog.set(userId, { ts: now, total: u.balance + u.bank });

    if (flags.length === 0) return;

    if (flags.includes('nan_balance') || flags.includes('negative_wallet') || flags.includes('negative_bank') || flags.includes('max_balance')) {
        u.balance = 0;
        u.bank = 0;
    }

    if (flags.includes('rapid_gain')) {
        u.balance = Math.min(u.balance, 50_000_000);
        u.bank = Math.min(u.bank, 50_000_000);
    }

    await u.save();

    try {
        const du = await client.users.fetch(userId);
        await du.send({
            embeds: [new EmbedBuilder()
                .setTitle('Anti-Cheat Triggered')
                .setDescription(`Your account triggered a flag (${flags.join(', ')}) and your balance has been adjusted.`)
                .setColor(0xff0000)]
        });
    } catch {}
}

module.exports = { getUser, anticheat, GLOBAL_GUILD_ID, MAX_BALANCE };
