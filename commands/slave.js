const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Slave = require('../models/Slave');

const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slave')
        .setDescription('Check your current slave status'),

    async execute(interaction) {
        const slave = await Slave.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });

        if (!slave?.ownerId)
            return interaction.reply({ content: '✅ You are a free person.', ephemeral: true });

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Your Slave Status')
            .setDescription(`You are owned by <@${slave.ownerId}>`)
            .addFields(
                { name: 'Debt Remaining',         value: `$${fmt(slave.debt)}`,        inline: true },
                { name: 'Total Earned for Owner', value: `$${fmt(slave.totalEarned)}`, inline: true }
            )
            .setColor(0xFF0000)
            .setFooter({ text: 'Keep working to pay off your debt!' })
            .setTimestamp()] });
    }
};
