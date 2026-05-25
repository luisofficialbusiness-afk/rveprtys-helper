const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

const COOLDOWN = 5 * 60 * 1000;
const cooldowns = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Roll dice')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Bet amount')
                .setRequired(true)
        ),

    async execute(interaction) {
        const bet = interaction.options.getInteger('bet');
        const user = await getUser(interaction.user.id, interaction.guild.id);
        const now = Date.now();

        if (cooldowns.has(interaction.user.id)) {
            const expiration = cooldowns.get(interaction.user.id) + COOLDOWN;
            if (now < expiration) {
                return interaction.reply({ content: `⏳ Cooldown active.`, ephemeral: true });
            }
        }

        cooldowns.set(interaction.user.id, now);

        if (bet <= 0 || user.balance < bet) {
            return interaction.reply({ content: "❌ Invalid bet.", ephemeral: true });
        }

        user.balance -= bet;

        const userRoll = Math.floor(Math.random() * 6) + 1;
        const botRoll = Math.floor(Math.random() * 6) + 1;

        let winnings = 0;
        let text = `You: **${userRoll}** | Bot: **${botRoll}**\n`;

        if (userRoll > botRoll) {
            winnings = bet * 2;
            text += `You won $${winnings}`;
        } else if (userRoll === botRoll) {
            winnings = bet;
            text += `Tie - refunded`;
        } else {
            text += `You lost $${bet}`;
        }

        user.balance += winnings;
        await user.save();

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🎲 Dice')
                    .setDescription(text)
                    .setColor(winnings > bet ? 0x00ff00 : winnings === bet ? 0xffff00 : 0xff0000)
            ]
        });
    }
};
