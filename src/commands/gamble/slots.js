const { EmbedBuilder } = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { SYMBOLS } = require('../../utils/gambling');

async function execute(interaction, user, bet, settle) {
    const spin = [0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    let winnings = 0, text;

    if (spin[0] === spin[1] && spin[1] === spin[2]) {
        winnings = parseFloat((bet * 5).toFixed(2));
        text = `${spin.join(' | ')}\n\nJACKPOT! You won **$${formatNumber(winnings)}**!`;
    } else if (spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2]) {
        winnings = parseFloat((bet * 2).toFixed(2));
        text = `${spin.join(' | ')}\n\nYou won **$${formatNumber(winnings)}**!`;
    } else {
        text = `${spin.join(' | ')}\n\nYou lost **$${formatNumber(bet)}**.`;
    }

    ({ winnings, text } = await settle(winnings, text));
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎰 Slots').setDescription(text).setColor(winnings ? 0x00ff00 : 0xff0000)] });
}

module.exports = { execute };
