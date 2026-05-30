const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

const OWNER_ID = '1453078748080504996';
const isAdmin  = i => i.user.id === OWNER_ID || !!i.member?.permissions?.has('Administrator');
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ouserinfo')
        .setDescription("Admin: inspect a user's economy data")
        .addUserOption(o => o.setName('user').setDescription('User to inspect').setRequired(true)),

    async execute(interaction) {
        if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });

        const target = interaction.options.getUser('user');
        const user   = await getUser(target.id, interaction.guild.id);

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('User Info')
            .addFields(
                { name: 'Wallet', value: `$${fmt(user.balance)}`, inline: true },
                { name: 'Bank',   value: `$${fmt(user.bank)}`,    inline: true }
            )
            .setColor(0x2b2d31)] });
    }
};
