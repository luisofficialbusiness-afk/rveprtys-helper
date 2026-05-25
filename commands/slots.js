const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

const symbols = ['🍒', '🍋', '🍉', '⭐', '💎', '🍀'];

const COOLDOWN = 5 * 60 * 1000;
const cooldowns = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Bet money on slots')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Amount to bet')
                .setRequired(true)
        ),

    async execute(interaction) {
        const bet = interaction.options.getInteger('bet');
        const user = await getUser(interaction.user.id, interaction.guild.id);
        const now = Date.now();

        if (cooldowns.has(interaction.user.id)) {
            const expiration = cooldowns.get(interaction.user.id) + COOLDOWN;
            if (now < expiration) {
                return interaction.reply({
                    content: `⏳ Cooldown active. Try again later.`,
                    ephemeral: true
                });
            }
        }

        cooldowns.set(interaction.user.id, now);

        if (bet <= 0 || user.balance < bet) {
            return interaction.reply({ content: "❌ Invalid bet.", ephemeral: true });
        }

        user.balance -= bet;

        const spin = [
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)]
        ];

        let winnings = 0;
        let text = "You lost.";

        if (spin[0] === spin[1] && spin[1] === spin[2]) {
            winnings = bet * 5;
            text = `JACKPOT! You won $${winnings}`;
        } else if (spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2]) {
            winnings = bet * 2;
            text = `You won $${winnings}`;
        }

        user.balance += winnings;
        await user.save();

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🎰 Slots')
                    .setDescription(`${spin.join(' | ')}\n\n${text}`)
                    .setColor(winnings ? 0x00ff00 : 0xff0000)
            ]
        });
    }
};
