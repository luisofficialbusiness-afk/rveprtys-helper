const TIERS = [
    { tier: 1,   cash: 2500,    items: [] },
    { tier: 2,   cash: 2500,    items: [{ id: 'fishing_bait', qty: 3 }] },
    { tier: 3,   cash: 3000,    items: [] },
    { tier: 4,   cash: 3000,    items: [{ id: 'fishing_bait', qty: 5 }] },
    { tier: 5,   cash: 5000,    items: [{ id: 'fishing_rod_wooden', qty: 1 }] },
    { tier: 6,   cash: 4000,    items: [] },
    { tier: 7,   cash: 4000,    items: [{ id: 'fishing_bait', qty: 5 }] },
    { tier: 8,   cash: 5000,    items: [] },
    { tier: 9,   cash: 5000,    items: [{ id: 'fishing_bait', qty: 8 }] },
    { tier: 10,  cash: 10000,   items: [{ id: 'pickaxe_wooden', qty: 1 }], milestone: true },

    { tier: 11,  cash: 6000,    items: [] },
    { tier: 12,  cash: 6000,    items: [{ id: 'fishing_bait', qty: 8 }] },
    { tier: 13,  cash: 7500,    items: [] },
    { tier: 14,  cash: 7500,    items: [{ id: 'fishing_bait', qty: 10 }] },
    { tier: 15,  cash: 10000,   items: [{ id: 'fishing_rod_basic', qty: 1 }] },
    { tier: 16,  cash: 8000,    items: [] },
    { tier: 17,  cash: 8000,    items: [{ id: 'fishing_bait', qty: 10 }] },
    { tier: 18,  cash: 9000,    items: [] },
    { tier: 19,  cash: 9000,    items: [{ id: 'fishing_bait', qty: 12 }] },
    { tier: 20,  cash: 20000,   items: [{ id: 'pickaxe_basic', qty: 1 }], milestone: true },

    { tier: 21,  cash: 10000,   items: [] },
    { tier: 22,  cash: 10000,   items: [{ id: 'fishing_bait', qty: 12 }] },
    { tier: 23,  cash: 12000,   items: [] },
    { tier: 24,  cash: 12000,   items: [{ id: 'fishing_bait', qty: 15 }] },
    { tier: 25,  cash: 15000,   items: [{ id: 'fishing_rod_upgraded', qty: 1 }], milestone: true },
    { tier: 26,  cash: 13000,   items: [] },
    { tier: 27,  cash: 13000,   items: [{ id: 'fishing_bait', qty: 15 }] },
    { tier: 28,  cash: 14000,   items: [] },
    { tier: 29,  cash: 14000,   items: [{ id: 'fishing_bait', qty: 18 }] },
    { tier: 30,  cash: 30000,   items: [{ id: 'pickaxe_iron', qty: 1 }], milestone: true },

    { tier: 31,  cash: 15000,   items: [] },
    { tier: 32,  cash: 15000,   items: [{ id: 'fishing_bait', qty: 18 }] },
    { tier: 33,  cash: 17500,   items: [] },
    { tier: 34,  cash: 17500,   items: [{ id: 'fishing_bait', qty: 20 }] },
    { tier: 35,  cash: 20000,   items: [{ id: 'fishing_rod_upgraded', qty: 1 }] },
    { tier: 36,  cash: 18000,   items: [] },
    { tier: 37,  cash: 18000,   items: [{ id: 'fishing_bait', qty: 20 }] },
    { tier: 38,  cash: 20000,   items: [] },
    { tier: 39,  cash: 20000,   items: [{ id: 'fishing_bait', qty: 25 }] },
    { tier: 40,  cash: 50000,   items: [{ id: 'lifesaver', qty: 1 }], milestone: true },

    { tier: 41,  cash: 22000,   items: [] },
    { tier: 42,  cash: 22000,   items: [{ id: 'fishing_bait', qty: 25 }] },
    { tier: 43,  cash: 25000,   items: [] },
    { tier: 44,  cash: 25000,   items: [{ id: 'fishing_bait', qty: 25 }] },
    { tier: 45,  cash: 30000,   items: [{ id: 'fishing_rod_super', qty: 1 }] },
    { tier: 46,  cash: 27000,   items: [] },
    { tier: 47,  cash: 27000,   items: [{ id: 'fishing_bait', qty: 30 }] },
    { tier: 48,  cash: 30000,   items: [] },
    { tier: 49,  cash: 30000,   items: [{ id: 'fishing_bait', qty: 30 }] },
    { tier: 50,  cash: 75000,   items: [{ id: 'pickaxe_diamond', qty: 1 }], milestone: true },

    { tier: 51,  cash: 32000,   items: [] },
    { tier: 52,  cash: 32000,   items: [{ id: 'fishing_bait', qty: 30 }] },
    { tier: 53,  cash: 35000,   items: [] },
    { tier: 54,  cash: 35000,   items: [{ id: 'fishing_bait', qty: 35 }] },
    { tier: 55,  cash: 40000,   items: [{ id: 'fishing_rod_super', qty: 1 }] },
    { tier: 56,  cash: 37000,   items: [] },
    { tier: 57,  cash: 37000,   items: [{ id: 'fishing_bait', qty: 35 }] },
    { tier: 58,  cash: 40000,   items: [] },
    { tier: 59,  cash: 40000,   items: [{ id: 'fishing_bait', qty: 40 }] },
    { tier: 60,  cash: 100000,  items: [{ id: 'lifesaver', qty: 2 }], milestone: true },

    { tier: 61,  cash: 45000,   items: [] },
    { tier: 62,  cash: 45000,   items: [{ id: 'fishing_bait', qty: 40 }] },
    { tier: 63,  cash: 50000,   items: [] },
    { tier: 64,  cash: 50000,   items: [{ id: 'fishing_bait', qty: 40 }] },
    { tier: 65,  cash: 60000,   items: [{ id: 'fishing_rod_legendary', qty: 1 }] },
    { tier: 66,  cash: 55000,   items: [] },
    { tier: 67,  cash: 55000,   items: [{ id: 'fishing_bait', qty: 50 }] },
    { tier: 68,  cash: 60000,   items: [] },
    { tier: 69,  cash: 60000,   items: [{ id: 'fishing_bait', qty: 50 }] },
    { tier: 70,  cash: 150000,  items: [{ id: 'pickaxe_netherite', qty: 1 }], milestone: true },

    { tier: 71,  cash: 65000,   items: [] },
    { tier: 72,  cash: 65000,   items: [{ id: 'fishing_bait', qty: 50 }] },
    { tier: 73,  cash: 70000,   items: [] },
    { tier: 74,  cash: 70000,   items: [{ id: 'fishing_bait', qty: 60 }] },
    { tier: 75,  cash: 80000,   items: [{ id: 'fishing_rod_legendary', qty: 1 }], milestone: true },
    { tier: 76,  cash: 75000,   items: [] },
    { tier: 77,  cash: 75000,   items: [{ id: 'fishing_bait', qty: 60 }] },
    { tier: 78,  cash: 80000,   items: [] },
    { tier: 79,  cash: 80000,   items: [{ id: 'fishing_bait', qty: 70 }] },
    { tier: 80,  cash: 200000,  items: [{ id: 'lifesaver', qty: 3 }], milestone: true },

    { tier: 81,  cash: 90000,   items: [] },
    { tier: 82,  cash: 90000,   items: [{ id: 'fishing_bait', qty: 70 }] },
    { tier: 83,  cash: 100000,  items: [] },
    { tier: 84,  cash: 100000,  items: [{ id: 'fishing_bait', qty: 75 }] },
    { tier: 85,  cash: 120000,  items: [{ id: 'fishing_rod_legendary', qty: 1 }] },
    { tier: 86,  cash: 110000,  items: [] },
    { tier: 87,  cash: 110000,  items: [{ id: 'fishing_bait', qty: 75 }] },
    { tier: 88,  cash: 120000,  items: [] },
    { tier: 89,  cash: 120000,  items: [{ id: 'fishing_bait', qty: 80 }] },
    { tier: 90,  cash: 300000,  items: [{ id: 'pickaxe_netherite', qty: 1 }, { id: 'lifesaver', qty: 2 }], milestone: true },

    { tier: 91,  cash: 130000,  items: [] },
    { tier: 92,  cash: 130000,  items: [{ id: 'fishing_bait', qty: 80 }] },
    { tier: 93,  cash: 150000,  items: [] },
    { tier: 94,  cash: 150000,  items: [{ id: 'fishing_bait', qty: 90 }] },
    { tier: 95,  cash: 175000,  items: [{ id: 'fishing_rod_legendary', qty: 1 }], milestone: true },
    { tier: 96,  cash: 160000,  items: [] },
    { tier: 97,  cash: 160000,  items: [{ id: 'fishing_bait', qty: 90 }] },
    { tier: 98,  cash: 175000,  items: [] },
    { tier: 99,  cash: 200000,  items: [{ id: 'fishing_bait', qty: 100 }, { id: 'lifesaver', qty: 3 }], milestone: true },
    { tier: 100, cash: 1000000, items: [{ id: 'fishing_rod_legendary', qty: 1 }, { id: 'pickaxe_netherite', qty: 1 }, { id: 'fishing_bait', qty: 100 }, { id: 'lifesaver', qty: 5 }], milestone: true, final: true },
];

