const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { hasItem, consumeItem } = require('../../utils/inventory');
const { ITEMS, ROD_TIERS, BUCKET_TIERS } = require('../shop/items');
const cooldowns = require('../../utils/cooldowns');

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

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getTier(wealth) {
    let t = TIERS[0];
    for (const tier of TIERS) { if (wealth >= tier.min) t = tier; }
    return t;
}

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

function sellValue(user, bucket) {
    const raw = (user.fishBucket || []).reduce((t, e) => t + (CATCH_ITEMS[e.item]?.value ?? 0) * e.quantity, 0);
    return Math.floor(raw * (bucket?.sellMultiplier ?? 1));
}

function pickItem(loc, skip, useBait) {
    let table = [...TABLES[loc]].slice(skip);
    if (useBait && table.length > 1) table = table.map((e, i) => i === 0 ? [e[0], Math.floor(e[1] / 2)] : e);
    const total = table.reduce((a, e) => a + e[1], 0);
    let r = Math.random() * total;
    for (const [id, w] of table) { r -= w; if (r <= 0) return id; }
    return table[table.length - 1][0];
}

function footerText(rod, tier, user, bucket) {
    const dur  = rod ? `${rod.name} - ${user.fishRodDurability ?? 0} uses left` : '';
    const bkt  = bucket ? `${bucketCount(user)}/${bucket.slots} items` : '';
    return [dur, tier?.label, bkt].filter(Boolean).join('  ·  ');
}

function actionRow(user, bucket) {
    const sell = sellValue(user, bucket);
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('fish_again').setLabel('Fish Again').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('fish_sell').setLabel(sell > 0 ? `Sell All - $${formatNumber(sell)}` : 'Sell All').setStyle(ButtonStyle.Secondary).setDisabled(sell === 0),
    );
}

