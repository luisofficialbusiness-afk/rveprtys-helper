const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const OWNER_ID = "1453078748080504996";
const bountyMap = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('obountyboss')
        .setDescription('Owner: set bounty boss')
        .addUserOption(o =>
            o.setName('user')
                .setDescription('User to set bounty on')
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName('amount')
                .setDescription('Bounty amount')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) return;

        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        bountyMap.set(user.id, amount);

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🎯 Bounty Set')
                    .setDescription(`${user.username} now has a bounty of $${amount}`)
            ]
        });
    },

    bountyMap
};
