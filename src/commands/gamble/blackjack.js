const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { shuffledDeck, handTotal, showHand } = require('../../utils/gambling');

async function execute(interaction, user, bet, settle) {
    const deck = shuffledDeck();
    let playerHand   = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    if (handTotal(playerHand) === 21 || handTotal(dealerHand) === 21) {
        const pBJ = handTotal(playerHand) === 21, dBJ = handTotal(dealerHand) === 21;
        let winnings = pBJ && dBJ ? bet : pBJ ? parseFloat((bet * 2.5).toFixed(2)) : 0;
        let result   = pBJ && dBJ ? `Both Blackjack - Push, bet refunded.` : pBJ ? `Blackjack! You won **$${formatNumber(winnings)}**!` : `Dealer Blackjack. You lost **$${formatNumber(bet)}**.`;
        ({ winnings } = await settle(winnings));
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🃏 Blackjack').setDescription(`Your hand: ${showHand(playerHand)} = **${handTotal(playerHand)}**\nDealer: ${showHand(dealerHand)} = **${handTotal(dealerHand)}**\n\n${result}`).setColor(winnings > bet ? 0x00ff00 : winnings > 0 ? 0xffff00 : 0xff0000)] });
    }

    const bjEmbed = (pHand, extra = '') => new EmbedBuilder()
        .setTitle('🃏 Blackjack')
        .setDescription(`Your hand: ${showHand(pHand)} = **${handTotal(pHand)}**\nDealer shows: \`${dealerHand[0].v}${dealerHand[0].s}\` + ?\n\n${extra || 'Hit or Stand?'}`)
        .setColor(0x2b2d31);

    const bjButtons = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary)
    );

    const msg = await interaction.reply({ embeds: [bjEmbed(playerHand)], components: [bjButtons()], fetchReply: true });

    const finish = async (i, pHand) => {
        let dHand = [...dealerHand];
        while (handTotal(dHand) < 17) dHand.push(deck.pop());
        const pVal = handTotal(pHand), dVal = handTotal(dHand);
        let winnings = 0, result;
        if (pVal > 21)        { result = `Bust! You lost **$${formatNumber(bet)}**.`; }
        else if (dVal > 21)   { winnings = parseFloat((bet * 2).toFixed(2)); result = `Dealer busts! You won **$${formatNumber(winnings)}**!`; }
        else if (pVal > dVal) { winnings = parseFloat((bet * 2).toFixed(2)); result = `You win! You won **$${formatNumber(winnings)}**!`; }
        else if (pVal < dVal) { result = `Dealer wins. You lost **$${formatNumber(bet)}**.`; }
        else                  { winnings = bet; result = `Push - bet refunded.`; }
        const { winnings: final, text: note } = await settle(winnings);
        if (note) result += ` ${note.trim()}`;
        const embed = new EmbedBuilder().setTitle('🃏 Blackjack').setDescription(`Your hand: ${showHand(pHand)} = **${pVal}**\nDealer: ${showHand(dHand)} = **${dVal}**\n\n${result}`).setColor(final > bet ? 0x00ff00 : final > 0 ? 0xffff00 : 0xff0000);
        if (i) await i.update({ embeds: [embed], components: [] });
        else   await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
    };

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });
    collector.on('collect', async i => {
        if (i.customId === 'bj_hit') {
            playerHand.push(deck.pop());
            if (handTotal(playerHand) >= 21) { collector.stop('done'); await finish(i, playerHand); }
            else await i.update({ embeds: [bjEmbed(playerHand)], components: [bjButtons()] });
        } else {
            collector.stop('done');
            await finish(i, playerHand);
        }
    });
    collector.on('end', async (_, reason) => { if (reason !== 'done') await finish(null, playerHand); });
}

module.exports = { execute };
