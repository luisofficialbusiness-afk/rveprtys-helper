const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { hasItem, consumeItem } = require('../../utils/inventory');
const { ITEMS, ROD_TIERS, BUCKET_TIERS } = require('../shop/items');
const cooldowns = require('../../utils/cooldowns');
const FishMarket = require('../../models/fishmarket');

const COOLDOWN = 10 * 1000;

const CATCH_ITEMS = {
    junk_boot:     { name: 'Old Boot',     emoji: '👢', value: 8,      type: 'junk'    },
    junk_can:      { name: 'Tin Can',      emoji: '🥫', value: 12,     type: 'junk'    },
    junk_seaweed:  { name: 'Seaweed',      emoji: '🌿', value: 5,      type: 'junk'    },
    fish_minnow:   { name: 'Minnow',       emoji: '🐟', value: 60,     type: 'fish'    },
    fish_perch:    { name: 'Perch',        emoji: '🐠', value: 180,    type: 'fish'    },
    fish_bass:     { name: 'Bass',         emoji: '🐡', value: 500,    type: 'fish'    },
    fish_trout:    { name: 'Trout',        emoji: '🐟', value: 1200,   type: 'fish'    },
    fish_salmon:   { name: 'Salmon',       emoji: '🐠', value: 3000,   type: 'fish'    },
    fish_tuna:     { name: 'Tuna',         emoji: '🐡', value: 8000,   type: 'fish'    },
    fish_swordfish:{ name: 'Swordfish',    emoji: '🐬', value: 22000,  type: 'fish'    },
    fish_shark:    { name: 'Shark',        emoji: '🦈', value: 65000,  type: 'fish'    },
    fish_monster:  { name: 'Monster Fish', emoji: '🐉', value: 250000, type: 'monster' },
};

const TABLES = {
    pond:    [['junk_boot',8],['junk_can',10],['junk_seaweed',7],['fish_minnow',40],['fish_perch',22],['fish_bass',10],['fish_trout',2],['fish_monster',0.3]],
    river:   [['junk_can',5],['junk_seaweed',4],['fish_minnow',15],['fish_perch',25],['fish_bass',25],['fish_trout',18],['fish_salmon',6],['fish_monster',0.5]],
    ocean:   [['junk_boot',2],['fish_bass',8],['fish_trout',15],['fish_salmon',22],['fish_tuna',28],['fish_swordfish',18],['fish_shark',5],['fish_monster',1]],
    deepsea: [['fish_salmon',8],['fish_tuna',18],['fish_swordfish',25],['fish_shark',28],['fish_monster',3]],
};

const TIERS = [
    { min: 0,      loc: 'pond',    label: 'Pond'     },
    { min: 10000,  loc: 'river',   label: 'River'    },
    { min: 50000,  loc: 'ocean',   label: 'Ocean'    },
    { min: 200000, loc: 'deepsea', label: 'Deep Sea' },
];

const ROD_STATS = {
    fishing_rod_wooden:   { skip: 0, snapChance: 0.08,  multiChance: 0,    multiCount: 1 },
    fishing_rod_basic:    { skip: 1, snapChance: 0.04,  multiChance: 0,    multiCount: 1 },
    fishing_rod_upgraded: { skip: 2, snapChance: 0.02,  multiChance: 0.15, multiCount: 2 },
    fishing_rod_super:    { skip: 3, snapChance: 0.005, multiChance: 0.25, multiCount: 3 },
};

// Dynamic NPC pricing based on recent server sales
async function getNpcPrice(guildId, fishType, baseValue) {
    try {
        let market = await FishMarket.findOne({ guildId, fishType });
        if (!market) return baseValue;
        if (Date.now() - market.lastReset > 24 * 60 * 60 * 1000) {
            market.soldLast24h = 0;
            market.lastReset   = new Date();
            await market.save();
            return baseValue;
        }
        // Every 10 fish sold drops price by ~8%, floored at 20% of base
        const mult = Math.max(0.20, 1 - market.soldLast24h * 0.008);
        return Math.floor(baseValue * mult);
    } catch { return baseValue; }
}

