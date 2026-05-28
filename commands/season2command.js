const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');

const OWNER_ID = "1453078748080504996";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seasonpreview')
        .setDescription('Owner: Preview the Season 1 winners before the economy reset'),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: '❌ You are not authorized to use this command.', ephemeral: true });
        }

        const cashWinners = await User.find({ guildId: interaction.guild.id })
            .sort({ balance: -1 })
            .limit(5);

        const bankWinners = await User.find({ guildId: interaction.guild.id })
            .sort({ bank: -1 })
            .limit(5);

        const cashDesc = cashWinners.length
            ? cashWinners.map((u, i) => `**${i + 1}.** <@${u.userId}> — $${u.balance}`).join('\n')
            : 'No data.';

        const bankDesc = bankWinners.length
            ? bankWinners.map((u, i) => `**${i + 1}.** <@${u.userId}> — $${u.bank}`).join('\n')
            : 'No data.';

        const embed = new EmbedBuilder()
            .setTitle('📋 Season 1 Standings Preview')
            .setDescription('This is a **preview only** — no data has been wiped.')
            .setColor(0x5865F2)
            .addFields(
                { name: '💵 Cash Leaderboard', value: cashDesc, inline: true },
                { name: '🏦 Bank Leaderboard', value: bankDesc, inline: true }
            )
            .setFooter({ text: 'NRG Economy • Season 1 Preview — Run /seasonreset when ready' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
