const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Slave = require('../models/Slave');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slavelist')
        .setDescription('View the slave ownership leaderboard'),

    async execute(interaction) {
        const slaves = await Slave.find({ guildId: interaction.guild.id, ownerId: { $ne: null } });
        if (!slaves.length)
            return interaction.reply({ content: 'No active slaves in this server.', ephemeral: true });

        const ownerMap = {};
        for (const s of slaves) ownerMap[s.ownerId] = (ownerMap[s.ownerId] || 0) + 1;

        const lines = Object.entries(ownerMap)
            .sort((a, b) => b[1] - a[1])
            .map(([ownerId, count], i) => `**${i + 1}.** <@${ownerId}> - ${count} slave${count !== 1 ? 's' : ''}`);

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Slave Leaderboard')
            .setDescription(lines.join('\n'))
            .setColor(0xFF4500)] });
    }
};
