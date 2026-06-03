const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatNumber } = require('../../utils/format');
const cooldowns = require('../../utils/cooldowns');

const COOLDOWN = 20 * 60 * 1000;

const TIERS = [
    { min: 0,       label: 'Pond',     location: 'pond'    },
    { min: 10000,   label: 'River',    location: 'river'   },
    { min: 50000,   label: 'Ocean',    location: 'ocean'   },
    { min: 200000,  label: 'Deep Sea', location: 'deepsea' },
];

const FISH = {
    pond: [
        ['a soggy boot',  0,      0,      10],
        ['a minnow',      30,     100,    35],
        ['a perch',       150,    400,    30],
        ['a bass',        500,    1000,   20],
        ['a trophy bass', 2000,   5000,   5],
    ],
    river: [
        ['a minnow',   30,     100,    10],
        ['a perch',    150,    400,    20],
        ['a bass',     500,    1000,   25],
        ['a trout',    1200,   2800,   25],
        ['a salmon',   3000,   7000,   15],
        ['a catfish',  8000,   15000,  5],
    ],
    ocean: [
        ['a bass',      500,    1000,   10],
        ['a trout',     1200,   2800,   15],
        ['a salmon',    3000,   7000,   20],
        ['a tuna',      8000,   18000,  25],
        ['a swordfish', 20000,  45000,  20],
        ['a shark',     50000,  120000, 10],
    ],
    deepsea: [
        ['a salmon',    3000,   7000,   10],
        ['a tuna',      8000,   18000,  15],
        ['a swordfish', 20000,  45000,  20],
        ['a shark',     50000,  120000, 25],
        ['a marlin',    130000, 280000, 20],
        ['an oarfish',  300000, 750000, 10],
    ],
};

function getTier(totalWealth) {
    let tier = TIERS[0];
    for (const t of TIERS) {
        if (totalWealth >= t.min) tier = t;
    }
    return tier;
}

function pickFish(loc) {
    const table = FISH[loc];
    const total = table.reduce((a, f) => a + f[3], 0);
    let r = Math.random() * total;
    for (const fish of table) {
        r -= fish[3];
        if (r <= 0) return fish;
    }
    return table[table.length - 1];
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function execute(interaction, user) {
    const cdKey = `fish_${interaction.user.id}`;
    const now   = Date.now();

    if (cooldowns.fish.has(cdKey)) {
        const exp = cooldowns.fish.get(cdKey) + COOLDOWN;
        if (now < exp) {
            const totalSecs = Math.ceil((exp - now) / 1000);
            const m = Math.floor(totalSecs / 60), s = totalSecs % 60;
            return interaction.reply({ content: `⏳ Your fishing gear needs to dry out. Try again in **${m}m ${s}s**.`, ephemeral: true });
        }
    }
    cooldowns.fish.set(cdKey, now);

    const totalWealth = user.balance + user.bank;
    const tier        = getTier(totalWealth);
    const nextTier    = TIERS[TIERS.indexOf(tier) + 1];

    const msg = await interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle('🎣 Fishing')
            .setDescription(
                `Casting your line at the **${tier.label}**...\n\nWaiting for a bite.` +
                (nextTier ? `\n\n*Unlock **${nextTier.label}** at $${formatNumber(nextTier.min)} total wealth*` : '')
            )
            .setColor(0x1e3a5f)],
        fetchReply: true,
    });

    await new Promise(r => setTimeout(r, rand(3000, 8000)));

    await msg.edit({
        embeds: [new EmbedBuilder()
            .setTitle('🎣 Fish On!')
            .setDescription(`Something is pulling the line at the **${tier.label}**!\n\nReel it in before it escapes!`)
            .setColor(0xf6ad55)],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('fish_reel').setLabel('Reel In').setStyle(ButtonStyle.Primary)
        )],
    });

    const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: rand(3000, 5000),
        max: 1,
    });

    let reeled = false;

    collector.on('collect', async i => {
        reeled = true;
        const fish  = pickFish(tier.location);
        const value = rand(fish[1], fish[2]);

        if (value === 0) {
            return i.update({
                embeds: [new EmbedBuilder()
                    .setTitle('🎣 What a catch...')
                    .setDescription(`You reeled in **${fish[0]}**. Absolutely worthless.`)
                    .setColor(0x71717a)],
                components: [],
            });
        }

        user.balance = parseFloat((user.balance + value).toFixed(2));
        await user.save();

        return i.update({
            embeds: [new EmbedBuilder()
                .setTitle('🎣 Nice catch!')
                .setDescription(`You reeled in **${fish[0]}** worth **$${formatNumber(value)}**!`)
                .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true })
                .setColor(0x00cc44)],
            components: [],
        });
    });

    collector.on('end', async (_, reason) => {
        if (!reeled) {
            await msg.edit({
                embeds: [new EmbedBuilder()
                    .setTitle('🎣 It got away!')
                    .setDescription(`You were too slow - the fish escaped at the **${tier.label}**.`)
                    .setColor(0xff3333)],
                components: [],
            }).catch(() => {});
        }
    });
}

module.exports = { execute, TIERS, COOLDOWN };
