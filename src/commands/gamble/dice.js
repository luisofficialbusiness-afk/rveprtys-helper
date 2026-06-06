const { EmbedBuilder } = require('discord.js');
const { formatNumber } = require('../../utils/format');

async function execute(interaction, user, bet, settle) {
    const userRoll = Math.floor(Math.random() * 6) + 1;
    const botRoll  = Math.floor(Math.random() * 6) + 1;
    let winnings = 0, text, color;

    if (userRoll > botRoll) {
        winnings = parseFloat((bet * 2).toFixed(2));
        text  = `You: **${userRoll}** | Bot: **${botRoll}**\nYou won **$${formatNumber(winnings)}**!`;
        color = 0x00ff00;
    } else if (userRoll === botRoll) {
        winnings = bet;
        text  = `You: **${userRoll}** | Bot: **${botRoll}**\nTie - bet refunded.`;
        color = 0xffff00;
    } else {
        text  = `You: **${userRoll}** | Bot: **${botRoll}**\nYou lost **$${formatNumber(bet)}**.`;
        color = 0xff0000;
    }

    ({ winnings, text } = await settle(winnings, text));
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎲 Dice Roll').setDescription(text).setColor(color)] });
}

module.exports = { execute };
