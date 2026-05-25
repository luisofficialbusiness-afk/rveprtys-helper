const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');

const OWNER_ID = "1453078748080504996";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oeconomystats')
        .setDescription('Owner: economy stats'),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) return;

        const users = await User.find({ guildId: interaction.guild.id });

        const totalMoney = users.reduce((a, b) => a + b.balance + b.bank, 0);
        const richest = users.sort((a, b) => (b.balance + b.bank) - (a + b.bank))[0];

        const embed = new EmbedBuilder()
            .setTitle('📊 Economy Stats')
            .addFields(
                { name: "Users", value: `${users.length}` },
                { name: "Total Money", value: `$${totalMoney}` },
                { name: "Richest", value: richest ? `<@${richest.userId}>` : "None" }
            );

        interaction.reply({ embeds: [embed] });
    }
};
