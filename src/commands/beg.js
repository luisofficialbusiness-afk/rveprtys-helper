const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');
const cooldowns = require('../utils/cooldowns');

const { formatNumber } = require('../utils/format');

const COOLDOWN = 10 * 60 * 1000;

const OUTCOMES = [
    { chance: 0.10, amount: 0, msg: 'Everyone walked past without a second glance.' },
    { chance: 0.25, amount: null, range: [10, 30], msg: 'A kid tossed you their leftover lunch money.' },
    { chance: 0.25, amount: null, range: [30, 80], msg: 'A kind stranger stopped and handed you some cash.' },
    { chance: 0.20, amount: null, range: [80, 150], msg: 'A generous person felt sorry for you.' },
    { chance: 0.12, amount: null, range: [150, 300], msg: 'Someone handed you a thick envelope.' },
    { chance: 0.08, amount: null, range: [300, 600], msg: 'A wealthy passerby took pity and was very generous.' },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('beg')
        .setDescription('Beg for money from strangers'),

    async execute(interaction) {
        const now = Date.now();

        if (cooldowns.beg.has(interaction.user.id)) {
            const exp = cooldowns.beg.get(interaction.user.id) + COOLDOWN;
            if (now < exp) {
                const left = exp - now;
                const m = Math.floor(left / 60000), s = Math.ceil((left % 60000) / 1000);
                return interaction.reply({ content: `⏳ People are tired of seeing you beg. Try again in **${m}m ${s}s**.`, ephemeral: true });
            }
        }
        cooldowns.beg.set(interaction.user.id, now);

        const user = await getUser(interaction.user.id, interaction.guild.id);

        let roll = Math.random();
        let outcome = OUTCOMES[OUTCOMES.length - 1];
        for (const o of OUTCOMES) {
            if (roll < o.chance) { outcome = o; break; }
            roll -= o.chance;
        }

        const amount = outcome.amount !== null
            ? outcome.amount
            : Math.floor(Math.random() * (outcome.range[1] - outcome.range[0] + 1)) + outcome.range[0];

        if (amount > 0) {
            user.balance = parseFloat((user.balance + amount).toFixed(2));
            await user.save();
        }

        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle(amount > 0 ? '🙏 Someone Helped' : '😔 No Luck')
                .setDescription(outcome.msg + (amount > 0 ? ` **+$${formatNumber(amount)}**` : ''))
                .addFields(amount > 0 ? [{ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true }] : [])
                .setColor(amount > 0 ? 0x00cc44 : 0x71717a)
                .setFooter({ text: 'Cooldown: 10 minutes' })]
        });
    }
};