async function doCast(msg, interaction, user) {
    const rod    = getRod(user);
    const bucket = getBucket(user);
    if (!rod || !bucket) return;

    const now = Date.now();
    if (cooldowns.fish.has(`fish_${interaction.user.id}`)) {
        const exp = cooldowns.fish.get(`fish_${interaction.user.id}`) + COOLDOWN;
        if (now < exp) {
            const s = Math.ceil((exp - now) / 1000);
            await msg.edit({
                embeds: [new EmbedBuilder()
                    .setTitle('Fishing')
                    .setDescription(`Waiting **${s}s** before casting again.`)
                    .setColor(0x71717a)
                    .setFooter({ text: footerText(rod, getTier(user.balance + user.bank), user, bucket) })],
                components: [actionRow(user, bucket)],
            });
            return;
        }
    }

    const cnt = bucketCount(user);
    if (cnt >= bucket.slots) {
        await msg.edit({
            embeds: [new EmbedBuilder()
                .setTitle('Fishing')
                .setDescription(`Your **${bucket.name}** is full. Sell your catch before casting again.`)
                .setColor(0xff8800)
                .setFooter({ text: footerText(rod, getTier(user.balance + user.bank), user, bucket) })],
            components: [actionRow(user, bucket)],
        });
        return;
    }

    cooldowns.fish.set(`fish_${interaction.user.id}`, now);

    const tier   = getTier(user.balance + user.bank);
    const stats  = rod.stats;
    const useBait = consumeItem(user, 'fishing_bait');

    // Deduct durability
    user.fishRodDurability = Math.max(0, (user.fishRodDurability ?? rod.durability) - 1);
    const rodBroke = user.fishRodDurability === 0;
    if (rodBroke) user.inventory = (user.inventory || []).filter(i => i.item !== rod.id);
    if (useBait || rodBroke) await user.save();
    else await user.save();

    if (rodBroke) {
        await msg.edit({
            embeds: [new EmbedBuilder()
                .setTitle('Fishing')
                .setDescription(`Your **${rod.name}** broke on that cast. Buy a new one from \`/shop\`.`)
                .setColor(0xff4444)
                .setFooter({ text: `${tier.label}  ·  ${bucketCount(user)}/${bucket.slots} items` })],
            components: [actionRow(user, bucket)],
        });
        return;
    }

    const eventRoll = Math.random();
    const isBomb    = eventRoll < 0.02;
    const isNothing = !isBomb && eventRoll < 0.07;

    // Casting state
    await msg.edit({
        embeds: [new EmbedBuilder()
            .setTitle('Fishing')
            .setDescription(`Casting at the **${tier.label}**...`)
            .setColor(0x1a6b8a)
            .setFooter({ text: footerText(rod, tier, user, bucket) })],
        components: [],
    });

    await new Promise(r => setTimeout(r, rand(2000, 4500)));

    if (isNothing) {
        await msg.edit({
            embeds: [new EmbedBuilder()
                .setTitle('Fishing')
                .setDescription('Nothing this time.')
                .setColor(0x71717a)
                .setFooter({ text: footerText(rod, tier, user, bucket) })],
            components: [actionRow(user, bucket)],
        });
        attachActionCollector(msg, interaction, user);
        return;
    }

    // Show bite
    const biteRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('fish_reel').setLabel('Reel In').setStyle(ButtonStyle.Success),
        ...(isBomb ? [new ButtonBuilder().setCustomId('fish_cut').setLabel('Cut Line').setStyle(ButtonStyle.Danger)] : []),
    );

    await msg.edit({
        embeds: [new EmbedBuilder()
            .setTitle('Fishing')
            .setDescription(isBomb
                ? 'Something is pulling hard. Feels different from a normal fish.'
                : `Something's on the line at the **${tier.label}**.`)
            .setColor(isBomb ? 0xff8800 : 0xf4a100)
            .setFooter({ text: footerText(rod, tier, user, bucket) })],
        components: [biteRow],
    });

    const reelCollector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: rand(2500, 4000),
        max: 1,
    });

    let reeled = false;

    reelCollector.on('collect', async i => {
        reeled = true;
        await i.deferUpdate();

        if (i.customId === 'fish_cut') {
            await msg.edit({
                embeds: [new EmbedBuilder()
                    .setTitle('Fishing')
                    .setDescription('Line cut. Whatever was down there is gone.')
                    .setColor(0x71717a)
                    .setFooter({ text: footerText(rod, tier, user, bucket) })],
                components: [actionRow(user, bucket)],
            });
            attachActionCollector(msg, interaction, user);
            return;
        }

        // Reel in
        if (isBomb) {
            const bucket_ = user.fishBucket || [];
            const lost = [];
            const n = Math.min(rand(1, 3), bucket_.length);
            for (let k = 0; k < n; k++) {
                if (!bucket_.length) break;
                const idx = Math.floor(Math.random() * bucket_.length);
                const entry = bucket_[idx];
                const c = CATCH_ITEMS[entry.item];
                lost.push(`${c?.emoji ?? '📦'} ${c?.name ?? entry.item}`);
                entry.quantity--;
                if (entry.quantity <= 0) bucket_.splice(idx, 1);
            }
            user.fishBucket = bucket_;
            await user.save();
            await msg.edit({
                embeds: [new EmbedBuilder()
                    .setTitle('Fishing  -  Bomb')
                    .setDescription(lost.length
                        ? `It was a bomb.\n\n**Lost:**\n${lost.join('\n')}`
                        : 'It was a bomb. Your bucket was empty - lucky.')
                    .setColor(0xff4444)
                    .setFooter({ text: footerText(rod, tier, user, bucket) })],
                components: [actionRow(user, bucket)],
            });
            attachActionCollector(msg, interaction, user);
            return;
        }

        if (Math.random() < stats.snapChance) {
            await msg.edit({
                embeds: [new EmbedBuilder()
                    .setTitle('Fishing')
                    .setDescription('The line snapped.')
                    .setColor(0xff4444)
                    .setFooter({ text: footerText(rod, tier, user, bucket) })],
                components: [actionRow(user, bucket)],
            });
            attachActionCollector(msg, interaction, user);
            return;
        }

        // Catch
        let catchCount = 1;
        if (stats.multiChance > 0 && Math.random() < stats.multiChance) catchCount = stats.multiCount;
        catchCount = Math.min(catchCount, bucket.slots - cnt);

        const caught = [];
        for (let k = 0; k < catchCount; k++) {
            const id = pickItem(tier.loc, stats.skip, useBait && k === 0);
            caught.push(id);
            if (!user.fishBucket) user.fishBucket = [];
            const ex = user.fishBucket.find(e => e.item === id);
            if (ex) ex.quantity++;
            else user.fishBucket.push({ item: id, quantity: 1 });
        }
        await user.save();

        const isMonster = caught.some(id => CATCH_ITEMS[id]?.type === 'monster');
        const catchLines = caught.map(id => {
            const c = CATCH_ITEMS[id];
            return `${c.emoji}  **${c.name}**  ·  ~$${formatNumber(c.value)}`;
        }).join('\n');

        const newCount = bucketCount(user);
        const bucketFull = newCount >= bucket.slots;

        let title = 'Fishing';
        if (isMonster) title = 'Fishing  -  Monster Catch';
        else if (catchCount > 1) title = `Fishing  -  ${catchCount}x Catch`;

        await msg.edit({
            embeds: [new EmbedBuilder()
                .setTitle(title)
                .setDescription(
                    catchLines +
                    `\n\n${newCount}/${bucket.slots} items in bucket` +
                    (bucketFull ? '\nBucket full - sell before your next cast.' : '')
                )
                .setColor(isMonster ? 0xFFD700 : CATCH_ITEMS[caught[0]]?.type === 'junk' ? 0x888888 : 0x2ecc71)
                .setFooter({ text: footerText(rod, tier, user, bucket) })],
            components: [actionRow(user, bucket)],
        });
        attachActionCollector(msg, interaction, user);
    });

    reelCollector.on('end', async (_, reason) => {
        if (!reeled) {
            await msg.edit({
                embeds: [new EmbedBuilder()
                    .setTitle('Fishing')
                    .setDescription('Too slow - it got away.')
                    .setColor(0xff4444)
                    .setFooter({ text: footerText(rod, tier, user, bucket) })],
                components: [actionRow(user, bucket)],
            }).catch(() => {});
            attachActionCollector(msg, interaction, user);
        }
    });
}

