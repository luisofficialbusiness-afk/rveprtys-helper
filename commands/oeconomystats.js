const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');

const OWNER_ID = '1453078748080504996';
const isAdmin  = i => i.user.id === OWNER_ID || !!i.member?.permissions?.has('Administrator');
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oeconomystats')
        .setDescription('Admin: economy stats for this server'),

    async execute(interaction) {
        if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });

        const users      = await User.find({ guildId: interaction.guild.id });
        const totalMoney = users.reduce((a, b) => a + b.balance + b.bank, 0);
        const richest    = [...users].sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank))[0];

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Economy Stats')
            .addFields(
                { name: 'Total Players', value: `${users.length}`, inline: true },
                { name: 'Total Money',   value: `$${fmt(totalMoney)}`, inline: true },
                { name: 'Richest',       value: richest ? `<@${richest.userId}> ($${fmt(richest.balance + richest.bank)})` : 'None', inline: true }
            )
            .setColor(0x2b2d31)] });
    }
};
