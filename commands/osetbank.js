const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

const OWNER_ID = "1453078748080504996";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('osetbank')
        .setDescription('Owner: set bank')
        .addUserOption(o =>
            o.setName('user')
                .setDescription('User to edit bank')
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName('amount')
                .setDescription('New bank amount')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) return;

        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        const user = await getUser(target.id, interaction.guild.id);
        user.bank = amount;

        await user.save();

        interaction.reply({ content: 'Bank set.', ephemeral: true });
    }
};
