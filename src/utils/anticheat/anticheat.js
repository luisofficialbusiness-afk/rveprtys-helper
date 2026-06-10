const fetch = require('node-fetch');
const AnticheatLog = require('../../models/AnticheatLog');

const MAX_BALANCE = 999_999_999_999_999;
const MAX_NET_WORTH = 100_000_000_000_000;
const MAX_DAILY_STREAK = 365;
const RAPID_GAIN_AMOUNT = 50_000_000;
const RAPID_GAIN_WINDOW = 5 * 60 * 1000;

const MAX_ROD_DURABILITY = {
    fishing_rod_wooden:    100,
    fishing_rod_basic:     200,
    fishing_rod_upgraded:  350,
    fishing_rod_super:     500,
    fishing_rod_legendary: 750,
};

const MAX_PICKAXE_DURABILITY = {
    pickaxe_wooden:    25,
    pickaxe_basic:     35,
    pickaxe_iron:      55,
    pickaxe_diamond:   80,
    pickaxe_netherite: 120,
};

const rapidGainLog = new Map();

async function sendAnticheatDM(userId, reason, walletBefore, bankBefore) {
    try {
        const channelRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
            method: 'POST',
            headers: { Authorization: `Bot ${process.env.TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: userId }),
        });
        const channel = await channelRes.json();
        if (!channel.id) return;

        await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bot ${process.env.TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: 'Anti-Cheat Activated',
                    description: `The anti-cheat has been activated for **${reason}**, your balance for wallet and bank was **$${Math.floor(walletBefore).toLocaleString()}** and **$${Math.floor(bankBefore).toLocaleString()}**, if this was a bad call from the Anti-Cheat talk to support to restore your balance\n\n\\* Economic Bomb Anti-Cheat Team`,
                    color: 0xff3333,
                }]
            }),
        });
    } catch {}
}

async function logFlag(userId, type, detail, severity, balBefore, bankBefore, balAfter, bankAfter, autoFixed) {
    try {
        await AnticheatLog.create({
            userId, type, detail, severity,
            balanceBefore: balBefore,
            bankBefore,
            balanceAfter: balAfter,
            bankAfter,
            autoFixed,
            dismissed: false,
            timestamp: Date.now(),
        });
    } catch {}
}

async function anticheat(client, userId) {
    const User = require('../models/user');
    const u = await User.findOne({ userId });
    if (!u) return;

    const balBefore = u.balance;
    const bankBefore = u.bank;
    let modified = false;
    let dmReason = null;

    if (isNaN(u.balance) || !isFinite(u.balance)) {
        await logFlag(userId, 'nan_balance', 'Wallet is NaN or Infinite', 'critical', balBefore, bankBefore, 0, u.bank, true);
        u.balance = 0;
        modified = true;
        dmReason = 'wallet value being NaN or Infinite';
    }

    if (isNaN(u.bank) || !isFinite(u.bank)) {
        await logFlag(userId, 'nan_bank', 'Bank is NaN or Infinite', 'critical', balBefore, bankBefore, u.balance, 0, true);
        u.bank = 0;
        modified = true;
        dmReason = dmReason || 'bank value being NaN or Infinite';
    }

    if (u.balance < 0) {
        await logFlag(userId, 'negative_wallet', `Wallet was $${u.balance.toLocaleString()}`, 'critical', balBefore, bankBefore, 0, u.bank, true);
        u.balance = 0;
        modified = true;
        dmReason = dmReason || 'negative wallet balance';
    }

    if (u.bank < 0) {
        await logFlag(userId, 'negative_bank', `Bank was $${u.bank.toLocaleString()}`, 'critical', balBefore, bankBefore, u.balance, 0, true);
        u.bank = 0;
        modified = true;
        dmReason = dmReason || 'negative bank balance';
    }

    if (u.balance + u.bank > MAX_BALANCE) {
        await logFlag(userId, 'max_balance', `Net worth $${(u.balance + u.bank).toLocaleString()} exceeded hard cap`, 'critical', balBefore, bankBefore, 0, 0, true);
        u.balance = 0;
        u.bank = 0;
        modified = true;
        dmReason = dmReason || 'exceeding the maximum possible balance';
    }

    if (u.balance + u.bank > MAX_NET_WORTH) {
        await logFlag(userId, 'high_net_worth', `Net worth $${(u.balance + u.bank).toLocaleString()} exceeds $100T threshold`, 'warning', balBefore, bankBefore, null, null, false);
    }

    if ((u.dailyStreak || 0) > MAX_DAILY_STREAK) {
        await logFlag(userId, 'impossible_streak', `Daily streak of ${u.dailyStreak} exceeds max possible (365)`, 'warning', balBefore, bankBefore, null, null, false);
    }

    const now = Date.now();
    const last = rapidGainLog.get(userId);
    if (last) {
        const timeDiff = now - last.ts;
        const gained = (u.balance + u.bank) - last.total;
        if (timeDiff < RAPID_GAIN_WINDOW && gained > RAPID_GAIN_AMOUNT) {
            await logFlag(userId, 'rapid_gain', `Gained $${gained.toLocaleString()} in ${Math.floor(timeDiff / 1000)}s`, 'warning', balBefore, bankBefore, null, null, false);
        }
    }
    rapidGainLog.set(userId, { ts: now, total: u.balance + u.bank });

    const rodItem = (u.inventory || []).find(i => i.item && i.item.startsWith('fishing_rod'));
    if (rodItem) {
        const maxDur = MAX_ROD_DURABILITY[rodItem.item];
        if (maxDur && u.fishRodDurability > maxDur) {
            await logFlag(userId, 'rod_durability', `Rod durability ${u.fishRodDurability} exceeds max ${maxDur} for ${rodItem.item}`, 'warning', balBefore, bankBefore, null, null, false);
        }
    }

    const pickaxeItem = (u.inventory || []).find(i => i.item && i.item.startsWith('pickaxe'));
    if (pickaxeItem) {
        const maxDur = MAX_PICKAXE_DURABILITY[pickaxeItem.item];
        if (maxDur && u.pickaxeDurability > maxDur) {
            await logFlag(userId, 'pickaxe_durability', `Pickaxe durability ${u.pickaxeDurability} exceeds max ${maxDur} for ${pickaxeItem.item}`, 'warning', balBefore, bankBefore, null, null, false);
        }
    }

    if (modified) {
        await u.save();
        if (dmReason) {
            await sendAnticheatDM(userId, dmReason, balBefore, bankBefore);
        }
    }
}

module.exports = { anticheat, MAX_BALANCE, rapidGainLog };
