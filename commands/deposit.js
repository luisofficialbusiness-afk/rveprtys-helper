const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit money into your bank')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to deposit')
                .setRequired(true)
        ),

    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const user = await getUser(interaction.user.id, interaction.guild.id);

   
        if (amount <= 0) {
            return interaction.reply({
                content: "❌ Amount must be greater than 0.",
                ephemeral: true
            });
        }

        if (user.balance < amount) {
            return interaction.reply({
                content: "❌ You don't have enough money in your wallet.",
                ephemeral: true
            });
        }

 
        user.balance -= amount;
        user.bank += amount;

        await user.save();

        const embed = new EmbedBuilder()
            .setTitle('🏦 Deposit Successful')
            .setDescription(`Deposited **$${amount}** into your bank.`)
            .setColor(0x00ff00);

        await interaction.reply({ embeds: [embed] });
    }
};
