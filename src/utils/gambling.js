const CARD_VALS       = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS           = ['♠','♥','♦','♣'];
const SYMBOLS         = ['🍒', '🍋', '🍉', '⭐', '💎', '🍀'];
const RED_NUMS        = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

const HORSES = [
    { name: 'Thunderbolt', emoji: '⚡',  odds: 1.8  },
    { name: 'Lucky Star',  emoji: '⭐',  odds: 2.5  },
    { name: 'Iron Hooves', emoji: '🦾',  odds: 3.5  },
    { name: 'Dark Shadow', emoji: '🌑',  odds: 5.0  },
    { name: 'Wild Spirit', emoji: '🌪️', odds: 7.5  },
    { name: 'Long Shot',   emoji: '🎯',  odds: 12.0 },
];

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

function baccaratVal(card) {
    if (['10','J','Q','K'].includes(card.v)) return 0;
    if (card.v === 'A') return 1;
    return parseInt(card.v);
}

function baccaratTotal(hand) {
    return hand.reduce((s, c) => s + baccaratVal(c), 0) % 10;
}

function trackWin(user, winnings, bet) {
    user.gamblingWinnings = parseFloat(((user.gamblingWinnings ?? 0) + winnings - bet).toFixed(2));
}

module.exports = {
    CARD_VALS, SUITS, SYMBOLS, RED_NUMS, HORSES,
    shuffledDeck, cardPoints, handTotal, showHand, cardRank,
    baccaratVal, baccaratTotal, trackWin,
};
