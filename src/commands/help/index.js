const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isAdmin } = require('../../utils/auth');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('View all available commands'),

    async execute(interaction) {
        const admin = isAdmin(interaction);

        const embed = new EmbedBuilder()
            .setTitle('Economic Bomb - Commands')
            .setColor(0x2b2d31)
            .addFields(
                {
                    name: 'Economy',
                    value: '`/bank balance` `/bank deposit` `/bank withdraw`\n`/give` `/daily` `/beg` `/lottery`',
                    inline: false,
                },
                {
                    name: 'Jobs',
                    value: '`/work work` - do your corporate job\n`/work jobs` - browse corporate jobs\n`/work apply` - apply for a corporate job (tiers 1-9)',
                    inline: false,
                },
                {
                    name: 'Activities',
                    value: '`/fish` - go fishing (requires rod from shop)\n`/mine` - go mining (requires pickaxe from shop)\n`/stream` - start a livestream (requires keyboard, mouse & camera)\n`/crime` - commit a random crime\n`/search <location>` - search for money\n`/rob <user>` - rob someone\n`/duel <user>` - challenge someone to a duel\n`/shop browse` `/shop buy`',
                    inline: false,
                },
                {
                    name: 'Gambling',
                    value: '`/gamble game:Slots`\n`/gamble game:Coinflip`\n`/gamble game:Dice`\n`/gamble game:Roulette`\n`/gamble game:Blackjack`\n`/gamble game:High / Low`\n`/gamble game:Crash`\n`/gamble game:Horse Race`\n`/gamble game:Mines`\n`/gamble game:Baccarat`',
                    inline: false,
                },
                {
                    name: 'Stocks',
                    value: '`/stock list` `/stock buy` `/stock sell` `/stock portfolio` `/stock history`',
                    inline: false,
                },
                {
                    name: 'Leaderboard',
                    value: '`/leaderboard`',
                    inline: false,
                },
                {
                    name: 'Slave System',
                    value: '`/slave buy` `/slave sell` `/slave outbid` `/slave status` `/slave panel` `/slave list`',
                    inline: false,
                },
                {
                    name: 'Profile',
                    value: '`/prestige` - reset and gain a permanent earn multiplier\n`/settings` - toggle DMs and other preferences',
                    inline: false,
                },
            )
            .setFooter({ text: 'Economic Bomb • All commands also work with the ? prefix' });

        if (admin) {
            embed.addFields({
                name: 'Owner Only',
                value: '`/owner give` `/owner setbalance` `/owner setbank` `/owner stats` `/owner userinfo` `/owner jackpot` `/owner reseteconomy` `/owner clearcooldowns` `/owner setupmarket` `/owner stockfix` `/owner removestock` `/owner bounty` `/owner dm` `/owner panel`',
                inline: false,
            });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
