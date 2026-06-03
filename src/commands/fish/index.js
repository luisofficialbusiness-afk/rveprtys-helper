const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { hasAnyItem } = require('../../utils/inventory');
const { execute: runFishing } = require('../work/fishing');

const RODS = ['fishing_rod_basic', 'fishing_rod_upgraded', 'fishing_rod_super'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Go fishing - requires a fishing rod from the shop'),

    async execute(interaction) {
        const user = await getUser(interaction.user.id, interaction.guild.id);
        if (!hasAnyItem(user, RODS))
            return interaction.reply({ content: '❌ You need a fishing rod to go fishing. Buy one from `/shop browse`.', ephemeral: true });
        return runFishing(interaction, user);
    }
};
