const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, anticheat } = require('../utils/economy');

const SYMBOLS    = ['🍒', '🍋', '🍉', '⭐', '💎', '🍀'];
const RED_NUMS   = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const CARD_VALS  = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS      = ['♠','♥','♦','♣'];

const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function shuffledDeck() {
    const deck = SUITS.flatMap(s => CARD_VALS.map(v => ({ v, s })));
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function cardPoints(card) {
    if (['J','Q','K'].includes(card.v)) return 10;
    if (card.v === 'A') return 11;
    return parseInt(card.v);
}

function handTotal(hand) {
    let total = hand.reduce((a, c) => a + cardPoints(c), 0);
    let aces  = hand.filter(c => c.v === 'A').length;
    while (total > 21 && aces-- > 0) total -= 10;
    return total;
}

function showHand(hand) {
    return hand.map(c => `\`${c.v}${c.s}\``).join(' ');
}

function cardRank(card) {
    return CARD_VALS.indexOf(card.v);
}

function trackWin(user, winnings, bet) {
    user.gamblingWinnings = parseFloat(((user.gamblingWinnings ?? 0) + winnings - bet).toFixed(2));
}

function applyBoost(user, winnings, text) {
    if ((user.gamblingBoostExpires ?? 0) > Date.now() && winnings > 0) {
        winnings = parseFloat((winnings * 1.05).toFixed(2));
        text    += '\n🛟 *+5% lifesaver boost*';
    }
    return { winnings, text };
}

const HORSES = [
    { name: 'Thunderbolt', emoji: '⚡', odds: 1.8  },
    { name: 'Lucky Star',  emoji: '⭐', odds: 2.5  },
    { name: 'Iron Hooves', emoji: '🦾', odds: 3.5  },
    { name: 'Dark Shadow', emoji: '🌑', odds: 5.0  },
    { name: 'Wild Spirit', emoji: '🌪️', odds: 7.5  },
    { name: 'Long Shot',   emoji: '🎯', odds: 12.0 },
];

const SCRATCH_SYMBOLS = ['💎', '⭐', '🍀', '💰', '🎯', '❌'];

function baccaratVal(card) {
    if (['10','J','Q','K'].includes(card.v)) return 0;
    if (card.v === 'A') return 1;
    return parseInt(card.v);
}
function baccaratTotal(hand) {
    return hand.reduce((s, c) => s + baccaratVal(c), 0) % 10;
}

function refundTimeout(user, bet) {
    user.balance = parseFloat((user.balance + bet).toFixed(2));
    return user.save();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Play a gambling game')
        .addStringOption(o =>
            o.setName('game').setDescription('Game to play').setRequired(true)
                .addChoices(
                    { name: 'Slots',        value: 'slots'      },
                    { name: 'Coinflip',     value: 'coinflip'   },
                    { name: 'Dice',         value: 'dice'       },
                    { name: 'Roulette',     value: 'roulette'   },
                    { name: 'Blackjack',    value: 'blackjack'  },
                    { name: 'High / Low',   value: 'highlow'    },
                    { name: 'Crash',        value: 'crash'      },
                    { name: 'Horse Race',   value: 'horserace'  },
                    { name: 'Scratch Card', value: 'scratch'    },
                    { name: 'Baccarat',     value: 'baccarat'   }
                )
        )
        .addIntegerOption(o =>
            o.setName('bet').setDescription('Amount to bet').setRequired(true)
        ),

    async execute(interaction) {
        const game = interaction.options.getString('game');
        const bet  = interaction.options.getInteger('bet');

        const user = await getUser(interaction.user.id, interaction.guild.id);
        if (!bet || bet <= 0 || user.balance < bet)
            return interaction.reply({ content: '❌ Invalid bet or insufficient balance.', ephemeral: true });

        user.balance = parseFloat((user.balance - bet).toFixed(2));

        if (game === 'blackjack') {
            const deck = shuffledDeck();
            let playerHand   = [deck.pop(), deck.pop()];
            const dealerHand = [deck.pop(), deck.pop()];

            if (handTotal(playerHand) === 21 || handTotal(dealerHand) === 21) {
                const pBJ = handTotal(playerHand) === 21, dBJ = handTotal(dealerHand) === 21;
                let winnings = 0, result;
                if (pBJ && dBJ) { winnings = bet;                                result = `Both Blackjack - Push, bet refunded.`; }
                else if (pBJ)   { winnings = parseFloat((bet * 2.5).toFixed(2)); result = `Blackjack! You won **$${fmt(winnings)}**!`; }
                else            {                                                  result = `Dealer Blackjack. You lost **$${fmt(bet)}**.`; }
                user.balance = parseFloat((user.balance + winnings).toFixed(2));
                trackWin(user, winnings, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🃏 Blackjack')
                    .setDescription(`Your hand: ${showHand(playerHand)} = **${handTotal(playerHand)}**\nDealer: ${showHand(dealerHand)} = **${handTotal(dealerHand)}**\n\n${result}`)
                    .setColor(winnings > bet ? 0x00ff00 : winnings > 0 ? 0xffff00 : 0xff0000)] });
            }

            await user.save();

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
                if (pVal > 21)        { result = `Bust! You lost **$${fmt(bet)}**.`; }
                else if (dVal > 21)   { winnings = parseFloat((bet * 2).toFixed(2)); result = `Dealer busts! You won **$${fmt(winnings)}**!`; }
                else if (pVal > dVal) { winnings = parseFloat((bet * 2).toFixed(2)); result = `You win! You won **$${fmt(winnings)}**!`; }
                else if (pVal < dVal) { result = `Dealer wins. You lost **$${fmt(bet)}**.`; }
                else                  { winnings = bet; result = `Push - bet refunded.`; }
                if ((user.gamblingBoostExpires ?? 0) > Date.now() && winnings > bet) { winnings = parseFloat((winnings * 1.05).toFixed(2)); result += ' 🛟 *+5%*'; }
                user.balance = parseFloat((user.balance + winnings).toFixed(2));
                trackWin(user, winnings, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                const embed = new EmbedBuilder().setTitle('🃏 Blackjack')
                    .setDescription(`Your hand: ${showHand(pHand)} = **${pVal}**\nDealer: ${showHand(dHand)} = **${dVal}**\n\n${result}`)
                    .setColor(winnings > bet ? 0x00ff00 : winnings > 0 ? 0xffff00 : 0xff0000);
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
            return;
        }

        if (game === 'coinflip') {
            await user.save();

            const msg = await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🪙 Coinflip')
                    .setDescription(`Bet: **$${fmt(bet)}**\n\nPick a side!`)
                    .setColor(0x2b2d31)],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('cf_heads').setLabel('Heads').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('cf_tails').setLabel('Tails').setStyle(ButtonStyle.Secondary),
                )],
                fetchReply: true,
            });

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });

            collector.on('collect', async i => {
                const pick   = i.customId === 'cf_heads' ? 'heads' : 'tails';
                const result = Math.random() < 0.5 ? 'heads' : 'tails';
                let winnings = 0, text;
                if (pick === result) {
                    winnings = parseFloat((bet * 2).toFixed(2));
                    text = `Coin landed on **${result}**\nYou won **$${fmt(winnings)}**!`;
                } else {
                    text = `Coin landed on **${result}**\nYou lost **$${fmt(bet)}**.`;
                }
                ({ winnings, text } = applyBoost(user, winnings, text));
                user.balance = parseFloat((user.balance + winnings).toFixed(2));
                trackWin(user, winnings, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                await i.update({
                    embeds: [new EmbedBuilder().setTitle('🪙 Coinflip').setDescription(text)
                        .addFields({ name: '💵 New Balance', value: `$${fmt(user.balance)}`, inline: true })
                        .setColor(winnings ? 0x00ff00 : 0xff0000)],
                    components: [],
                });
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await refundTimeout(user, bet);
                    await msg.edit({
                        embeds: [new EmbedBuilder().setTitle('🪙 Coinflip').setDescription('You took too long. Bet refunded.').setColor(0xffff00)],
                        components: [],
                    }).catch(() => {});
                }
            });
            return;
        }

        if (game === 'roulette') {
            await user.save();

            const msg = await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🎡 Roulette')
                    .setDescription(`Bet: **$${fmt(bet)}**\n\n🔴 Red (2x) | ⚫ Black (2x) | 🟢 Green / 0 (35x)\n\nPlace your bet!`)
                    .setColor(0x2b2d31)],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('rl_red').setLabel('Red').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('rl_black').setLabel('Black').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('rl_green').setLabel('Green (0)').setStyle(ButtonStyle.Success),
                )],
                fetchReply: true,
            });

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });

            collector.on('collect', async i => {
                const pick      = i.customId === 'rl_red' ? 'red' : i.customId === 'rl_black' ? 'black' : 'green';
                const spin      = Math.floor(Math.random() * 37);
                const spinColor = spin === 0 ? 'green' : RED_NUMS.has(spin) ? 'red' : 'black';
                const emoji     = { red: '🔴', black: '⚫', green: '🟢' }[spinColor];
                let winnings = 0, text;
                if (pick === spinColor) {
                    winnings = pick === 'green' ? parseFloat((bet * 35).toFixed(2)) : parseFloat((bet * 2).toFixed(2));
                    text = `${emoji} **${spin}**\nYou bet **${pick}** - You won **$${fmt(winnings)}**!`;
                } else {
                    text = `${emoji} **${spin}**\nYou bet **${pick}** - You lost **$${fmt(bet)}**.`;
                }
                ({ winnings, text } = applyBoost(user, winnings, text));
                user.balance = parseFloat((user.balance + winnings).toFixed(2));
                trackWin(user, winnings, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                await i.update({
                    embeds: [new EmbedBuilder().setTitle('🎡 Roulette').setDescription(text)
                        .addFields({ name: '💵 New Balance', value: `$${fmt(user.balance)}`, inline: true })
                        .setColor(winnings ? 0x00ff00 : 0xff0000)],
                    components: [],
                });
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await refundTimeout(user, bet);
                    await msg.edit({
                        embeds: [new EmbedBuilder().setTitle('🎡 Roulette').setDescription('You took too long. Bet refunded.').setColor(0xffff00)],
                        components: [],
                    }).catch(() => {});
                }
            });
            return;
        }

        if (game === 'baccarat') {
            await user.save();

            const msg = await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🎰 Baccarat')
                    .setDescription(`Bet: **$${fmt(bet)}**\n\nPlayer (2x) | Banker (1.95x) | Tie (9x)\n\nPlace your bet!`)
                    .setColor(0x2b2d31)],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('bac_player').setLabel('Player (2x)').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('bac_banker').setLabel('Banker (1.95x)').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('bac_tie').setLabel('Tie (9x)').setStyle(ButtonStyle.Success),
                )],
                fetchReply: true,
            });

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });

            collector.on('collect', async i => {
                const choice = i.customId.replace('bac_', '');
                const deck   = shuffledDeck();
                let pHand    = [deck.pop(), deck.pop()];
                let bHand    = [deck.pop(), deck.pop()];
                let pTotal   = baccaratTotal(pHand);
                let bTotal   = baccaratTotal(bHand);
                if (pTotal < 8 && bTotal < 8) {
                    if (pTotal <= 5) pHand.push(deck.pop());
                    if (bTotal <= 5) bHand.push(deck.pop());
                    pTotal = baccaratTotal(pHand);
                    bTotal = baccaratTotal(bHand);
                }
                const winner = pTotal > bTotal ? 'player' : bTotal > pTotal ? 'banker' : 'tie';
                let winnings = 0, bacLine;
                if (winner === 'tie' && choice !== 'tie') {
                    winnings = bet;
                    bacLine  = `It's a **tie**! Your bet is pushed back.`;
                } else if (choice === winner) {
                    if (choice === 'player')      winnings = parseFloat((bet * 2).toFixed(2));
                    else if (choice === 'banker')  winnings = parseFloat((bet * 1.95).toFixed(2));
                    else                           winnings = parseFloat((bet * 9).toFixed(2));
                    bacLine = `You bet on **${choice}** and won **$${fmt(winnings)}**!`;
                } else {
                    bacLine = `**${winner.charAt(0).toUpperCase() + winner.slice(1)}** wins. You lost **$${fmt(bet)}**.`;
                }
                ({ winnings, text: bacLine } = applyBoost(user, winnings, bacLine));
                user.balance = parseFloat((user.balance + winnings).toFixed(2));
                trackWin(user, winnings, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                await i.update({
                    embeds: [new EmbedBuilder()
                        .setTitle('🎰 Baccarat')
                        .setDescription(`**Player:** ${showHand(pHand)} = **${pTotal}**\n**Banker:** ${showHand(bHand)} = **${bTotal}**\n\n${bacLine}`)
                        .addFields(
                            { name: '💵 New Balance', value: `$${fmt(user.balance)}`, inline: true },
                            { name: '🎯 You Bet On',  value: choice,                  inline: true },
                        )
                        .setColor(winnings > bet ? 0x00ff00 : winnings > 0 ? 0xffff00 : 0xff0000)],
                    components: [],
                });
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await refundTimeout(user, bet);
                    await msg.edit({
                        embeds: [new EmbedBuilder().setTitle('🎰 Baccarat').setDescription('You took too long. Bet refunded.').setColor(0xffff00)],
                        components: [],
                    }).catch(() => {});
                }
            });
            return;
        }

        if (game === 'crash') {
            await user.save();

            const crashAt = parseFloat(Math.min(100, Math.max(1.01, 0.99 / (1 - Math.random()))).toFixed(2));
            let current   = 1.00;
            let done      = false;

            const crashEmbed = (mult) => new EmbedBuilder()
                .setTitle('🚀 Crash')
                .setDescription(
                    `Multiplier: **${mult.toFixed(2)}x**\n` +
                    `Potential payout: **$${fmt(parseFloat((bet * mult).toFixed(2)))}**\n\n` +
                    'Cash out before it crashes!'
                )
                .setColor(mult < 2 ? 0x2ecc71 : mult < 5 ? 0xf1c40f : 0xe74c3c);

            const cashBtn = (mult) => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('crash_cashout').setLabel(`Cash Out (${mult.toFixed(2)}x)`).setStyle(ButtonStyle.Success)
            );

            const msg = await interaction.reply({ embeds: [crashEmbed(current)], components: [cashBtn(current)], fetchReply: true });

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });

            const interval = setInterval(async () => {
                if (done) { clearInterval(interval); return; }
                current = parseFloat((current * 1.08).toFixed(2));
                if (current >= crashAt) {
                    done = true;
                    clearInterval(interval);
                    collector.stop('crashed');
                    trackWin(user, 0, bet);
                    await user.save();
                    await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                    await msg.edit({
                        embeds: [new EmbedBuilder().setTitle('🚀 Crash').setDescription(`Crashed at **${crashAt.toFixed(2)}x**!\nYou lost **$${fmt(bet)}**.`).setColor(0xff0000)],
                        components: [],
                    }).catch(() => {});
                } else {
                    await msg.edit({ embeds: [crashEmbed(current)], components: [cashBtn(current)] }).catch(() => {});
                }
            }, 1000);

            collector.on('collect', async i => {
                if (i.customId !== 'crash_cashout' || done) return;
                done = true;
                clearInterval(interval);
                collector.stop('done');
                let payout = parseFloat((bet * current).toFixed(2));
                let note   = '';
                if ((user.gamblingBoostExpires ?? 0) > Date.now() && payout > bet) { payout = parseFloat((payout * 1.05).toFixed(2)); note = '\n🛟 *+5% lifesaver boost*'; }
                user.balance = parseFloat((user.balance + payout).toFixed(2));
                trackWin(user, payout, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                await i.update({
                    embeds: [new EmbedBuilder().setTitle('🚀 Crash')
                        .setDescription(`Cashed out at **${current.toFixed(2)}x**! You won **$${fmt(payout)}**!${note}`)
                        .addFields({ name: '💵 New Balance', value: `$${fmt(user.balance)}`, inline: true })
                        .setColor(0x00ff00)],
                    components: [],
                });
            });

            collector.on('end', async (_, reason) => {
                if (reason !== 'done' && reason !== 'crashed' && !done) {
                    done = true;
                    clearInterval(interval);
                    const payout = parseFloat((bet * current).toFixed(2));
                    user.balance = parseFloat((user.balance + payout).toFixed(2));
                    trackWin(user, payout, bet);
                    await user.save();
                    await msg.edit({
                        embeds: [new EmbedBuilder().setTitle('🚀 Crash').setDescription(`Timed out - auto cashed out at **${current.toFixed(2)}x**! You received **$${fmt(payout)}**.`).setColor(0xffff00)],
                        components: [],
                    }).catch(() => {});
                }
            });
            return;
        }

        if (game === 'horserace') {
            await user.save();

            const horseList = HORSES.map(h => `${h.emoji} **${h.name}** - ${h.odds}x`).join('\n');
            const rows = [
                new ActionRowBuilder().addComponents(
                    HORSES.slice(0, 3).map((h, i) =>
                        new ButtonBuilder().setCustomId(`horse_${i}`).setLabel(`${h.name} (${h.odds}x)`).setStyle(ButtonStyle.Primary)
                    )
                ),
                new ActionRowBuilder().addComponents(
                    HORSES.slice(3).map((h, i) =>
                        new ButtonBuilder().setCustomId(`horse_${i + 3}`).setLabel(`${h.name} (${h.odds}x)`).setStyle(ButtonStyle.Primary)
                    )
                ),
            ];

            const msg = await interaction.reply({
                embeds: [new EmbedBuilder().setTitle('🏇 Horse Race').setDescription(`**Pick your horse:**\n\n${horseList}\n\nBet: **$${fmt(bet)}**`).setColor(0x2b2d31)],
                components: rows,
                fetchReply: true,
            });

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });

            collector.on('collect', async i => {
                const idx  = parseInt(i.customId.split('_')[1]);
                const pick = HORSES[idx];

                const weights = HORSES.map(h => 1 / h.odds);
                const total   = weights.reduce((a, b) => a + b, 0);
                let r         = Math.random() * total;
                let winnerIdx = HORSES.length - 1;
                for (let j = 0; j < weights.length; j++) { r -= weights[j]; if (r <= 0) { winnerIdx = j; break; } }
                const winner = HORSES[winnerIdx];

                const raceLines = HORSES.map((h, j) => `${j === winnerIdx ? '🥇' : '   '} ${h.emoji} ${h.name}`).join('\n');

                let winnings = 0, resultText;
                if (winnerIdx === idx) {
                    winnings   = parseFloat((bet * pick.odds).toFixed(2));
                    resultText = `Your horse **${pick.name}** won! You won **$${fmt(winnings)}**!`;
                } else {
                    resultText = `**${winner.name}** won the race. Your horse **${pick.name}** lost **$${fmt(bet)}**.`;
                }
                ({ winnings, text: resultText } = applyBoost(user, winnings, resultText));
                user.balance = parseFloat((user.balance + winnings).toFixed(2));
                trackWin(user, winnings, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                await i.update({
                    embeds: [new EmbedBuilder().setTitle('🏇 Horse Race Results')
                        .setDescription(`${raceLines}\n\n${resultText}`)
                        .addFields({ name: '💵 New Balance', value: `$${fmt(user.balance)}`, inline: true })
                        .setColor(winnings > 0 ? 0x00ff00 : 0xff0000)],
                    components: [],
                });
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await refundTimeout(user, bet);
                    await msg.edit({
                        embeds: [new EmbedBuilder().setTitle('🏇 Horse Race').setDescription('You took too long to pick a horse. Bet refunded.').setColor(0xffff00)],
                        components: [],
                    }).catch(() => {});
                }
            });
            return;
        }

        if (game === 'highlow') {
            await user.save();
            const deck = shuffledDeck();
            let currentCard = deck.pop();
            let multiplier  = 1;

            const hlEmbed = (card, mult, extra = '') => new EmbedBuilder()
                .setTitle('🃏 High / Low')
                .setDescription(
                    `Current card: \`${card.v}${card.s}\`\n` +
                    `Multiplier: **${mult.toFixed(2)}x** - Potential payout: **$${fmt(parseFloat((bet * mult).toFixed(2)))}**\n\n` +
                    (extra || 'Will the next card be higher or lower?')
                )
                .setColor(0x2b2d31);

            const hlButtons = (mult) => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hl_high').setLabel('Higher ▲').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('hl_low').setLabel('Lower ▼').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('hl_cash').setLabel(`Cash Out ($${fmt(parseFloat((bet * mult).toFixed(2)))})`).setStyle(ButtonStyle.Secondary)
            );

            const msg = await interaction.reply({ embeds: [hlEmbed(currentCard, multiplier)], components: [hlButtons(multiplier)], fetchReply: true });

            const cashOut = async (i, mult, timedOut = false) => {
                let payout = parseFloat((bet * mult).toFixed(2));
                if ((user.gamblingBoostExpires ?? 0) > Date.now() && payout > bet) payout = parseFloat((payout * 1.05).toFixed(2));
                user.balance = parseFloat((user.balance + payout).toFixed(2));
                trackWin(user, payout, bet);
                await user.save();
                const embed = new EmbedBuilder().setTitle('🃏 High / Low')
                    .setDescription(timedOut
                        ? `Timed out - auto cashed out at **${mult.toFixed(2)}x**!\nYou received **$${fmt(payout)}**.`
                        : `Cashed out at **${mult.toFixed(2)}x**! You won **$${fmt(payout)}**!`)
                    .setColor(payout > bet ? 0x00ff00 : 0xffff00);
                if (i) await i.update({ embeds: [embed], components: [] });
                else   await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
            };

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });
            collector.on('collect', async i => {
                if (i.customId === 'hl_cash') { collector.stop('done'); await cashOut(i, multiplier); return; }
                const nextCard = deck.pop();
                const currRank = cardRank(currentCard);
                const nextRank = cardRank(nextCard);
                if (nextRank === currRank) {
                    collector.stop('done');
                    trackWin(user, 0, bet);
                    await user.save();
                    await i.update({ embeds: [new EmbedBuilder().setTitle('🃏 High / Low').setDescription(`Next card: \`${nextCard.v}${nextCard.s}\` - Equal! You lost **$${fmt(bet)}**.`).setColor(0xff0000)], components: [] });
                    return;
                }
                const correct = i.customId === 'hl_high' ? nextRank > currRank : nextRank < currRank;
                if (correct) {
                    multiplier  = parseFloat((multiplier * 1.8).toFixed(2));
                    currentCard = nextCard;
                    await i.update({ embeds: [hlEmbed(currentCard, multiplier, `Correct! Keep going or cash out.`)], components: [hlButtons(multiplier)] });
                } else {
                    collector.stop('done');
                    trackWin(user, 0, bet);
                    await user.save();
                    await i.update({ embeds: [new EmbedBuilder().setTitle('🃏 High / Low').setDescription(`Next card: \`${nextCard.v}${nextCard.s}\` - Wrong! You lost **$${fmt(bet)}**.`).setColor(0xff0000)], components: [] });
                }
            });
            collector.on('end', async (_, reason) => { if (reason !== 'done') await cashOut(null, multiplier, true); });
            return;
        }

        if (game === 'scratch') {
            const grid     = Array(3).fill(null).map(() => SCRATCH_SYMBOLS[Math.floor(Math.random() * SCRATCH_SYMBOLS.length)]);
            const counts   = {};
            grid.forEach(s => counts[s] = (counts[s] || 0) + 1);
            const maxMatch = Math.max(...Object.values(counts));

            let scratchWinnings = 0, scratchLine, scratchColor;
            if (maxMatch === 3) {
                scratchWinnings = parseFloat((bet * 10).toFixed(2));
                scratchLine     = `JACKPOT! Three of a kind! You won **$${fmt(scratchWinnings)}**!`;
                scratchColor    = 0xFFD700;
            } else if (maxMatch === 2) {
                scratchWinnings = parseFloat((bet * 2.5).toFixed(2));
                scratchLine     = `Two of a kind! You won **$${fmt(scratchWinnings)}**!`;
                scratchColor    = 0x00ff00;
            } else {
                scratchLine  = `No match. You lost **$${fmt(bet)}**.`;
                scratchColor = 0xff0000;
            }
            ({ winnings: scratchWinnings, text: scratchLine } = applyBoost(user, scratchWinnings, scratchLine));
            user.balance = parseFloat((user.balance + scratchWinnings).toFixed(2));
            trackWin(user, scratchWinnings, bet);
            await user.save();
            await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('🎟️ Scratch Card')
                .setDescription(`${grid.join(' | ')}\n\n${scratchLine}`)
                .addFields({ name: '💵 New Balance', value: `$${fmt(user.balance)}`, inline: true })
                .setColor(scratchColor)] });
        }

        let winnings = 0, title, text, color;

        if (game === 'slots') {
            const spin = [0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
            title = '🎰 Slots';
            if (spin[0] === spin[1] && spin[1] === spin[2]) {
                winnings = parseFloat((bet * 5).toFixed(2));
                text = `${spin.join(' | ')}\n\nJACKPOT! You won **$${fmt(winnings)}**!`;
            } else if (spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2]) {
                winnings = parseFloat((bet * 2).toFixed(2));
                text = `${spin.join(' | ')}\n\nYou won **$${fmt(winnings)}**!`;
            } else {
                text = `${spin.join(' | ')}\n\nYou lost **$${fmt(bet)}**.`;
            }
            color = winnings ? 0x00ff00 : 0xff0000;

        } else if (game === 'dice') {
            const userRoll = Math.floor(Math.random() * 6) + 1;
            const botRoll  = Math.floor(Math.random() * 6) + 1;
            title = '🎲 Dice Roll';
            if (userRoll > botRoll) {
                winnings = parseFloat((bet * 2).toFixed(2));
                text  = `You: **${userRoll}** | Bot: **${botRoll}**\nYou won **$${fmt(winnings)}**!`;
                color = 0x00ff00;
            } else if (userRoll === botRoll) {
                winnings = bet;
                text  = `You: **${userRoll}** | Bot: **${botRoll}**\nTie - bet refunded.`;
                color = 0xffff00;
            } else {
                text  = `You: **${userRoll}** | Bot: **${botRoll}**\nYou lost **$${fmt(bet)}**.`;
                color = 0xff0000;
            }
        }

        if (winnings > 0) ({ winnings, text } = applyBoost(user, winnings, text));
        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        trackWin(user, winnings, bet);
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle(title).setDescription(text).setColor(color)] });
    }
};
