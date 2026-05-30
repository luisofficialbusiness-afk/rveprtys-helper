const { SlashCommandBuilder } = require('discord.js');
const User = require('../models/User');

const OWNER_ID = '1453078748080504996';
const isAdmin  = i => i.user.id === OWNER_ID || !!i.member?.permissions?.has('Administrator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oresetleaderboard')
        .setDescription('Admin: reset the economy for this server'),

    async execute(interaction) {
        if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });

        await User.updateMany({ guildId: interaction.guild.id }, { balance: 0, bank: 0 });
        return interaction.reply({ content: '✅ Economy reset for this server.', ephemeral: true });
    }
};
