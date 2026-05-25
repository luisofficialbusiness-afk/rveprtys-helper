const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bankleaderboard')
        .setDescription('View the richest users by bank balance'),

    async execute(interaction) {

        const users = await User.find({ guildId: interaction.guild.id })
            .sort({ bank: -1 })
            .limit(10);

        if (!users.length) {
            return interaction.reply({
                content: "No data yet.",
                ephemeral: true
            });
        }

        let description = '';

        for (let i = 0; i < users.length; i++) {
            const u = users[i];
            description += `**${i + 1}.** <@${u.userId}> — $${u.bank}\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle('🏦 Bank Leaderboard')
            .setDescription(description)
            .setColor(0x2b2d31);

        await interaction.reply({ embeds: [embed] });
    }
};
