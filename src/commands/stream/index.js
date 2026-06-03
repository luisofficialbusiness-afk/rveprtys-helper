const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { hasAllItems } = require('../../utils/inventory');
const { execute: runStreaming } = require('../work/streaming');

const REQUIRED = ['keyboard_mouse', 'camera'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stream')
        .setDescription('Start a livestream - requires Keyboard & Mouse and Camera from the shop'),

    async execute(interaction) {
        const user = await getUser(interaction.user.id, interaction.guild.id);
        if (!hasAllItems(user, REQUIRED))
            return interaction.reply({ content: '❌ You need a **Keyboard & Mouse** and **Camera** to stream. Buy them from `/shop browse`.', ephemeral: true });
        return runStreaming(interaction, user);
    }
};