async function recordSales(guildId, bucket) {
    for (const entry of bucket) {
        if (entry.item.startsWith('junk_') || !CATCH_ITEMS[entry.item]) continue;
        await FishMarket.findOneAndUpdate(
            { guildId, fishType: entry.item },
            { $inc: { soldLast24h: entry.quantity }, $setOnInsert: { lastReset: new Date() } },
            { upsert: true }
        );
    }
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function getTier(w)      { let t = TIERS[0]; for (const x of TIERS) { if (w >= x.min) t = x; } return t; }

function getRod(user) {
    for (let i = ROD_TIERS.length - 1; i >= 0; i--) {
        const id = ROD_TIERS[i];
        if (hasItem(user, id)) return { id, ...ITEMS[id], stats: ROD_STATS[id] };
    }
    return null;
}

function getBucket(user) {
    for (let i = BUCKET_TIERS.length - 1; i >= 0; i--) {
        const id = BUCKET_TIERS[i];
        if (hasItem(user, id)) return { id, ...ITEMS[id] };
    }
    return null;
}

function bucketCount(user) {
    return (user.fishBucket || []).reduce((a, i) => a + i.quantity, 0);
}

async function calcSellTotal(guildId, fishBucket, bucketMult) {
    let total = 0;
    for (const entry of (fishBucket || [])) {
        const base  = CATCH_ITEMS[entry.item]?.value ?? 0;
        const price = await getNpcPrice(guildId, entry.item, base);
        total += price * entry.quantity;
    }
    return Math.floor(total * bucketMult);
}

function pickItem(loc, skip, useBait) {
    let table = [...TABLES[loc]].slice(skip);
    if (useBait && table.length > 1) table = table.map((e, i) => i === 0 ? [e[0], Math.floor(e[1] / 2)] : e);
    const total = table.reduce((a, e) => a + e[1], 0);
    let r = Math.random() * total;
    for (const [id, w] of table) { r -= w; if (r <= 0) return id; }
    return table[table.length - 1][0];
}

// Components V2 message builder
function buildMessage(title, body, footer, buttons) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));

    if (footer) {
        container
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
    }

    if (buttons?.length) {
        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(...buttons)
        );
    }

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

function statusFooter(rod, tier, user, bucket) {
    const uses = user.fishRodDurability ?? 0;
    const cnt  = bucketCount(user);
    return `${tier.label}  ·  ${rod.name} ${uses} uses left  ·  ${cnt}/${bucket.slots} in bucket`;
}

function actionButtons(sellTotal) {
    return [
        new ButtonBuilder().setCustomId('fish_again').setLabel('Fish Again').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('fish_sell')
            .setLabel(sellTotal > 0 ? `Sell All  $${formatNumber(sellTotal)}` : 'Sell All')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(sellTotal === 0),
    ];
}

