const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { hasItem } = require('../../utils/inventory');
const { TIERS, ORES } = require('./data');

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getTier(totalWealth) {
    let tier = TIERS[0];
    for (const t of TIERS) { if (totalWealth >= t.min) tier = t; }
    return tier;
}

function getPickaxeMultiplier(user) {
    if (hasItem(user, 'pickaxe_diamond')) return 1.45;
    if (hasItem(user, 'pickaxe_iron'))    return 1.20;
    return 1.0;
}

function buildTiles(dist) {
    const tiles = [];
    for (const [type, count] of Object.entries(dist)) {
        for (let i = 0; i < count; i++) tiles.push(type);
    }
    for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    return tiles;
}

function buildGrid(tiles, revealed, earned, gameOver, done = false) {
    const rows = [];
    for (let r = 0; r < 4; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 4; c++) {
            const idx = r * 4 + c;
            const btn = new ButtonBuilder().setCustomId(`ore_${idx}`).setStyle(ButtonStyle.Secondary);
            if (revealed[idx]) {
                const ore = ORES[tiles[idx]];
                btn.setEmoji(ore.emoji)
                    .setStyle(tiles[idx] === 'cavein' ? ButtonStyle.Danger : tiles[idx] === 'empty' ? ButtonStyle.Secondary : ButtonStyle.Success)
                    .setDisabled(true);
            } else {
                btn.setEmoji('🟫').setDisabled(done || gameOver);
            }
            row.addComponents(btn);
        }
        rows.push(row);
    }
    if (!done && !gameOver) {
        rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mine_cashout')
                .setLabel(`Cash Out ($${formatNumber(earned)})`)
                .setStyle(ButtonStyle.Primary)
        ));
    }
    return rows;
}

function buildPanel(title, body, footer, gridRows) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
    if (footer) {
        container
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
    }
    for (const row of gridRows) {
        container.addActionRowComponents(row);
    }
    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

module.exports = { rand, getTier, getPickaxeMultiplier, buildTiles, buildGrid, buildPanel };