function attachActionCollector(msg, interaction, user) {
    const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        idle: 120000,
        max: 1,
    });

    collector.on('collect', async i => {
        await i.deferUpdate();

        if (i.customId === 'fish_sell') {
            const bucket = getBucket(user);
            const mult   = bucket?.sellMultiplier ?? 1;
            const items  = [...(user.fishBucket || [])];
            const raw    = items.reduce((t, e) => t + (CATCH_ITEMS[e.item]?.value ?? 0) * e.quantity, 0);
            const total  = Math.floor(raw * mult);

            if (total === 0) {
                await msg.edit({ components: [actionRow(user, bucket)] });
                attachActionCollector(msg, interaction, user);
                return;
            }

            const lines = items
                .sort((a, b) => (CATCH_ITEMS[b.item]?.value ?? 0) - (CATCH_ITEMS[a.item]?.value ?? 0))
                .map(e => {
                    const c = CATCH_ITEMS[e.item];
                    return `${c?.emoji ?? '📦'}  ${c?.name ?? e.item} ×${e.quantity}  →  $${formatNumber((c?.value ?? 0) * e.quantity)}`;
                }).join('\n');

            user.fishBucket = [];
            user.balance = parseFloat((user.balance + total).toFixed(2));
            await user.save();

            const multLine = mult > 1 ? `\n*${bucket.name} bonus: ×${mult}*` : '';
            await msg.edit({
                embeds: [new EmbedBuilder()
                    .setTitle('Fishing  -  Sold')
                    .setDescription(`${lines}\n\n**Total  $${formatNumber(total)}**${multLine}`)
                    .setColor(0xFFD700)
                    .setFooter({ text: `New balance: $${formatNumber(user.balance)}` })],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('fish_again').setLabel('Fish Again').setStyle(ButtonStyle.Primary),
                )],
            });
            attachActionCollector(msg, interaction, user);

        } else if (i.customId === 'fish_again') {
            await doCast(msg, interaction, user);
        }
    });

    collector.on('end', (_, reason) => {
        if (reason === 'idle') {
            msg.edit({ components: [] }).catch(() => {});
        }
    });
}

async function execute(interaction, user) {
    const rod    = getRod(user);
    const bucket = getBucket(user);

    if (!rod)
        return interaction.reply({ content: 'You need a fishing rod. Pick one up from `/shop`.', ephemeral: true });
    if (!bucket)
        return interaction.reply({ content: 'You need a bucket to store your catch. Start with a Wooden Bucket ($100) from `/shop`.', ephemeral: true });

    const tier = getTier(user.balance + user.bank);

    const msg = await interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle('Fishing')
            .setDescription(`Casting at the **${tier.label}**...`)
            .setColor(0x1a6b8a)
            .setFooter({ text: footerText(rod, tier, user, bucket) })],
        fetchReply: true,
    });

    await doCast(msg, interaction, user);
}

module.exports = { execute, TIERS, COOLDOWN, CATCH_ITEMS };
