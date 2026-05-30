const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

const OWNER_ID = '1453078748080504996';
const isAdmin  = i => i.user.id === OWNER_ID || !!i.member?.permissions?.has('Administrator');
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('osetbalance')
        .setDescription("Admin: set a user's wallet balance")
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
        .addNumberOption(o => o.setName('amount').setDescription('New balance').setRequired(true)),

    async execute(interaction) {
        if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });

        const target = interaction.options.getUser('user');
        const amount = interaction.options.getNumber('amount');

        const user = await getUser(target.id, interaction.guild.id);
        user.balance = amount;
        await user.save();

        return interaction.reply({ content: `✅ Set <@${target.id}>'s wallet to **$${fmt(amount)}**`, ephemeral: true });
    }
};
