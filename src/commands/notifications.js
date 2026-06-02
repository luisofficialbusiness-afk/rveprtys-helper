const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/user');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('notifications')
        .setDescription('Toggle whether the bot can send you DMs'),

    async execute(interaction) {
        const userId = interaction.user.id;

        let user = await User.findOne({ userId });
        if (!user) {
            user = new User({ userId, guildId: interaction.guild.id });
        }

        user.dmOptOut = !user.dmOptOut;
        await user.save();

        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle('Notification Settings Updated')
                .setDescription(
                    user.dmOptOut
                        ? 'Bot DMs are now **disabled**. You will no longer receive any DMs from the bot.'
                        : 'Bot DMs are now **enabled**. You will receive DMs from the bot again.'
                )
                .setColor(user.dmOptOut ? 0x71717a : 0x00ff99)
                .setFooter({ text: 'This setting applies globally across all servers' })],
            ephemeral: true
        });
    }
};
