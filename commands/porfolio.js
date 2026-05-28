const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Stock = require('../models/Stock');
const Portfolio = require('../models/Portfolio');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('portfolio')
        .setDescription('View your stock portfolio'),

    async execute(interaction) {
        const portfolio = await Portfolio.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });

        if (!portfolio || !portfolio.holdings.length) {
            return interaction.reply({ content: '📭 You have no stocks. Use `/buystock` to get started.', ephemeral: true });
        }

        let totalValue = 0;
        let totalCost = 0;
        const rows = [];

        for (const h of portfolio.holdings) {
            const stock = await Stock.findOne({ ticker: h.ticker });
            if (!stock) continue;
            const currentValue = stock.price * h.shares;
            const costBasis = h.avgBuyPrice * h.shares;
            const profit = currentValue - costBasis;
            totalValue += currentValue;
            totalCost += costBasis;
            const arrow = profit >= 0 ? '🟢' : '🔴';
            rows.push(`${arrow} \`${h.ticker}\` x${h.shares} — $${currentValue.toFixed(2)} (${profit >= 0 ? '+' : ''}$${profit.toFixed(2)})`);
        }

        const totalProfit = totalValue - totalCost;

        const embed = new EmbedBuilder()
            .setTitle(`📊 ${interaction.user.username}'s Portfolio`)
            .setDescription(rows.join('\n'))
            .setColor(totalProfit >= 0 ? 0x00FF99 : 0xFF4500)
            .addFields(
                { name: 'Total Value', value: `$${totalValue.toFixed(2)}`, inline: true },
                { name: 'Total Profit/Loss', value: `${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}`, inline: true }
            )
            .setFooter({ text: 'NRG Stock Market' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
