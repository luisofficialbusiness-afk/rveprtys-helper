const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../utils/economy');
const Portfolio = require('../models/portfolio');

const PRESTIGE_LEVELS = [
    { level: 1, cost: 500_000,    multiplier: 1.1,  label: 'Bronze',   color: 0xcd7f32 },
    { level: 2, cost: 1_000_000,  multiplier: 1.25, label: 'Silver',   color: 0xc0c0c0 },
    { level: 3, cost: 5_000_000,  multiplier: 1.5,  label: 'Gold',     color: 0xffd700 },
    { level: 4, cost: 10_000_000, multiplier: 1.85, label: 'Platinum', color: 0xe5e4e2 },
    { level: 5, cost: 25_000_000, multiplier: 2.3,  label: 'Diamond',  color: 0xb9f2ff },
    { level: 6, cost: 50_000_000, multiplier: 3.0,  label: 'Obsidian', color: 0x1a1a2e }
];

const PRESTIGE_BADGES = ['', '🥉', '🥈', '🥇', '💠', '💎', '🖤'];

function getPrestige(level) {
    return PRESTIGE_LEVELS.find(p => p.level === level) || null;
}

module.exports = {
    PRESTIGE_LEVELS,
    getPrestige,

    data: new SlashCommandBuilder()
        .setName('prestige')
        .setDescription('View your prestige status or prestige up')
        .addSubcommand(sub => sub
            .setName('view')
            .setDescription('View all prestige levels and your current status'))
        .addSubcommand(sub => sub
            .setName('up')
            .setDescription('Prestige up — WARNING: resets everything')),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const sub = interaction.options.getSubcommand();
        const user = await getUser(userId, guildId);
        const currentLevel = user.prestigeLevel || 0;
        const current = getPrestige(currentLevel);
        const next = getPrestige(currentLevel + 1);

        if (sub === 'view') {
            const lines = PRESTIGE_LEVELS.map(p => {
                const done = currentLevel >= p.level;
                const isNext = currentLevel + 1 === p.level;
                return `${done ? '✅' : isNext ? '▶' : '⬜'} ${PRESTIGE_BADGES[p.level]} **${p.label}** — $${p.cost.toLocaleString()} | x${p.multiplier} multiplier`;
            }).join('\n');

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Prestige — Economic Bomb Industries')
                    .setDescription(
                        (currentLevel > 0
                            ? `You are **${PRESTIGE_BADGES[currentLevel]} ${current.label} Prestige ${currentLevel}** with a **x${current.multiplier}** multiplier.\n\n`
                            : `You have not prestiged yet.\n\n`)
                        + lines
                        + (next ? `\n\nNext prestige costs **$${next.cost.toLocaleString()}** total (wallet + bank).` : '\n\n**You have reached max prestige!**')
                    )
                    .setColor(current?.color || 0xFFD700)
                    .setFooter({ text: 'Prestiging resets your balance, bank, job, and stocks' })]
            });
        }

        if (sub === 'up') {
            if (currentLevel >= 6) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('Max Prestige Reached')
                        .setDescription('You are already at **🖤 Obsidian Prestige 6** — the highest level.')
                        .setColor(0x71717a)],
                    ephemeral: true
                });
            }

            const totalBalance = user.balance + user.bank;
            if (totalBalance < next.cost) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('Insufficient Funds')
                        .setDescription(`You need **$${next.cost.toLocaleString()}** (wallet + bank combined) to reach **${next.label} Prestige ${next.level}**.\nYou currently have **$${totalBalance.toLocaleString()}**.`)
                        .setColor(0xff0000)],
                    ephemeral: true
                });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`prestige_confirm_${userId}_${guildId}`)
                    .setLabel('Yes, Prestige Up')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`prestige_cancel_${userId}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('⚠️ Prestige Confirmation')
                    .setDescription(
                        `You are about to prestige to **${PRESTIGE_BADGES[next.level]} ${next.label} Prestige ${next.level}**.\n\n` +
                        `**This will permanently reset:**\n` +
                        `> Your wallet & bank balance\n` +
                        `> Your entire stock portfolio\n` +
                        `> Your job\n\n` +
                        `**You will receive:**\n` +
                        `> A permanent **x${next.multiplier}** work multiplier\n` +
                        `> The **${next.label}** prestige title ${PRESTIGE_BADGES[next.level]}\n\n` +
                        `**Cost: $${next.cost.toLocaleString()}**\n\n` +
                        `Are you absolutely sure?`
                    )
                    .setColor(0xff4500)],
                components: [row]
            });
        }
    }
};
