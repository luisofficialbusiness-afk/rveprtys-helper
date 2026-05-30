const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, anticheat } = require('../utils/economy');
const cooldowns = require('../utils/cooldowns');

const COOLDOWN = 5 * 60 * 1000;
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Roll dice against the house')
        .addIntegerOption(option =>
            option.setName('bet').setDescription('Bet amount').setRequired(true)
        ),

    async execute(interaction) {
        const bet = interaction.options.getInteger('bet');
        const now = Date.now();

        if (cooldowns.dice.has(interaction.user.id)) {
            const exp = cooldowns.dice.get(interaction.user.id) + COOLDOWN;
            if (now < exp) {
                const left = exp - now;
                const m = Math.floor(left / 60000), s = Math.ceil((left % 60000) / 1000);
                return interaction.reply({ content: `⏳ Cooldown active. Try again in **${m > 0 ? `${m}m ${s}s` : `${s}s`}**.`, ephemeral: true });
            }
        }
        cooldowns.dice.set(interaction.user.id, now);

        const user = await getUser(interaction.user.id, interaction.guild.id);
        if (!bet || bet <= 0 || user.balance < bet)
            return interaction.reply({ content: '❌ Invalid bet or insufficient balance.', ephemeral: true });

        user.balance = parseFloat((user.balance - bet).toFixed(2));

        const userRoll = Math.floor(Math.random() * 6) + 1;
        const botRoll  = Math.floor(Math.random() * 6) + 1;
        let winnings = 0;
        let text = `You: **${userRoll}** | Bot: **${botRoll}**\n`;

        if (userRoll > botRoll) {
            winnings = parseFloat((bet * 2).toFixed(2));
            text += `You won **$${fmt(winnings)}**!`;
        } else if (userRoll === botRoll) {
            winnings = bet;
            text += `Tie — bet refunded.`;
        } else {
            text += `You lost **$${fmt(bet)}**.`;
        }

        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Dice Roll')
            .setDescription(text)
            .setColor(winnings > bet ? 0x00ff00 : winnings === bet ? 0xffff00 : 0xff0000)] });
    }
};
