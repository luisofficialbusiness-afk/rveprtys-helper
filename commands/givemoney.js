const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('givemoney')
        .setDescription('Give money to another user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Recipient')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to give')
                .setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        const user = await getUser(interaction.user.id, interaction.guild.id);
        const receiver = await getUser(target.id, interaction.guild.id);

        if (amount <= 0) {
            return interaction.reply({ content: "❌ Invalid amount.", ephemeral: true });
        }

        if (user.balance < amount) {
            return interaction.reply({ content: "❌ Not enough money.", ephemeral: true });
        }

        user.balance -= amount;
        receiver.balance += amount;

        await user.save();
        await receiver.save();

        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🤝 Transfer Complete')
                    .setDescription(`You gave **$${amount}** to ${target.username}`)
                    .setColor(0x00ff00)
            ]
        });
    }
};
