const { SlashCommandBuilder } = require('discord.js');
const buy       = require('./buy');
const sell      = require('./sell');
const portfolio = require('./portfolio');
const list      = require('./list');
const history   = require('./history');

const SUBS = { buy, sell, portfolio, list, history };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stock')
        .setDescription('Stock market commands')
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Buy shares of a stock')
                .addStringOption(o => o.setName('ticker').setDescription('Stock ticker symbol').setRequired(true))
                .addStringOption(o => o.setName('shares').setDescription('Number of shares, or "max"').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('sell')
                .setDescription('Sell shares of a stock')
                .addStringOption(o => o.setName('ticker').setDescription('Stock ticker symbol').setRequired(true))
                .addStringOption(o => o.setName('shares').setDescription('Number of shares, or "all"').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('portfolio')
                .setDescription('View your stock portfolio')
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('View all current stock market prices')
        )
        .addSubcommand(sub =>
            sub.setName('history')
                .setDescription('View the price history for a stock')
                .addStringOption(o => o.setName('ticker').setDescription('Stock ticker symbol').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        return SUBS[sub].execute(interaction);
    }
};
