const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Stock = require('../models/Stock');
const Portfolio = require('../models/Portfolio');

const fmt    = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n).toLocaleString('en-US');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('portfolio')
        .setDescription('View your stock portfolio'),

    async execute(interaction) {
        const portfolio = await Portfolio.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
        if (!portfolio || !portfolio.holdings.length)
            return interaction.reply({ content: '📭 You have no stocks. Use `/buystock` to get started.', ephemeral: true });

        let totalValue = 0, totalCost = 0;
        const rows = [];

        for (const h of portfolio.holdings) {
            const stock = await Stock.findOne({ guildId: interaction.guild.id, ticker: h.ticker });
            if (!stock) continue;
            const currentValue = stock.price * h.shares;
            const costBasis    = h.avgBuyPrice * h.shares;
            const profit       = currentValue - costBasis;
            totalValue += currentValue;
            totalCost  += costBasis;
            const arrow = profit >= 0 ? '▲' : '▼';
            rows.push(`${arrow} \`${h.ticker}\` x${fmtInt(h.shares)} - $${fmt(currentValue)} (${profit >= 0 ? '+' : ''}$${fmt(profit)})`);
        }

        const totalProfit = totalValue - totalCost;

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle(`${interaction.user.username}'s Portfolio`)
            .setDescription(rows.join('\n'))
            .setColor(totalProfit >= 0 ? 0x00FF99 : 0xFF4500)
            .addFields(
                { name: 'Total Value',       value: `$${fmt(totalValue)}`,  inline: true },
                { name: 'Total Profit/Loss', value: `${totalProfit >= 0 ? '+' : ''}$${fmt(totalProfit)}`, inline: true }
            )
            .setFooter({ text: 'Economic Bomb Stock Market' })
            .setTimestamp()] });
    }
};
