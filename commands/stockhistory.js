const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Stock = require('../models/Stock');

const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stockhistory')
        .setDescription('View the price history for a stock')
        .addStringOption(o =>
            o.setName('ticker').setDescription('Stock ticker symbol').setRequired(true)
        ),

    async execute(interaction) {
        const ticker = interaction.options.getString('ticker').toUpperCase();
        const stock  = await Stock.findOne({ guildId: interaction.guild.id, ticker });
        if (!stock) return interaction.reply({ content: `❌ Ticker \`${ticker}\` not found.`, ephemeral: true });

        const history = stock.history.slice(-10);
        const chart   = history.map((p, i) => {
            const prev  = history[i - 1] ?? p;
            const arrow = p > prev ? '▲' : p < prev ? '▼' : '-';
            return `${arrow} $${fmt(p)}`;
        }).join('\n');

        const first         = history[0];
        const last          = history[history.length - 1];
        const overallChange = last - first;
        const overallPct    = ((overallChange / first) * 100).toFixed(2);

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle(`${stock.name} (\`${ticker}\`) - Price History`)
            .setDescription(chart || 'No history yet.')
            .setColor(overallChange >= 0 ? 0x00FF99 : 0xFF4500)
            .addFields(
                { name: 'Current Price',  value: `$${fmt(stock.price)}`,                          inline: true },
                { name: 'Overall Change', value: `${overallChange >= 0 ? '+' : ''}${overallPct}%`, inline: true }
            )
            .setFooter({ text: 'Last 10 price points' })
            .setTimestamp()] });
    }
};
