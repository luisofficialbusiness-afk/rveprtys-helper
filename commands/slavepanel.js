const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../utils/economy');
const Slave = require('../models/Slave');

const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slavepanel')
        .setDescription('Manage the users you own'),

    async execute(interaction) {
        const slaves = await Slave.find({ ownerId: interaction.user.id, guildId: interaction.guild.id });
        if (!slaves.length)
            return interaction.reply({ content: "❌ You don't own anyone.", ephemeral: true });

        for (let i = 0; i < slaves.length; i++) {
            const slave     = slaves[i];
            const slaveEcon = await getUser(slave.userId, interaction.guild.id);

            const embed = new EmbedBuilder()
                .setTitle(`Slave: <@${slave.userId}>`)
                .addFields(
                    { name: 'Debt Remaining',       value: `$${fmt(slave.debt)}`,        inline: true },
                    { name: 'Total Earned for You', value: `$${fmt(slave.totalEarned)}`, inline: true },
                    { name: 'Their Balance',        value: `$${fmt(slaveEcon.balance)}`, inline: true }
                )
                .setColor(0xFF4500)
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`slave_free_${slave.userId}`).setLabel('Set Free').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`slave_renew_${slave.userId}`).setLabel('Renew (Double Debt)').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`slave_check_${slave.userId}`).setLabel('Refresh Stats').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`slave_takepay_${slave.userId}`).setLabel('Take Payment').setStyle(ButtonStyle.Primary)
            );

            const payload = { embeds: [embed], components: [row] };
            if (i === 0) await interaction.reply(payload);
            else await interaction.followUp(payload);
        }
    }
};
