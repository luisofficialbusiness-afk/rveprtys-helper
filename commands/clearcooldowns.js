const { SlashCommandBuilder } = require('discord.js');
const cooldowns = require('../utils/cooldowns');

const OWNER_ID = '1453078748080504996';
const isAdmin  = i => i.user.id === OWNER_ID || !!i.member?.permissions?.has('Administrator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearcooldowns')
        .setDescription('Admin: clear all active cooldowns'),

    async execute(interaction) {
        if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });

        Object.values(cooldowns).forEach(m => m.clear());
        return interaction.reply({ content: '✅ All cooldowns cleared.', ephemeral: true });
    }
};
