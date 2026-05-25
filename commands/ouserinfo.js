const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

const OWNER_ID = "1453078748080504996";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ouserinfo')
        .setDescription('Owner: inspect user')
        .addUserOption(o =>
            o.setName('user')
                .setDescription('User to inspect')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) return;

        const target = interaction.options.getUser('user');
        const user = await getUser(target.id, interaction.guild.id);

        const embed = new EmbedBuilder()
            .setTitle('👤 User Info')
            .addFields(
                { name: "Balance", value: `${user.balance}` },
                { name: "Bank", value: `${user.bank}` }
            );

        interaction.reply({ embeds: [embed] });
    }
};