async function doCast(msg, interaction, user) {
    const rod    = getRod(user);
    const bucket = getBucket(user);
    if (!rod || !bucket) return;

    const tier      = getTier(user.balance + user.bank);
    const sellTotal = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);
    const footer    = statusFooter(rod, tier, user, bucket);

    const now = Date.now();
    if (cooldowns.fish.has(`fish_${interaction.user.id}`)) {
        const exp = cooldowns.fish.get(`fish_${interaction.user.id}`) + COOLDOWN;
        if (now < exp) {
            const s = Math.ceil((exp - now) / 1000);
            await msg.edit(buildMessage('Fishing', `Cooldown active. Cast again in **${s}s**.`, footer, actionButtons(sellTotal)));
            attachActionCollector(msg, interaction, user);
            return;
        }
    }

    const cnt = bucketCount(user);
    if (cnt >= bucket.slots) {
        await msg.edit(buildMessage('Fishing', `Your **${bucket.name}** is full. Sell your catch before casting again.`, footer, actionButtons(sellTotal)));
        attachActionCollector(msg, interaction, user);
        return;
    }

    cooldowns.fish.set(`fish_${interaction.user.id}`, now);

    const useBait = consumeItem(user, 'fishing_bait');
    user.fishRodDurability = Math.max(0, (user.fishRodDurability ?? rod.durability) - 1);
    const rodBroke = user.fishRodDurability === 0;
    if (rodBroke) user.inventory = (user.inventory || []).filter(i => i.item !== rod.id);
    await user.save();

    if (rodBroke) {
        await msg.edit(buildMessage('Fishing', `Your **${rod.name}** broke. Pick up a new one from \`/shop\`.`, footer, actionButtons(sellTotal)));
        attachActionCollector(msg, interaction, user);
        return;
    }

    const roll    = Math.random();
    const isBomb  = roll < 0.02;
    const nothing = !isBomb && roll < 0.07;

    await msg.edit(buildMessage('Fishing', `Casting at the **${tier.label}**...`, footer));
    await new Promise(r => setTimeout(r, rand(2000, 4500)));

    if (nothing) {
        await msg.edit(buildMessage('Fishing', 'Nothing on the line.', footer, actionButtons(sellTotal)));
        attachActionCollector(msg, interaction, user);
        return;
    }

    const biteButtons = [
        new ButtonBuilder().setCustomId('fish_reel').setLabel('Reel In').setStyle(ButtonStyle.Success),
        ...(isBomb ? [new ButtonBuilder().setCustomId('fish_cut').setLabel('Cut Line').setStyle(ButtonStyle.Danger)] : []),
    ];

    const biteText = isBomb
        ? 'Something is pulling hard. Feels different from a normal fish.'
        : `Something on the line at the **${tier.label}**.`;

    await msg.edit(buildMessage('Fishing', biteText, footer, biteButtons));

    const reelCollector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: rand(2500, 4000),
        max: 1,
    });

    let reeled = false;

    reelCollector.on('collect', async i => {
        reeled = true;
        await i.deferUpdate();

        const newSellTotal = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);

        if (i.customId === 'fish_cut') {
            await msg.edit(buildMessage('Fishing', 'Line cut.', footer, actionButtons(newSellTotal)));
            attachActionCollector(msg, interaction, user);
            return;
        }

        if (isBomb) {
            const bucket_ = user.fishBucket || [];
            const lost    = [];
            const n       = Math.min(rand(1, 3), bucket_.length);
            for (let k = 0; k < n; k++) {
                if (!bucket_.length) break;
                const idx = Math.floor(Math.random() * bucket_.length);
                const e   = bucket_[idx];
                const c   = CATCH_ITEMS[e.item];
                lost.push(`${c?.emoji ?? ''} ${c?.name ?? e.item}`);
                e.quantity--;
                if (e.quantity <= 0) bucket_.splice(idx, 1);
            }
            user.fishBucket = bucket_;
            await user.save();
            const afterSell = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);
            const body = lost.length ? `Bomb.\n\nLost:\n${lost.join('\n')}` : 'Bomb. Your bucket was empty.';
            await msg.edit(buildMessage('Fishing', body, statusFooter(rod, tier, user, bucket), actionButtons(afterSell)));
            attachActionCollector(msg, interaction, user);
            return;
        }

        if (Math.random() < rod.stats.snapChance) {
            await msg.edit(buildMessage('Fishing', 'Line snapped.', footer, actionButtons(newSellTotal)));
            attachActionCollector(msg, interaction, user);
            return;
        }

        let catchCount = 1;
        if (rod.stats.multiChance > 0 && Math.random() < rod.stats.multiChance) catchCount = rod.stats.multiCount;
        catchCount = Math.min(catchCount, bucket.slots - cnt);

        const caught = [];
        for (let k = 0; k < catchCount; k++) {
            const id = pickItem(tier.loc, rod.stats.skip, useBait && k === 0);
            caught.push(id);
            if (!user.fishBucket) user.fishBucket = [];
            const ex = user.fishBucket.find(e => e.item === id);
            if (ex) ex.quantity++;
            else user.fishBucket.push({ item: id, quantity: 1 });
        }
        await user.save();

        const newCount    = bucketCount(user);
        const isMonster   = caught.some(id => CATCH_ITEMS[id]?.type === 'monster');
        const afterSell   = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);

        const lines = await Promise.all(caught.map(async id => {
            const c     = CATCH_ITEMS[id];
            const price = await getNpcPrice(interaction.guild.id, id, c.value);
            return `${c.emoji} **${c.name}**  ·  $${formatNumber(price)}`;
        }));

        const bucketFull = newCount >= bucket.slots;
        const title      = isMonster ? 'Fishing  -  Monster Catch' : catchCount > 1 ? `Fishing  -  ${catchCount}x Catch` : 'Fishing';
        const body       = lines.join('\n') + `\n\n${newCount}/${bucket.slots} in bucket` + (bucketFull ? '\nBucket full. Sell before casting again.' : '');

        await msg.edit(buildMessage(title, body, statusFooter(rod, tier, user, bucket), actionButtons(afterSell)));
        attachActionCollector(msg, interaction, user);
    });

    reelCollector.on('end', async (_, reason) => {
        if (!reeled) {
            const newSellTotal = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);
            await msg.edit(buildMessage('Fishing', 'Too slow.', footer, actionButtons(newSellTotal))).catch(() => {});
            attachActionCollector(msg, interaction, user);
        }
    });
}

