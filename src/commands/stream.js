const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../utils/economy');
const { formatNumber } = require('../utils/format');
const cooldowns = require('../utils/cooldowns');

const COOLDOWN = 45 * 60 * 1000;
const MAX_SEGMENTS = 20;

const CATEGORIES = {
    fps:     { label: 'FPS Gaming',  baseMin: 20,  baseMax: 80,  growthMin: 0.05, growthMax: 0.20, eventChance: 0.20 },
    rpg:     { label: 'RPG Gaming',  baseMin: 10,  baseMax: 50,  growthMin: 0.08, growthMax: 0.25, eventChance: 0.18 },
    music:   { label: 'Music',       baseMin: 5,   baseMax: 30,  growthMin: 0.03, growthMax: 0.15, eventChance: 0.15 },
    variety: { label: 'Variety',     baseMin: 10,  baseMax: 100, growthMin: 0,    growthMax: 0.35, eventChance: 0.22 },
    irl:     { label: 'IRL',         baseMin: 25,  baseMax: 120, growthMin: 0.10, growthMax: 0.30, eventChance: 0.30 },
};

const EVENTS = [
    { id: 'raid',  weight: 15, label: 'Incoming Raid!',            fn: v => v + Math.floor(Math.random() * 1500 + 200) },
    { id: 'viral', weight: 5,  label: 'A clip went viral!',        fn: v => Math.floor(v * (1.5 + Math.random() * 1.5)) },
    { id: 'tech',  weight: 20, label: 'Technical difficulties...',  fn: v => v },
    { id: 'drama', weight: 12, label: 'Drama in chat...',           fn: v => Math.floor(v * (0.55 + Math.random() * 0.15)) },
    { id: 'isp',   weight: 6,  label: 'ISP outage!',               fn: () => -1 },
];

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollEvent(chance) {
    if (Math.random() > chance) return null;
    const total = EVENTS.reduce((a, e) => a + e.weight, 0);
    let r = Math.random() * total;
    for (const e of EVENTS) {
        r -= e.weight;
        if (r <= 0) return e;
    }
    return EVENTS[EVENTS.length - 1];
}

function calcPayout(viewers) {
    return Math.floor(viewers * 1.5);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stream')
        .setDescription('Start a livestream and earn from your viewer count')
        .addStringOption(o =>
            o.setName('category').setDescription('What to stream').setRequired(true)
                .addChoices(
                    { name: 'FPS Gaming',  value: 'fps'     },
                    { name: 'RPG Gaming',  value: 'rpg'     },
                    { name: 'Music',       value: 'music'   },
                    { name: 'Variety',     value: 'variety' },
                    { name: 'IRL',         value: 'irl'     },
                )
        ),

    async execute(interaction) {
        const cat = interaction.options.getString('category');
        const now = Date.now();

        if (cooldowns.stream.has(interaction.user.id)) {
            const exp = cooldowns.stream.get(interaction.user.id) + COOLDOWN;
            if (now < exp) {
                const totalSecs = Math.ceil((exp - now) / 1000);
                const m = Math.floor(totalSecs / 60), s = totalSecs % 60;
                return interaction.reply({ content: `⏳ You need to rest before streaming again. Try in **${m}m ${s}s**.`, ephemeral: true });
            }
        }
        cooldowns.stream.set(interaction.user.id, now);

        const config   = CATEGORIES[cat];
        let viewers    = rand(config.baseMin, config.baseMax);
        let segment    = 0;
        let lastEvent  = null;
        let ended      = false;

        const payout = () => calcPayout(viewers);

        const streamEmbed = () => {
            const lines = [
                `**${formatNumber(viewers)}** viewers watching`,
                `Payout if you stop now: **$${formatNumber(payout())}**`,
                segment > 0 ? `Segment ${segment}/${MAX_SEGMENTS}` : null,
                lastEvent ? `\n*${lastEvent.label}*` : null,
            ].filter(Boolean).join('\n');

            return new EmbedBuilder()
                .setTitle(`Streaming - ${config.label}`)
                .setDescription(lines)
                .setColor(viewers >= 1000 ? 0x9b59b6 : viewers >= 200 ? 0x6441a5 : 0x4a3281);
        };

        const streamButtons = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('stream_next').setLabel('Keep Streaming').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('stream_end').setLabel(`Cash Out ($${formatNumber(payout())})`).setStyle(ButtonStyle.Success),
        );

        const msg = await interaction.reply({ embeds: [streamEmbed()], components: [streamButtons()], fetchReply: true });

        const collector = msg.createMessageComponentCollector({
            filter: j => j.user.id === interaction.user.id,
            time: 600000,
        });

        const finish = async (j = null) => {
            ended = true;
            collector.stop('done');
            const earnings = payout();
            const user = await getUser(interaction.user.id, interaction.guild.id);
            user.balance = parseFloat((user.balance + earnings).toFixed(2));
            await user.save();
            const embed = new EmbedBuilder()
                .setTitle(`Stream Ended - ${config.label}`)
                .setDescription(`**${formatNumber(viewers)}** viewers | **${segment}** segments streamed\nYou earned **$${formatNumber(earnings)}**!`)
                .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true })
                .setColor(0x00cc44);
            if (j) await j.update({ embeds: [embed], components: [] });
            else await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
        };

        collector.on('collect', async j => {
            if (ended) return;
            if (j.customId === 'stream_end') { await finish(j); return; }
            if (j.customId !== 'stream_next') return;

            segment++;
            const event = rollEvent(config.eventChance);
            lastEvent = event ?? null;

            if (event) {
                const next = event.fn(viewers);
                if (next === -1) {
                    ended = true;
                    collector.stop('done');
                    const earnings = payout();
                    const user = await getUser(interaction.user.id, interaction.guild.id);
                    user.balance = parseFloat((user.balance + earnings).toFixed(2));
                    await user.save();
                    return j.update({
                        embeds: [new EmbedBuilder()
                            .setTitle('Stream Ended - ISP Outage')
                            .setDescription(`Your internet cut out with **${formatNumber(viewers)}** viewers.\nYou earned **$${formatNumber(earnings)}** before it happened.`)
                            .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true })
                            .setColor(0xff3333)],
                        components: [],
                    });
                }
                viewers = Math.max(1, next);
            } else {
                const rate = config.growthMin + Math.random() * (config.growthMax - config.growthMin);
                viewers = Math.max(1, Math.floor(viewers * (1 + rate)));
            }

            if (segment >= MAX_SEGMENTS) { await finish(j); return; }

            await j.update({ embeds: [streamEmbed()], components: [streamButtons()] });
        });

        collector.on('end', async (_, reason) => {
            if (!ended) await finish();
        });
    }
};
