const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, anticheat } = require('../utils/economy');
const cooldowns = require('../utils/cooldowns');

const COOLDOWN = 5 * 60 * 1000;
const SYMBOLS  = ['🍒', '🍋', '🍉', '⭐', '💎', '🍀'];
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Spin the slots')
        .addIntegerOption(option =>
            option.setName('bet').setDescription('Amount to bet').setRequired(true)
        ),

    async execute(interaction) {
        const bet = interaction.options.getInteger('bet');
        const now = Date.now();

        if (cooldowns.slots.has(interaction.user.id)) {
            const exp = cooldowns.slots.get(interaction.user.id) + COOLDOWN;
            if (now < exp) {
                const left = exp - now;
                const m = Math.floor(left / 60000), s = Math.ceil((left % 60000) / 1000);
                return interaction.reply({ content: `⏳ Cooldown active. Try again in **${m > 0 ? `${m}m ${s}s` : `${s}s`}**.`, ephemeral: true });
            }
        }
        cooldowns.slots.set(interaction.user.id, now);

        const user = await getUser(interaction.user.id, interaction.guild.id);
        if (!bet || bet <= 0 || user.balance < bet)
            return interaction.reply({ content: '❌ Invalid bet or insufficient balance.', ephemeral: true });

        user.balance = parseFloat((user.balance - bet).toFixed(2));
        const spin = [0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
        let winnings = 0, text = '';

        if (spin[0] === spin[1] && spin[1] === spin[2]) {
            winnings = parseFloat((bet * 5).toFixed(2));
            text = `JACKPOT! You won **$${fmt(winnings)}**!`;
        } else if (spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2]) {
            winnings = parseFloat((bet * 2).toFixed(2));
            text = `You won **$${fmt(winnings)}**!`;
        } else {
            text = `You lost **$${fmt(bet)}**.`;
        }

        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Slots')
            .setDescription(`${spin.join(' | ')}\n\n${text}`)
            .setColor(winnings ? 0x00ff00 : 0xff0000)] });
    }
};