const STREAK_BONUSES = [
    { at: 10,  bonus: 15000,  label: '10 Vote Streak' },
    { at: 25,  bonus: 40000,  label: '25 Vote Streak' },
    { at: 50,  bonus: 100000, label: '50 Vote Streak' },
    { at: 75,  bonus: 200000, label: '75 Vote Streak' },
    { at: 100, bonus: 500000, label: '100 Vote Streak' },
];

function getTier(tierNum) {
    return TIERS.find(t => t.tier === tierNum) || null;
}

function getStreakBonus(streak) {
    return STREAK_BONUSES.find(s => s.at === streak) || null;
}

function getPhaseName(tier) {
    if (tier <= 20)  return 'Rookie';
    if (tier <= 40)  return 'Hustler';
    if (tier <= 60)  return 'Operator';
    if (tier <= 80)  return 'Elite';
    if (tier <= 99)  return 'Legend';
    return 'Detonator';
}

function getPhaseColor(tier) {
    if (tier <= 20)  return 0x71717a;
    if (tier <= 40)  return 0x60a5fa;
    if (tier <= 60)  return 0x00cc44;
    if (tier <= 80)  return 0xFF4500;
    if (tier <= 99)  return 0xFFD700;
    return 0xeab308;
}

module.exports = { TIERS, STREAK_BONUSES, getTier, getStreakBonus, getPhaseName, getPhaseColor };
