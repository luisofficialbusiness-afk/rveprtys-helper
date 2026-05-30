const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');

const OWNER_ID = '1453078748080504996';
const isAdmin  = i => i.user.id === OWNER_ID || !!i.member?.permissions?.has('Administrator');
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ojackpotdrop')
        .setDescription('Admin: drop money to a random user')
        .addNumberOption(o => o.setName('amount').setDescription('Amount to drop').setRequired(true)),

    async execute(interaction) {
        if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });

        const amount = interaction.options.getNumber('amount');
        const users  = await User.find({ guildId: interaction.guild.id });
        if (!users.length) return interaction.reply({ content: 'No users found.', ephemeral: true });

        const winner = users[Math.floor(Math.random() * users.length)];
        winner.balance = parseFloat((winner.balance + amount).toFixed(2));
        await winner.save();

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Jackpot Drop')
            .setDescription(`<@${winner.userId}> won **$${fmt(amount)}**!`)
            .setColor(0x00ff00)] });
    }
};
