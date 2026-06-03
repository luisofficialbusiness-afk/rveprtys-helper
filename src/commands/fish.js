const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../utils/economy');
const { formatNumber } = require('../utils/format');
const cooldowns = require('../utils/cooldowns');

const COOLDOWNS = {
    pond:    5  * 60 * 1000,
    river:   15 * 60 * 1000,
    ocean:   30 * 60 * 1000,
    deepsea: 60 * 60 * 1000,
};

const LOCATIONS = {
    pond:    'Pond',
    river:   'River',
    ocean:   'Ocean',
    deepsea: 'Deep Sea',
};

// [name, minValue, maxValue, weight]
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Go fishing')
        .addStringOption(o =>
            o.setName('location').setDescription('Where to fish').setRequired(true)
                .addChoices(
                    { name: 'Pond (5 min cooldown)',     value: 'pond'    },
                    { name: 'River (15 min cooldown)',   value: 'river'   },
                    { name: 'Ocean (30 min cooldown)',   value: 'ocean'   },
                    { name: 'Deep Sea (1 hr cooldown)',  value: 'deepsea' },
                )
        ),

    async execute(interaction) {
        const loc   = interaction.options.getString('location');
        const now   = Date.now();
        const cdKey = `${interaction.user.id}-${loc}`;

        if (cooldowns.fish.has(cdKey)) {
            const exp = cooldowns.fish.get(cdKey) + COOLDOWNS[loc];
            if (now < exp) {
                const totalSecs = Math.ceil((exp - now) / 1000);
                const m = Math.floor(totalSecs / 60), s = totalSecs % 60;
                return interaction.reply({ content: `⏳ Already fished here recently. Try again in **${m}m ${s}s**.`, ephemeral: true });
            }
        }
        cooldowns.fish.set(cdKey, now);

        const label = LOCATIONS[loc];

        const msg = await interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🎣 Fishing')
                .setDescription(`Casting your line at the **${label}**...\n\nWaiting for a bite.`)
                .setColor(0x1e3a5f)],
            fetchReply: true,
        });

        await new Promise(r => setTimeout(r, rand(3000, 8000)));

        await msg.edit({
            embeds: [new EmbedBuilder()
                .setTitle('🎣 Fish On!')
                .setDescription(`Something is pulling the line at the **${label}**!\n\nReel it in before it escapes!`)
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
            const fish  = pickFish(loc);
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

            const user = await getUser(interaction.user.id, interaction.guild.id);
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
                        .setDescription(`You were too slow - the fish escaped at the **${label}**.`)
                        .setColor(0xff3333)],
                    components: [],
                }).catch(() => {});
            }
        });
    }
};
