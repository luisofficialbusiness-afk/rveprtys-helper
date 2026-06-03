const { SlashCommandBuilder } = require('discord.js');
const buy    = require('./buy');
const sell   = require('./sell');
const outbid = require('./outbid');
const status = require('./status');
const panel  = require('./panel');
const list   = require('./list');

const SUBS = { buy, sell, outbid, status, panel, list };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slave')
        .setDescription('Slave system commands')
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Start an auction to purchase a user as a slave')
                .addUserOption(o => o.setName('user').setDescription('User to buy').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('sell')
                .setDescription('Auction off one of your slaves to the highest bidder')
                .addUserOption(o => o.setName('user').setDescription('Slave to sell').setRequired(true))
                .addIntegerOption(o => o.setName('startingbid').setDescription('Starting bid amount').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('outbid')
                .setDescription('Bid in an active sell auction, or pay to escape a buy auction')
                .addNumberOption(o => o.setName('amount').setDescription('Amount to bid').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Check your current slave status')
        )
        .addSubcommand(sub =>
            sub.setName('panel')
                .setDescription('Manage the users you own')
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('View the slave ownership leaderboard')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        return SUBS[sub].execute(interaction);
    }
};
