const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your balance'),

    async execute(interaction) {
        const user = await getUser(interaction.user.id, interaction.guild.id);

        const embed = new EmbedBuilder()
            .setTitle(`💰 ${interaction.user.username}'s Balance`)
            .addFields(
                { name: "💵 Wallet", value: `${user.balance}`, inline: true },
                { name: "🏦 Bank", value: `${user.bank}`, inline: true }
            )
            .setColor(0x2b2d31);

        await interaction.reply({ embeds: [embed] });
    }
};
