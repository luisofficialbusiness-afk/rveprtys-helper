const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../utils/economy');
const { formatNumber } = require('../utils/format');
const cooldowns = require('../utils/cooldowns');

const COOLDOWN = 30 * 60 * 1000;

const TIERS = {
    surface: { label: 'Surface Mine', dist: { empty: 6, coal: 5, iron: 3, gold: 2, ruby: 0, diamond: 0, cavein: 0 } },
    cave:    { label: 'Cave',         dist: { empty: 4, coal: 4, iron: 3, gold: 2, ruby: 1, diamond: 0, cavein: 2 } },
    deep:    { label: 'Deep Cave',    dist: { empty: 2, coal: 3, iron: 3, gold: 3, ruby: 2, diamond: 1, cavein: 2 } },
    magma:   { label: 'Magma Core',   dist: { empty: 1, coal: 2, iron: 2, gold: 3, ruby: 3, diamond: 2, cavein: 3 } },
};

const ORES = {
    empty:   { emoji: '⬛', label: 'Empty',    min: 0,      max: 0      },
    coal:    { emoji: '⚫', label: 'Coal',     min: 50,     max: 200    },
    iron:    { emoji: '⬜', label: 'Iron',     min: 200,    max: 600    },
    gold:    { emoji: '🟡', label: 'Gold',     min: 800,    max: 2500   },
    ruby:    { emoji: '🔴', label: 'Ruby',     min: 3000,   max: 9000   },
    diamond: { emoji: '💎', label: 'Diamond',  min: 15000,  max: 50000  },
    cavein:  { emoji: '💥', label: 'Cave-in',  min: 0,      max: 0      },
};

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildTiles(tier) {
    const tiles = [];
    for (const [type, count] of Object.entries(TIERS[tier].dist)) {
        for (let i = 0; i < count; i++) tiles.push(type);
    }
    for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    return tiles;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mine')
        .setDescription('Go mining for ore')
        .addStringOption(o =>
            o.setName('tier').setDescription('Mine tier').setRequired(true)
                .addChoices(
                    { name: 'Surface (safe, low value)',      value: 'surface' },
                    { name: 'Cave (some risk, better ore)',   value: 'cave'    },
                    { name: 'Deep Cave (risky, great ore)',   value: 'deep'    },
                    { name: 'Magma Core (extreme, rare ore)', value: 'magma'   },
                )
        ),

    async execute(interaction) {
        const tier  = interaction.options.getString('tier');
        const now   = Date.now();

        if (cooldowns.mine.has(interaction.user.id)) {
            const exp = cooldowns.mine.get(interaction.user.id) + COOLDOWN;
            if (now < exp) {
                const totalSecs = Math.ceil((exp - now) / 1000);
                const m = Math.floor(totalSecs / 60), s = totalSecs % 60;
                return interaction.reply({ content: `⏳ Your tools need to recover. Try again in **${m}m ${s}s**.`, ephemeral: true });
            }
        }
        cooldowns.mine.set(interaction.user.id, now);

        const config   = TIERS[tier];
        const tiles    = buildTiles(tier);
        const revealed = Array(16).fill(false);
        let earned     = 0;
        let caveins    = 0;
        let gameOver   = false;

        const buildGrid = (done = false) => {
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
        };

        const mineEmbed = (state = 'mining') => {
            if (state === 'mining') return new EmbedBuilder()
                .setTitle(`Mining - ${config.label}`)
                .setDescription(
                    `Ore found: **$${formatNumber(earned)}**` +
                    (caveins > 0 ? ` | Cave-ins: **${caveins}** (-25% each)` : '') +
                    '\n\nClick tiles to mine. Cash out anytime.'
                )
                .setColor(0x8B4513);
            if (state === 'cashout') return new EmbedBuilder()
                .setTitle(`Mining Complete - ${config.label}`)
                .setDescription(`You hauled **$${formatNumber(earned)}** worth of ore out of the ${config.label}.`)
                .setColor(0x00cc44);
            if (state === 'cleared') return new EmbedBuilder()
                .setTitle(`Mine Cleared! - ${config.label}`)
                .setDescription(`You mined every ore vein in the ${config.label}!\nTotal haul: **$${formatNumber(earned)}**`)
                .setColor(0xFFD700);
            if (state === 'timeout') return new EmbedBuilder()
                .setTitle(`Session Expired - ${config.label}`)
                .setDescription(`Mining session timed out. Ore collected: **$${formatNumber(earned)}**`)
                .setColor(0x71717a);
        };

        const finish = async (state, j = null) => {
            gameOver = true;
            gameCollector.stop(state);
            if (earned > 0) {
                const user = await getUser(interaction.user.id, interaction.guild.id);
                user.balance = parseFloat((user.balance + earned).toFixed(2));
                await user.save();
                const embed = mineEmbed(state).addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true });
                if (j) await j.update({ embeds: [embed], components: buildGrid(true) });
                else await msg.edit({ embeds: [embed], components: buildGrid(true) }).catch(() => {});
            } else {
                const embed = mineEmbed(state);
                if (j) await j.update({ embeds: [embed], components: buildGrid(true) });
                else await msg.edit({ embeds: [embed], components: buildGrid(true) }).catch(() => {});
            }
        };

        const msg = await interaction.reply({ embeds: [mineEmbed()], components: buildGrid(), fetchReply: true });

        const gameCollector = msg.createMessageComponentCollector({
            filter: j => j.user.id === interaction.user.id,
            time: 300000,
        });

        gameCollector.on('collect', async j => {
            if (gameOver) return;

            if (j.customId === 'mine_cashout') { await finish('cashout', j); return; }

            if (!j.customId.startsWith('ore_')) return;
            const idx = parseInt(j.customId.split('_')[1]);
            if (revealed[idx]) return;
            revealed[idx] = true;

            const type = tiles[idx];

            if (type === 'cavein') {
                caveins++;
                earned = Math.max(0, Math.floor(earned * 0.75));
                await j.update({ embeds: [mineEmbed()], components: buildGrid() });
                return;
            }

            const ore = ORES[type];
            if (ore.max > 0) earned += rand(ore.min, ore.max);

            const allMined = tiles.every((t, i) => t === 'empty' || t === 'cavein' || revealed[i]);
            if (allMined) { await finish('cleared', j); return; }

            await j.update({ embeds: [mineEmbed()], components: buildGrid() });
        });

        gameCollector.on('end', async (_, reason) => {
            if (!gameOver) await finish('timeout');
        });
    }
};
