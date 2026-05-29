require('dotenv').config();

const {
    Client,
    Collection,
    GatewayIntentBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder
} = require('discord.js');

const fs = require('fs');
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const Stock = require('./models/Stock');
const User = require('./models/User');
const Portfolio = require('./models/Portfolio');
const { getUser } = require('./utils/economy');

const jackpotLeaderboard = new Map();
const PREFIX = '?';

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);

    setInterval(async () => {
        const stocks = await Stock.find();
        for (const stock of stocks) {
            const change = 1 + (Math.random() * 0.06 - 0.03);
            const newPrice = Math.max(0.01, parseFloat((stock.price * change).toFixed(2)));
            stock.history.push(newPrice);
            if (stock.history.length > 30) stock.history.shift();
            stock.price = newPrice;
            await stock.save();
        }
        console.log('Stock prices updated.');
    }, 30 * 60 * 1000);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    // ?work
    if (commandName === 'work') {
        const COOLDOWN = 5 * 60 * 1000;
        const user = await getUser(message.author.id, message.guild.id);
        const now = Date.now();

        if (user.lastWork && now - user.lastWork < COOLDOWN) {
            const timeLeft = ((COOLDOWN - (now - user.lastWork)) / 1000).toFixed(1);
            return message.reply(`⏳ You need to wait **${timeLeft}s** before working again.`);
        }

        const amount = Math.floor(Math.random() * 76) + 25;
        user.balance += amount;
        user.lastWork = now;
        await user.save();

        const embed = new EmbedBuilder()
            .setTitle('💼 Work Complete')
            .setDescription(`You earned **$${amount}**`)
            .setColor(0x00ff00);
        return message.reply({ embeds: [embed] });
    }

    // ?balance
    if (commandName === 'balance' || commandName === 'bal') {
        const user = await getUser(message.author.id, message.guild.id);
        const embed = new EmbedBuilder()
            .setTitle(`💰 ${message.author.username}'s Balance`)
            .addFields(
                { name: '💵 Wallet', value: `$${user.balance}`, inline: true },
                { name: '🏦 Bank', value: `$${user.bank}`, inline: true }
            )
            .setColor(0x2b2d31);
        return message.reply({ embeds: [embed] });
    }

    // ?deposit <amount>
    if (commandName === 'deposit' || commandName === 'dep') {
        const user = await getUser(message.author.id, message.guild.id);
        const amount = args[0] === 'all' ? user.balance : parseInt(args[0]);
        if (!amount || amount <= 0) return message.reply('❌ Please enter a valid amount.');
        if (amount > user.balance) return message.reply('❌ You don\'t have that much cash.');
        user.balance -= amount;
        user.bank += amount;
        await user.save();
        return message.reply(`✅ Deposited **$${amount}** into your bank.`);
    }

    // ?withdraw <amount>
    if (commandName === 'withdraw' || commandName === 'with') {
        const user = await getUser(message.author.id, message.guild.id);
        const amount = args[0] === 'all' ? user.bank : parseInt(args[0]);
        if (!amount || amount <= 0) return message.reply('❌ Please enter a valid amount.');
        if (amount > user.bank) return message.reply('❌ You don\'t have that much in your bank.');
        user.bank -= amount;
        user.balance += amount;
        await user.save();
        return message.reply(`✅ Withdrew **$${amount}** from your bank.`);
    }

    // ?stocks
    if (commandName === 'stocks') {
        const stocks = await Stock.find().sort({ ticker: 1 });
        const rows = stocks.map(s => {
            const prev = s.history.length >= 2 ? s.history[s.history.length - 2] : s.price;
            const change = s.price - prev;
            const pct = ((change / prev) * 100).toFixed(2);
            const arrow = change > 0 ? '🟢' : change < 0 ? '🔴' : '⚪';
            return `${arrow} \`${s.ticker.padEnd(4)}\` **${s.name}** — $${s.price.toFixed(2)} (${change >= 0 ? '+' : ''}${pct}%)`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('📈 NRG Stock Market')
            .setDescription(rows)
            .setColor(0x00FF99)
            .setFooter({ text: 'Prices update every 30 minutes' })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // ?buystock <TICKER> <shares>
    if (commandName === 'buystock') {
        const ticker = args[0]?.toUpperCase();
        const shares = parseInt(args[1]);
        if (!ticker || !shares || shares <= 0) return message.reply('❌ Usage: `?buystock <TICKER> <shares>`');

        const stock = await Stock.findOne({ ticker });
        if (!stock) return message.reply(`❌ Ticker \`${ticker}\` not found.`);

        const user = await User.findOne({ userId: message.author.id, guildId: message.guild.id });
        if (!user) return message.reply('❌ You have no economy account.');

        const totalCost = parseFloat((stock.price * shares).toFixed(2));
        if (user.balance < totalCost) return message.reply(`❌ You need **$${totalCost.toFixed(2)}** but only have **$${user.balance.toFixed(2)}**.`);

        user.balance = parseFloat((user.balance - totalCost).toFixed(2));
        await user.save();

        let portfolio = await Portfolio.findOne({ userId: message.author.id, guildId: message.guild.id });
        if (!portfolio) portfolio = new Portfolio({ userId: message.author.id, guildId: message.guild.id, holdings: [] });

        const existing = portfolio.holdings.find(h => h.ticker === ticker);
        if (existing) {
            const totalShares = existing.shares + shares;
            existing.avgBuyPrice = parseFloat(((existing.avgBuyPrice * existing.shares + stock.price * shares) / totalShares).toFixed(2));
            existing.shares = totalShares;
        } else {
            portfolio.holdings.push({ ticker, shares, avgBuyPrice: stock.price });
        }
        await portfolio.save();

        const newPrice = parseFloat((stock.price * (1 + 0.002 * shares) * (1 + (Math.random() * 0.02 - 0.01))).toFixed(2));
        stock.history.push(newPrice);
        if (stock.history.length > 30) stock.history.shift();
        stock.price = newPrice;
        stock.totalShares += shares;
        await stock.save();

        const embed = new EmbedBuilder()
            .setTitle('✅ Stock Purchased')
            .setColor(0x00FF99)
            .addFields(
                { name: 'Stock', value: `${stock.name} (\`${ticker}\`)`, inline: true },
                { name: 'Shares', value: `${shares}`, inline: true },
                { name: 'Total Cost', value: `$${totalCost.toFixed(2)}`, inline: true },
                { name: 'New Price', value: `$${newPrice.toFixed(2)}`, inline: true },
                { name: 'Cash Remaining', value: `$${user.balance.toFixed(2)}`, inline: true }
            )
            .setFooter({ text: 'NRG Stock Market' })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // ?sellstock <TICKER> <shares>
    if (commandName === 'sellstock') {
        const ticker = args[0]?.toUpperCase();
        const shares = parseInt(args[1]);
        if (!ticker || !shares || shares <= 0) return message.reply('❌ Usage: `?sellstock <TICKER> <shares>`');

        const stock = await Stock.findOne({ ticker });
        if (!stock) return message.reply(`❌ Ticker \`${ticker}\` not found.`);

        const portfolio = await Portfolio.findOne({ userId: message.author.id, guildId: message.guild.id });
        const holding = portfolio?.holdings.find(h => h.ticker === ticker);
        if (!holding || holding.shares < shares) return message.reply(`❌ You don't have enough shares of \`${ticker}\`.`);

        const totalEarned = parseFloat((stock.price * shares).toFixed(2));
        const profit = parseFloat((totalEarned - holding.avgBuyPrice * shares).toFixed(2));

        holding.shares -= shares;
        if (holding.shares === 0) portfolio.holdings = portfolio.holdings.filter(h => h.ticker !== ticker);
        await portfolio.save();

        const user = await User.findOne({ userId: message.author.id, guildId: message.guild.id });
        user.balance = parseFloat((user.balance + totalEarned).toFixed(2));
        await user.save();

        const newPrice = Math.max(0.01, parseFloat((stock.price * (1 - 0.002 * shares) * (1 + (Math.random() * 0.02 - 0.01))).toFixed(2)));
        stock.history.push(newPrice);
        if (stock.history.length > 30) stock.history.shift();
        stock.price = newPrice;
        stock.totalShares = Math.max(0, stock.totalShares - shares);
        await stock.save();

        const embed = new EmbedBuilder()
            .setTitle('💸 Stock Sold')
            .setColor(profit >= 0 ? 0x00FF99 : 0xFF4500)
            .addFields(
                { name: 'Stock', value: `${stock.name} (\`${ticker}\`)`, inline: true },
                { name: 'Shares Sold', value: `${shares}`, inline: true },
                { name: 'Total Earned', value: `$${totalEarned.toFixed(2)}`, inline: true },
                { name: 'Profit/Loss', value: `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`, inline: true },
                { name: 'New Cash Balance', value: `$${user.balance.toFixed(2)}`, inline: true }
            )
            .setFooter({ text: 'NRG Stock Market' })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // ?portfolio
    if (commandName === 'portfolio') {
        const portfolio = await Portfolio.findOne({ userId: message.author.id, guildId: message.guild.id });
        if (!portfolio || !portfolio.holdings.length) return message.reply('📭 You have no stocks. Use `?buystock` to get started.');

        let totalValue = 0;
        let totalCost = 0;
        const rows = [];

        for (const h of portfolio.holdings) {
            const stock = await Stock.findOne({ ticker: h.ticker });
            if (!stock) continue;
            const currentValue = stock.price * h.shares;
            const costBasis = h.avgBuyPrice * h.shares;
            const profit = currentValue - costBasis;
            totalValue += currentValue;
            totalCost += costBasis;
            const arrow = profit >= 0 ? '🟢' : '🔴';
            rows.push(`${arrow} \`${h.ticker}\` x${h.shares} — $${currentValue.toFixed(2)} (${profit >= 0 ? '+' : ''}$${profit.toFixed(2)})`);
        }

        const totalProfit = totalValue - totalCost;
        const embed = new EmbedBuilder()
            .setTitle(`📊 ${message.author.username}'s Portfolio`)
            .setDescription(rows.join('\n'))
            .setColor(totalProfit >= 0 ? 0x00FF99 : 0xFF4500)
            .addFields(
                { name: 'Total Value', value: `$${totalValue.toFixed(2)}`, inline: true },
                { name: 'Total Profit/Loss', value: `${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}`, inline: true }
            )
            .setFooter({ text: 'NRG Stock Market' })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // ?stockhistory <TICKER>
    if (commandName === 'stockhistory') {
        const ticker = args[0]?.toUpperCase();
        if (!ticker) return message.reply('❌ Usage: `?stockhistory <TICKER>`');

        const stock = await Stock.findOne({ ticker });
        if (!stock) return message.reply(`❌ Ticker \`${ticker}\` not found.`);

        const history = stock.history.slice(-10);
        const chart = history.map((p, i) => {
            const prev = history[i - 1] ?? p;
            const arrow = p > prev ? '📈' : p < prev ? '📉' : '➡️';
            return `${arrow} $${p.toFixed(2)}`;
        }).join('\n');

        const first = history[0];
        const last = history[history.length - 1];
        const overallChange = last - first;
        const overallPct = ((overallChange / first) * 100).toFixed(2);

        const embed = new EmbedBuilder()
            .setTitle(`📋 ${stock.name} (\`${ticker}\`) — Price History`)
            .setDescription(chart || 'No history yet.')
            .setColor(overallChange >= 0 ? 0x00FF99 : 0xFF4500)
            .addFields(
                { name: 'Current Price', value: `$${stock.price.toFixed(2)}`, inline: true },
                { name: 'Overall Change', value: `${overallChange >= 0 ? '+' : ''}${overallPct}%`, inline: true }
            )
            .setFooter({ text: 'Last 10 price points • NRG Stock Market' })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }
});

client.on('interactionCreate', async interaction => {

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction);
    }

    if (interaction.isButton()) {

        if (interaction.customId === 'open_order_modal') {
            const modal = new ModalBuilder()
                .setCustomId('order_modal')
                .setTitle('Order Form');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('website_ip')
                        .setLabel('Website IP')
                        .setStyle(TextInputStyle.Short)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('website_name')
                        .setLabel('Website Name')
                        .setStyle(TextInputStyle.Short)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('filters')
                        .setLabel('List of Filter Links you want')
                        .setStyle(TextInputStyle.Paragraph)
                )
            );
            return interaction.showModal(modal);
        }

        if (interaction.customId.startsWith('respond_')) {
            const userId = interaction.customId.split('_')[1];
            const modal = new ModalBuilder()
                .setCustomId(`response_modal_${userId}`)
                .setTitle(`Send Links`);

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('links')
                        .setLabel('Insert Links here')
                        .setStyle(TextInputStyle.Paragraph)
                )
            );
            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {

        if (interaction.customId === 'order_modal') {
            const ip = interaction.fields.getTextInputValue('website_ip');
            const name = interaction.fields.getTextInputValue('website_name');
            const filters = interaction.fields.getTextInputValue('filters');
            const userId = interaction.user.id;

            await interaction.user.send("Your order has been received. You will get your links soon.");

            const embed = {
                title: `New Order`,
                fields: [
                    { name: "User", value: `<@${userId}>` },
                    { name: "Website IP", value: ip },
                    { name: "Website Name", value: name },
                    { name: "Filters", value: filters }
                ],
                color: 0x2b2d31
            };

            const components = [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            label: "Send Links",
                            style: 1,
                            custom_id: `respond_${userId}`
                        }
                    ]
                }
            ];

            await fetch(process.env.WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ embeds: [embed], components: components })
            });

            return interaction.reply({ content: "Order submitted! Check your DMs.", ephemeral: true });
        }

        if (interaction.customId.startsWith('response_modal_')) {
            const userId = interaction.customId.split('_')[2];
            const links = interaction.fields.getTextInputValue('links');

            try {
                const user = await client.users.fetch(userId);
                await user.send(`📦 Your Order is Ready!\n\n${links}`);
                return interaction.reply({ content: "Links sent to user.", ephemeral: true });
            } catch (err) {
                return interaction.reply({ content: "Failed to DM user.", ephemeral: true });
            }
        }
    }
});

client.login(process.env.TOKEN);
