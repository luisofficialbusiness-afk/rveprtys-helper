const { SlashCommandBuilder } = require('discord.js');
const buy  = require('./buy');
const info = require('./info');

const SUBS = { buy, info };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lottery')
        .setDescription('Buy tickets and win the lottery pot')
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Buy lottery tickets')
                .addStringOption(o =>
                    o.setName('type').setDescription('Which lottery').setRequired(true)
                        .addChoices(
                            { name: 'Hourly ($200 / ticket)',   value: 'hourly' },
                            { name: 'Daily ($1,000 / ticket)',  value: 'daily'  },
                        )
                )
                .addIntegerOption(o =>
                    o.setName('tickets').setDescription('Number of tickets').setRequired(true).setMinValue(1).setMaxValue(100)
                )
        )
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('View current lottery status')
                .addStringOption(o =>
                    o.setName('type').setDescription('Which lottery (default: hourly)').setRequired(false)
                        .addChoices(
                            { name: 'Hourly', value: 'hourly' },
                            { name: 'Daily',  value: 'daily'  },
                        )
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        return SUBS[sub].execute(interaction);
    }
};