function attachActionCollector(msg, interaction, user) {
    const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        idle: 600000,
        max: 1,
    });

    collector.on('collect', async i => {
        await i.deferUpdate();

        if (i.customId === 'fish_sell') {
            const bucket = getBucket(user);
            const mult   = bucket?.sellMultiplier ?? 1;
            const items  = [...(user.fishBucket || [])];
            if (!items.length) { attachActionCollector(msg, interaction, user); return; }

            const rows = await Promise.all(
                items
                    .sort((a, b) => (CATCH_ITEMS[b.item]?.value ?? 0) - (CATCH_ITEMS[a.item]?.value ?? 0))
                    .map(async e => {
                        const c     = CATCH_ITEMS[e.item];
                        const price = await getNpcPrice(interaction.guild.id, e.item, c?.value ?? 0);
                        const line  = price * e.quantity;
                        return `${c?.emoji ?? ''} ${c?.name ?? e.item} x${e.quantity}  $${formatNumber(line)}`;
                    })
            );

            const raw   = items.reduce(async (tacc, e) => {
                const t = await tacc;
                const price = await getNpcPrice(interaction.guild.id, e.item, CATCH_ITEMS[e.item]?.value ?? 0);
                return t + price * e.quantity;
            }, Promise.resolve(0));
            const total = Math.floor((await raw) * mult);

            await recordSales(interaction.guild.id, items);
            user.fishBucket = [];
            user.balance    = parseFloat((user.balance + total).toFixed(2));
            await user.save();

            const multLine = mult > 1 ? `\n-# ${bucket.name} bonus: x${mult}` : '';
            const body     = rows.join('\n') + `\n\n**Total  $${formatNumber(total)}**${multLine}`;

            const fishAgainBtn = [new ButtonBuilder().setCustomId('fish_again').setLabel('Fish Again').setStyle(ButtonStyle.Primary)];
            await msg.edit(buildMessage('Fishing  -  Sold', body, `New balance: $${formatNumber(user.balance)}`, fishAgainBtn));
            attachActionCollector(msg, interaction, user);

        } else if (i.customId === 'fish_again') {
            await doCast(msg, interaction, user);
        }
    });

    collector.on('end', (_, reason) => {
        if (reason === 'idle') {
            msg.edit(buildMessage('Fishing', 'Session expired. Run `/fish` to start again.', null, [])).catch(() => {});
        }
    });
}

async function execute(interaction, user) {
    const rod    = getRod(user);
    const bucket = getBucket(user);

    if (!rod)    return interaction.reply({ content: 'You need a fishing rod. Pick one up from `/shop`.', ephemeral: true });
    if (!bucket) return interaction.reply({ content: 'You need a bucket to store your catch. Start with a Wooden Bucket ($100) from `/shop`.', ephemeral: true });

    const tier      = getTier(user.balance + user.bank);
    const sellTotal = await calcSellTotal(interaction.guild.id, user.fishBucket, bucket.sellMultiplier ?? 1);
    const footer    = statusFooter(rod, tier, user, bucket);

    const msg = await interaction.reply({
        ...buildMessage('Fishing', `Casting at the **${tier.label}**...`, footer),
        fetchReply: true,
    });

    await doCast(msg, interaction, user);
}

module.exports = { execute, TIERS, COOLDOWN, CATCH_ITEMS };
