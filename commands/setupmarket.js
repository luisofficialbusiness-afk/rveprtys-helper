const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { seedMarket, COMPANIES } = require('../utils/market');

const OWNER_ID = '1453078748080504996';
const isAdmin  = i => i.user.id === OWNER_ID || !!i.member?.permissions?.has('Administrator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupmarket')
        .setDescription('Admin: initialize or reset the stock market for this server'),

    async execute(interaction) {
        if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });

        await seedMarket(interaction.guild.id);

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Market Initialized')
            .setDescription(`Successfully seeded **${COMPANIES.length} stocks** for this server.\nUse \`/stocks\` to view the market.`)
            .setColor(0x00FF99)
            .setTimestamp()] });
    }
};
