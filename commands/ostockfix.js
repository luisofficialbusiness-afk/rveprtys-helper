const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Stock = require('../models/Stock');

const OWNER_ID = '1453078748080504996';
const isAdmin  = i => i.user.id === OWNER_ID || !!i.member?.permissions?.has('Administrator');
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ostockfix')
        .setDescription('Admin: manually trigger a stock market price tick'),

    async execute(interaction) {
        if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });

        const stocks = await Stock.find({ guildId: interaction.guild.id });
        if (!stocks.length) return interaction.reply({ content: '❌ No stocks found. Run `/setupmarket` first.', ephemeral: true });

        const results = [];
        for (const stock of stocks) {
            const oldPrice = stock.price;
            const change   = 1 + (Math.random() * 0.06 - 0.03);
            const newPrice = Math.max(0.01, parseFloat((stock.price * change).toFixed(2)));
            stock.history.push(newPrice);
            if (stock.history.length > 30) stock.history.shift();
            stock.price = newPrice;
            await stock.save();
            const diff = newPrice - oldPrice;
            const pct  = ((diff / oldPrice) * 100).toFixed(2);
            results.push(`${diff >= 0 ? '▲' : '▼'} \`${stock.ticker}\` $${fmt(oldPrice)} → $${fmt(newPrice)} (${diff >= 0 ? '+' : ''}${pct}%)`);
        }

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Stock Market Manually Ticked')
            .setDescription(results.join('\n'))
            .setColor(0x00FF99)
            .setFooter({ text: 'Same logic as the 30-minute auto tick' })
            .setTimestamp()] });
    }
};
