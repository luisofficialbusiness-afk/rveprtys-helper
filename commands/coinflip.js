const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, anticheat } = require('../utils/economy');
const cooldowns = require('../utils/cooldowns');

const COOLDOWN = 5 * 60 * 1000;
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin and bet on the result')
        .addIntegerOption(option =>
            option.setName('bet').setDescription('Bet amount').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('choice').setDescription('heads or tails').setRequired(true)
                .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })
        ),

    async execute(interaction) {
        const bet    = interaction.options.getInteger('bet');
        const choice = interaction.options.getString('choice');
        const now    = Date.now();

        if (!['heads', 'tails'].includes(choice))
            return interaction.reply({ content: '❌ Choice must be heads or tails.', ephemeral: true });

        if (cooldowns.coinflip.has(interaction.user.id)) {
            const exp = cooldowns.coinflip.get(interaction.user.id) + COOLDOWN;
            if (now < exp) {
                const left = exp - now;
                const m = Math.floor(left / 60000), s = Math.ceil((left % 60000) / 1000);
                return interaction.reply({ content: `⏳ Cooldown active. Try again in **${m > 0 ? `${m}m ${s}s` : `${s}s`}**.`, ephemeral: true });
            }
        }
        cooldowns.coinflip.set(interaction.user.id, now);

        const user = await getUser(interaction.user.id, interaction.guild.id);
        if (!bet || bet <= 0 || user.balance < bet)
            return interaction.reply({ content: '❌ Invalid bet or insufficient balance.', ephemeral: true });

        user.balance = parseFloat((user.balance - bet).toFixed(2));
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        let winnings = 0;
        let text = `Coin landed on **${result}**\n`;

        if (choice === result) {
            winnings = parseFloat((bet * 2).toFixed(2));
            text += `You won **$${fmt(winnings)}**!`;
        } else {
            text += `You lost **$${fmt(bet)}**.`;
        }

        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Coinflip')
            .setDescription(text)
            .setColor(winnings ? 0x00ff00 : 0xff0000)] });
    }
};
