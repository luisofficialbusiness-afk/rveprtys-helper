const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');
const { grantItem } = require('../../utils/inventory');
const { safeDM } = require('../../utils/Safedm');
const VoteModel = require('./VoteModel');
const { TIERS, getTier, getStreakBonus, getPhaseName, getPhaseColor } = require('./tiers');

const TOPGG_URL = 'https://top.gg/bot/1497674552900321371/vote';
const VOTE_COOLDOWN = 12 * 60 * 60 * 1000;
const STREAK_WINDOW = 36 * 60 * 60 * 1000;

async function getVoteData(userId) {
    let data = await VoteModel.findOne({ userId });
    if (!data) {
        data = new VoteModel({ userId });
        await data.save();
    }
    return data;
}

function formatReward(tier) {
    const parts = [`$${formatNumber(tier.cash)}`];
    for (const item of tier.items) {
        const label = item.id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        parts.push(`${item.qty}x ${label}`);
    }
    return parts.join(', ');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Vote for Economic Bomb on top.gg and earn battlepass rewards')
        .addSubcommand(sub => sub
            .setName('info')
            .setDescription('View your vote battlepass progress and next rewards')
        )
        .addSubcommand(sub => sub
            .setName('claim')
            .setDescription('Claim all unlocked battlepass tier rewards')
        )
        .addSubcommand(sub => sub
            .setName('leaderboard')
            .setDescription('Top voters on Economic Bomb')
        )
        .addSubcommand(sub => sub
            .setName('tiers')
            .setDescription('Browse all 100 battlepass tiers and their rewards')
            .addIntegerOption(o => o
                .setName('page')
                .setDescription('Page number (10 tiers per page)')
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false)
            )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (sub === 'info') {
            const vd = await getVoteData(userId);
            const now = Date.now();
            const canVote = now - vd.lastVoted >= VOTE_COOLDOWN;
            const nextVoteIn = canVote ? null : VOTE_COOLDOWN - (now - vd.lastVoted);
            const currentTier = vd.tier;
            const nextTier = getTier(currentTier + 1);
            const unclaimedCount = TIERS.filter(t => t.tier <= currentTier && !vd.claimedTiers.includes(t.tier)).length;
            const phase = getPhaseName(currentTier + 1);
            const color = getPhaseColor(currentTier + 1);
            const nextMilestone = [10, 25, 50, 75, 100].find(m => m > vd.voteStreak) || null;

            const embed = new EmbedBuilder()
                .setTitle('🗳️ Vote Battlepass')
                .setColor(color)
                .addFields(
                    { name: 'Tier', value: `${currentTier} / 100 - ${phase}`, inline: true },
                    { name: 'Total Votes', value: `${vd.totalVotes}`, inline: true },
                    { name: 'Vote Streak', value: `${vd.voteStreak}`, inline: true },
                );

            if (nextTier) {
                embed.addFields({ name: `Next - Tier ${nextTier.tier}`, value: formatReward(nextTier), inline: false });
            }

            if (unclaimedCount > 0) {
                embed.addFields({ name: 'Unclaimed Tiers', value: `${unclaimedCount} tier${unclaimedCount !== 1 ? 's' : ''} ready to claim - use /vote claim`, inline: false });
            }

            if (nextMilestone) {
                const left = nextMilestone - vd.voteStreak;
                embed.addFields({ name: 'Next Streak Milestone', value: `${left} more vote${left !== 1 ? 's' : ''} to reach ${nextMilestone} streak bonus`, inline: false });
            }

            if (canVote) {
                embed.setDescription(`Ready to vote. Every vote advances your battlepass.\n\n**[Vote on top.gg](${TOPGG_URL})**`);
            } else {
                const h = Math.floor(nextVoteIn / 3600000);
                const m = Math.ceil((nextVoteIn % 3600000) / 60000);
                embed.setDescription(`Next vote available in **${h}h ${m}m**.\n\n**[top.gg](${TOPGG_URL})**`);
            }

            embed.setFooter({ text: 'Votes process automatically when you vote on top.gg' });
            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'claim') {
            const vd = await getVoteData(userId);
            const unclaimed = TIERS.filter(t => t.tier <= vd.tier && !vd.claimedTiers.includes(t.tier));

            if (!unclaimed.length)
                return interaction.reply({ content: '❌ No unclaimed tiers. Vote on top.gg to unlock more.', ephemeral: true });

            await interaction.deferReply();

            const user = await getUser(userId);
            let totalCash = 0;
            const itemsGranted = {};

            for (const tier of unclaimed) {
                totalCash += tier.cash;
                for (const item of tier.items) {
                    grantItem(user, item.id, item.qty);
                    itemsGranted[item.id] = (itemsGranted[item.id] || 0) + item.qty;
                }
                vd.claimedTiers.push(tier.tier);
            }

            user.balance += totalCash;
            await user.save();
            await vd.save();

            const highestClaimed = unclaimed[unclaimed.length - 1];
            const phase = getPhaseName(highestClaimed.tier);
            const color = getPhaseColor(highestClaimed.tier);

            const itemLines = Object.entries(itemsGranted).map(([id, qty]) => {
                const label = id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                return `${qty}x ${label}`;
            });

            const embed = new EmbedBuilder()
                .setTitle(`✅ Claimed ${unclaimed.length} Tier${unclaimed.length !== 1 ? 's' : ''}`)
                .setColor(color)
                .addFields(
                    { name: 'Cash Received', value: `$${formatNumber(totalCash)}`, inline: true },
                    { name: 'New Balance', value: `$${formatNumber(user.balance)}`, inline: true },
                    { name: 'Current Tier', value: `${vd.tier} - ${phase}`, inline: true },
                );

            if (itemLines.length)
                embed.addFields({ name: 'Items Received', value: itemLines.join('\n'), inline: false });

            if (highestClaimed.final)
                embed.addFields({ name: '💣 DETONATOR', value: 'You have reached Tier 100. Maximum battlepass progression achieved.', inline: false });

            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'leaderboard') {
            const top = await VoteModel.find({}).sort({ totalVotes: -1 }).limit(10);
            if (!top.length)
                return interaction.reply({ content: 'No votes recorded yet.', ephemeral: true });

            const lines = top.map((v, i) => {
                const rank = i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}th`;
                return `**${rank}** - <@${v.userId}> - ${v.totalVotes} votes - Tier ${v.tier} - Streak ${v.voteStreak}`;
            });

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🏆 Vote Leaderboard')
                    .setDescription(lines.join('\n'))
                    .setColor(0xFFD700)
                    .setFooter({ text: 'Vote every 12 hours on top.gg to climb the ranks.' })]
            });
        }

        if (sub === 'tiers') {
            const page = interaction.options.getInteger('page') || 1;
            const start = (page - 1) * 10 + 1;
            const end = start + 9;
            const vd = await getVoteData(userId);
            const pageTiers = TIERS.filter(t => t.tier >= start && t.tier <= end);

            const lines = pageTiers.map(t => {
                const claimed = vd.claimedTiers.includes(t.tier);
                const unlocked = t.tier <= vd.tier;
                const status = claimed ? 'Claimed' : unlocked ? 'Ready' : `${t.tier - vd.tier} votes away`;
                const tag = t.final ? ' DETONATOR' : t.milestone ? ' MILESTONE' : '';
                return `**Tier ${t.tier}${tag}** - ${formatReward(t)} - *${status}*`;
            }).join('\n');

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(`🎖️ Battlepass Tiers - Page ${page}/10`)
                    .setDescription(lines)
                    .setColor(getPhaseColor(start))
                    .setFooter({ text: `Phase: ${getPhaseName(start)} - Your tier: ${vd.tier}` })]
            });
        }
    }
};
