const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

const OWNER_ID = '1453078748080504996';
const isAdmin  = i => i.user.id === OWNER_ID || !!i.member?.permissions?.has('Administrator');
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ogive')
        .setDescription('Admin: give money to a user')
        .addUserOption(o => o.setName('user').setDescription('User to give money to').setRequired(true))
        .addNumberOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),

    async execute(interaction) {
        if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });

        const target = interaction.options.getUser('user');
        const amount = interaction.options.getNumber('amount');
        if (!target || isNaN(amount)) return interaction.reply({ content: '❌ Invalid arguments.', ephemeral: true });

        const user = await getUser(target.id, interaction.guild.id);
        user.balance = parseFloat((user.balance + amount).toFixed(2));
        await user.save();

        return interaction.reply({ content: `✅ Gave **$${fmt(amount)}** to <@${target.id}>`, ephemeral: true });
    }
};
