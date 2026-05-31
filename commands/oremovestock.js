const { SlashCommandBuilder } = require('discord.js');
const Portfolio = require('../models/Portfolio');

const OWNER_ID = '1453078748080504996';
const isAdmin  = i => i.user.id === OWNER_ID || !!i.member?.permissions?.has('Administrator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oremovestock')
        .setDescription("Admin: remove a stock from a user's portfolio")
        .addUserOption(o =>
            o.setName('user').setDescription('Target user').setRequired(true)
        )
        .addStringOption(o =>
            o.setName('ticker').setDescription('Stock ticker to remove').setRequired(true)
        ),

    async execute(interaction) {
        if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });

        const target = interaction.options.getUser('user');
        const ticker = interaction.options.getString('ticker').toUpperCase();

        const portfolio = await Portfolio.findOne({ userId: target.id, guildId: interaction.guild.id });
        if (!portfolio) return interaction.reply({ content: '❌ User has no portfolio.', ephemeral: true });

        const before = portfolio.holdings.length;
        portfolio.holdings = portfolio.holdings.filter(h => h.ticker !== ticker);
        if (portfolio.holdings.length === before)
            return interaction.reply({ content: `❌ <@${target.id}> doesn't hold \`${ticker}\`.`, ephemeral: true });

        await portfolio.save();
        return interaction.reply({ content: `✅ Removed all \`${ticker}\` shares from <@${target.id}>'s portfolio.`, ephemeral: true });
    }
};
