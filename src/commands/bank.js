const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

const MAX_BALANCE = 999_999_999_999_999;
const { fmt } = require('../utils/fmt');

function parseAmount(str, balance) {
    if (!str) return NaN;
    const s = str.toString().toLowerCase();
    if (s === 'all' || s === 'max') return balance;
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bank')
        .setDescription('Manage your wallet and bank')
        .addSubcommand(sub =>
            sub.setName('balance')
                .setDescription("Check your balance or someone else's")
                .addUserOption(o => o.setName('user').setDescription('User to check (default: yourself)').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('deposit')
                .setDescription('Deposit money into your bank')
                .addStringOption(o => o.setName('amount').setDescription('Amount to deposit, or "all"').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('withdraw')
                .setDescription('Withdraw money from your bank')
                .addStringOption(o => o.setName('amount').setDescription('Amount to withdraw, or "all"').setRequired(true))
        ),

    async execute(interaction) {
        const sub  = interaction.options.getSubcommand();
        const user = await getUser(interaction.user.id, interaction.guild.id);

        if (sub === 'balance') {
            const target     = interaction.options.getUser('user') ?? interaction.user;
            const targetUser = target.id === interaction.user.id ? user : await getUser(target.id, interaction.guild.id);
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`💰 ${target.username}'s Balance`)
                .addFields(
                    { name: '💵 Wallet', value: `$${fmt(targetUser.balance)}`, inline: true },
                    { name: '🏦 Bank',   value: `$${fmt(targetUser.bank)}`,    inline: true }
                )
                .setColor(0x2b2d31)] });
        }

        if (sub === 'deposit') {
            const amount = parseAmount(interaction.options.getString('amount'), user.balance);
            if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Usage: `deposit <amount|all>`', ephemeral: true });
            if (amount > MAX_BALANCE)          return interaction.reply({ content: '❌ Amount too large.', ephemeral: true });
            if (user.balance < amount)         return interaction.reply({ content: "❌ You don't have enough in your wallet.", ephemeral: true });

            user.balance = parseFloat((user.balance - amount).toFixed(2));
            user.bank    = parseFloat((user.bank    + amount).toFixed(2));
            await user.save();

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('🏦 Deposit Successful')
                .setDescription(`Moved **$${fmt(amount)}** into your bank.`)
                .addFields({ name: '🏦 New Bank Balance', value: `$${fmt(user.bank)}`, inline: true })
                .setColor(0x00cc44)] });
        }

        if (sub === 'withdraw') {
            const amount = parseAmount(interaction.options.getString('amount'), user.bank);
            if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Usage: `withdraw <amount|all>`', ephemeral: true });
            if (amount > MAX_BALANCE)          return interaction.reply({ content: '❌ Amount too large.', ephemeral: true });
            if (user.bank < amount)            return interaction.reply({ content: "❌ You don't have enough in your bank.", ephemeral: true });

            user.bank    = parseFloat((user.bank    - amount).toFixed(2));
            user.balance = parseFloat((user.balance + amount).toFixed(2));
            await user.save();

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('💸 Withdrawal Successful')
                .setDescription(`Moved **$${fmt(amount)}** into your wallet.`)
                .addFields({ name: '💵 New Wallet Balance', value: `$${fmt(user.balance)}`, inline: true })
                .setColor(0x00cc44)] });
        }
    }
};
