const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');
const Slave = require('../models/Slave');

const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Start an auction to purchase a user as a slave')
        .addUserOption(o =>
            o.setName('user').setDescription('User to buy').setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('user');

        if (target.id === interaction.user.id) return interaction.reply({ content: "❌ You can't buy yourself.", ephemeral: true });
        if (target.bot)                         return interaction.reply({ content: "❌ You can't buy a bot.", ephemeral: true });

        const buyer       = await getUser(interaction.user.id, interaction.guild.id);
        const targetEcon  = await getUser(target.id,           interaction.guild.id);
        const existingSlave = await Slave.findOne({ userId: target.id, guildId: interaction.guild.id });

        if (existingSlave?.ownerId)
            return interaction.reply({ content: `❌ <@${target.id}> is already owned by <@${existingSlave.ownerId}>.`, ephemeral: true });

        const buyPrice = parseFloat((targetEcon.balance * 2).toFixed(2));
        if (buyPrice <= 0) return interaction.reply({ content: '❌ This person has no balance to determine a price.', ephemeral: true });
        if (buyer.balance < buyPrice)
            return interaction.reply({ content: `❌ You need **$${fmt(buyPrice)}** to buy <@${target.id}> but only have **$${fmt(buyer.balance)}**.`, ephemeral: true });

        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Auction Started!')
            .setDescription(
                `<@${interaction.user.id}> wants to buy <@${target.id}> for **$${fmt(buyPrice)}**!\n\n` +
                `<@${target.id}> you have **2 minutes** to escape by typing \`?outbid <amount>\` with more than **$${fmt(buyPrice)}**.`
            )
            .setColor(0xFF4500)
            .setTimestamp()] });

        const collector = interaction.channel.createMessageCollector({
            filter: m => m.author.id === target.id && m.content.toLowerCase().startsWith('?outbid'),
            time: 120000,
            max: 1
        });

        collector.on('collect', async m => {
            const outbidAmount = parseFloat(m.content.split(/\s+/)[1]);
            if (!outbidAmount || outbidAmount <= buyPrice)
                return m.reply(`❌ You need to outbid more than **$${fmt(buyPrice)}**.`);
            const fresh = await getUser(target.id, interaction.guild.id);
            if (fresh.balance < outbidAmount)
                return m.reply(`❌ You don't have **$${fmt(outbidAmount)}** to outbid.`);
            collector.stop('outbid');
            return m.reply({ embeds: [new EmbedBuilder()
                .setTitle('Purchase Blocked!')
                .setDescription(`<@${target.id}> outbid with **$${fmt(outbidAmount)}** and avoided being bought!`)
                .setColor(0x00FF99)] });
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'outbid') return;

            const freshBuyer = await getUser(interaction.user.id, interaction.guild.id);
            freshBuyer.balance = parseFloat((freshBuyer.balance - buyPrice).toFixed(2));
            await freshBuyer.save();

            let slave = await Slave.findOne({ userId: target.id, guildId: interaction.guild.id });
            if (!slave) slave = new Slave({ userId: target.id, guildId: interaction.guild.id });
            slave.ownerId     = interaction.user.id;
            slave.debt        = parseFloat((buyPrice * 2).toFixed(2));
            slave.totalEarned = 0;
            await slave.save();

            await interaction.followUp({ embeds: [new EmbedBuilder()
                .setTitle('Purchase Complete!')
                .setDescription(
                    `<@${interaction.user.id}> has bought <@${target.id}> for **$${fmt(buyPrice)}**!\n\n` +
                    `<@${target.id}> must earn **$${fmt(buyPrice * 2)}** to be free.`
                )
                .setColor(0xFF0000)
                .setTimestamp()] });

            try {
                await target.send({ embeds: [new EmbedBuilder()
                    .setTitle('You Have Been Bought!')
                    .setDescription(`<@${interaction.user.id}> purchased you for **$${fmt(buyPrice)}**. You must earn **$${fmt(buyPrice * 2)}** to be free.`)
                    .setColor(0xFF0000)] });
            } catch {}
        });
    }
};
