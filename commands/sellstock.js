const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Stock = require('../models/Stock');
const Portfolio = require('../models/Portfolio');
const User = require('../models/User');

const fmt    = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n).toLocaleString('en-US');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sellstock')
        .setDescription('Sell shares of a stock')
        .addStringOption(o =>
            o.setName('ticker').setDescription('Stock ticker symbol').setRequired(true)
        )
        .addStringOption(o =>
            o.setName('shares').setDescription('Number of shares to sell, or "all"').setRequired(false)
        ),

    async execute(interaction) {
        const ticker    = interaction.options.getString('ticker').toUpperCase();
        const sharesStr = interaction.options.getString('shares');

        const stock = await Stock.findOne({ guildId: interaction.guild.id, ticker });
        if (!stock) return interaction.reply({ content: `❌ Ticker \`${ticker}\` not found.`, ephemeral: true });

        const portfolio = await Portfolio.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
        const holding   = portfolio?.holdings.find(h => h.ticker === ticker);
        if (!holding || holding.shares <= 0)
            return interaction.reply({ content: `❌ You don't hold any shares of \`${ticker}\`.`, ephemeral: true });

        let shares;
        if (!sharesStr || sharesStr.toLowerCase() === 'all') {
            shares = holding.shares;
        } else {
            shares = parseInt(sharesStr);
            if (isNaN(shares) || shares <= 0) return interaction.reply({ content: '❌ Shares must be a whole number.', ephemeral: true });
        }
        if (shares > holding.shares)
            return interaction.reply({ content: `❌ You only have **${fmtInt(holding.shares)}** shares of \`${ticker}\`.`, ephemeral: true });

        const totalEarned = parseFloat((stock.price * shares).toFixed(2));
        const profit      = parseFloat((totalEarned - holding.avgBuyPrice * shares).toFixed(2));

        holding.shares -= shares;
        if (holding.shares === 0) portfolio.holdings = portfolio.holdings.filter(h => h.ticker !== ticker);
        await portfolio.save();

        const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
        user.balance = parseFloat((user.balance + totalEarned).toFixed(2));
        await user.save();

        const sellImpact  = Math.min(shares / Math.max(stock.totalShares, 10000), 0.1) * 0.5;
        stock.price       = Math.max(parseFloat((stock.price * (1 - sellImpact)).toFixed(2)), 0.01);
        stock.totalShares = Math.max(0, stock.totalShares - shares);
        await stock.save();

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Stock Sold')
            .setColor(profit >= 0 ? 0x00FF99 : 0xFF4500)
            .addFields(
                { name: 'Stock',            value: `${stock.name} (\`${ticker}\`)`,            inline: true },
                { name: 'Shares Sold',      value: `${fmtInt(shares)}`,                        inline: true },
                { name: 'Price Per Share',  value: `$${fmt(stock.price)}`,                     inline: true },
                { name: 'Total Earned',     value: `$${fmt(totalEarned)}`,                     inline: true },
                { name: 'Profit/Loss',      value: `${profit >= 0 ? '+' : ''}$${fmt(profit)}`, inline: true },
                { name: 'New Cash Balance', value: `$${fmt(user.balance)}`,                    inline: true }
            )
            .setFooter({ text: 'Economic Bomb Stock Market' })
            .setTimestamp()] });
    }
};
