const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { hasAnyItem } = require('../../utils/inventory');
const { execute: runMining } = require('../work/mining');

const PICKAXES = ['pickaxe_basic', 'pickaxe_iron', 'pickaxe_diamond'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mine')
        .setDescription('Go mining - requires a pickaxe from the shop'),

    async execute(interaction) {
        const user = await getUser(interaction.user.id, interaction.guild.id);
        if (!hasAnyItem(user, PICKAXES))
            return interaction.reply({ content: '❌ You need a pickaxe to go mining. Buy one from `/shop browse`.', ephemeral: true });
        return runMining(interaction, user);
    }
};
