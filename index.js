require('dotenv').config();

const {
    Client,
    Collection,
    GatewayIntentBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const fs = require('fs');
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const Stock = require('./models/Stock');
const Portfolio = require('./models/Portfolio');
const User = require('./models/User');
const Slave = require('./models/Slave');
const { getUser } = require('./utils/economy');
const Config = require('./models/Config');

const PREFIX   = '?';
const OWNER_ID = '1453078748080504996';
const isAdmin  = (member) => member.permissions.has('Administrator') || member.id === OWNER_ID;
const MAX_BALANCE = 999_999_999_999_999;

const fmt    = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n).toLocaleString('en-US');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => { console.error(err); process.exit(1); });

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

const COMPANIES = [
    { ticker: 'VLR',  name: 'Velera Inc',           price: 142.50 },
    { ticker: 'FRGS', name: "Frogiee's Arcade",      price: 34.20  },
    { ticker: 'DOGE', name: 'Doge UB',               price: 0.85   },
    { ticker: 'CHRI', name: 'Cherri Inc',             price: 58.00  },
    { ticker: 'TGLC', name: 'TGLSC Corp',             price: 210.00 },
    { ticker: 'GNMT', name: 'Gn Math',               price: 76.40  },
    { ticker: 'CNOS', name: 'Cine OS',               price: 99.99  },
    { ticker: 'OVCL', name: 'Overcloaked Corp',       price: 185.30 },
    { ticker: 'TRFL', name: 'Truffled Inc',           price: 47.60  },
    { ticker: 'LNR',  name: 'LUNAR Research Inc',     price: 320.00 },
    { ticker: 'VOID', name: 'Void Network Corp',      price: 5.55   },
    { ticker: 'HDR',  name: 'Hydra Network Corp',     price: 88.88  },
    { ticker: 'NRGX', name: 'NRG Exchange',           price: 500.00 },
    { ticker: 'PLSM', name: 'Plasma Dynamics Inc',    price: 63.75  },
    { ticker: 'ZRTH', name: 'Zeroth Systems',         price: 112.00 },
];

async function seedMarket(guildId) {
    for (const c of COMPANIES) {
        await Stock.findOneAndUpdate(
            { guildId, ticker: c.ticker },
            { guildId, ...c, history: [c.price], totalShares: 0 },
            { upsert: true, new: true }
        );
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    setInterval(async () => {
        const stocks = await Stock.find();
        for (const stock of stocks) {
            const change   = 1 + (Math.random() * 0.06 - 0.03);
            const newPrice = Math.max(0.01, parseFloat((stock.price * change).toFixed(2)));
            stock.history.push(newPrice);
            if (stock.history.length > 30) stock.history.shift();
            stock.price = newPrice;
            await stock.save();
        }
        console.log('Stock prices updated.');
    }, 30 * 60 * 1000);
});

client.on('guildCreate', async guild => {
    console.log(`Joined new guild: ${guild.name} (${guild.id})`);
    try {
        await seedMarket(guild.id);
        console.log(`Seeded stocks for ${guild.name}`);
    } catch (e) {
        console.error(`Failed to seed stocks for ${guild.name}:`, e);
    }

    const welcomeEmbed = new EmbedBuilder()
        .setTitle('💣 Economic Bomb has arrived!')
        .setDescription(
            `Thanks for adding **Economic Bomb** to your server!\n\n` +
            `The stock market has been automatically set up with **15 companies**.\n\n` +
            `**Getting started:**\n` +
            `> \`?help\` — view all commands\n` +
            `> \`?stocks\` — view the stock market\n` +
            `> \`?work\` — start earning money\n` +
            `> \`?daily\` — claim your daily reward\n\n` +
            `**Admin commands:**\n` +
            `> \`?setupmarket\` — re-seed the stock market anytime\n` +
            `> Dashboard: https://economicbomb.nrglearning.xyz`
        )
        .setColor(0xFFD700)
        .setFooter({ text: 'Economic Bomb • Use ?help for all commands' });

    try {
        const ch = guild.systemChannel ?? guild.channels.cache
            .filter(c => c.type === 0 && c.permissionsFor(guild.members.me)?.has('SendMessages'))
            .sort((a, b) => a.position - b.position).first();
        if (ch) await ch.send({ embeds: [welcomeEmbed] });
    } catch {}
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args  = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd   = args.shift().toLowerCase();
    const now   = Date.now();
    const guildId = message.guild.id;

    // ── Config helpers ──────────────────────────────────────────────
    const config        = await Config.findOne({ guildId }) || {};
    const modules       = config.modules       || {};
    const bannedUsers   = config.bannedUsers   || [];
    const allowedChannels = config.allowedChannels || [];

    if (allowedChannels.length > 0 && !allowedChannels.includes(message.channel.id)) return;

    const banEntry = bannedUsers.find(b => b.userId === message.author.id);
    if (banEntry) {
        return message.reply({ embeds: [new EmbedBuilder()
            .setTitle('You Are Banned')
            .setDescription(`You have been banned from using this bot.\n**Reason:** ${banEntry.reason || 'No reason given'}`)
            .setColor(0xff0000)] });
    }

    const MODULE_MAP = {
        work:        ['work'],
        rob:         ['rob'],
        coinflip:    ['coinflip', 'cf'],
        dice:        ['dice'],
        slots:       ['slots'],
        duel:        ['duel'],
        stocks:      ['stocks', 'buystock', 'sellstock', 'portfolio', 'port', 'stockhistory', 'sh'],
        slave:       ['buy', 'outbid', 'slave', 'slavepanel', 'slavelist'],
        givemoney:   ['givemoney', 'give'],
        deposit:     ['deposit', 'dep'],
        withdraw:    ['withdraw', 'with'],
        leaderboard: ['leaderboard', 'lb', 'bankleaderboard', 'blb']
    };
    for (const [mod, cmds] of Object.entries(MODULE_MAP)) {
        if (cmds.includes(cmd) && modules[mod] === false) {
            return message.reply({ embeds: [new EmbedBuilder()
                .setTitle('Feature Disabled')
                .setDescription(`The \`?${cmd}\` command is currently disabled in this server.`)
                .setColor(0x71717a)] });
        }
    }

    // ── Adapter: wraps a message into a slash-command-like object ───
    const adapt = (opts = {}) => ({
        user:   message.author,
        guild:  message.guild,
        member: message.member,
        channel: message.channel,
        client,
        options: {
            getUser:    n => opts.getUser?.(n)    ?? null,
            getInteger: n => opts.getInteger?.(n) ?? null,
            getString:  n => opts.getString?.(n)  ?? null,
            getNumber:  n => opts.getNumber?.(n)  ?? null,
        },
        reply:    d => message.reply(d),
        followUp: d => message.channel.send(d),
    });

    // ── Delegated commands ──────────────────────────────────────────

    if (cmd === 'balance' || cmd === 'bal')
        return client.commands.get('balance').execute(adapt());

    if (cmd === 'work')
        return client.commands.get('work').execute(adapt());

    if (cmd === 'deposit' || cmd === 'dep')
        return client.commands.get('deposit').execute(adapt({
            getString: n => n === 'amount' ? args[0] : null,
        }));

    if (cmd === 'withdraw' || cmd === 'with')
        return client.commands.get('withdraw').execute(adapt({
            getString: n => n === 'amount' ? args[0] : null,
        }));

    if (cmd === 'givemoney' || cmd === 'give')
        return client.commands.get('givemoney').execute(adapt({
            getUser:    n => n === 'user'   ? message.mentions.users.first() : null,
            getInteger: n => n === 'amount' ? parseInt(args[1])              : null,
        }));

    if (cmd === 'coinflip' || cmd === 'cf') {
        const choice = ['h', 'heads'].includes(args[1]?.toLowerCase()) ? 'heads'
                     : ['t', 'tails'].includes(args[1]?.toLowerCase()) ? 'tails'
                     : args[1] ?? null;
        return client.commands.get('coinflip').execute(adapt({
            getInteger: n => n === 'bet'    ? parseFloat(args[0]) : null,
            getString:  n => n === 'choice' ? choice              : null,
        }));
    }

    if (cmd === 'dice')
        return client.commands.get('dice').execute(adapt({
            getInteger: n => n === 'bet' ? parseFloat(args[0]) : null,
        }));

    if (cmd === 'slots')
        return client.commands.get('slots').execute(adapt({
            getInteger: n => n === 'bet' ? parseFloat(args[0]) : null,
        }));

    if (cmd === 'rob')
        return client.commands.get('rob').execute(adapt({
            getUser: n => n === 'target' ? message.mentions.users.first() : null,
        }));

    if (cmd === 'duel')
        return client.commands.get('duel').execute(adapt({
            getUser:   n => n === 'opponent' ? message.mentions.users.first() : null,
            getString: n => n === 'bet'      ? args[1]                        : null,
        }));

    if (cmd === 'leaderboard' || cmd === 'lb' || cmd === 'bankleaderboard' || cmd === 'blb') {
        const loc = (cmd === 'bankleaderboard' || cmd === 'blb') ? 'bank'
            : (['bank', 'wallet'].includes(args[0]?.toLowerCase()) ? args[0].toLowerCase() : 'both');
        return client.commands.get('leaderboard').execute(adapt({
            getString: n => n === 'location' ? loc : null,
        }));
    }

    if (cmd === 'ogive')
        return client.commands.get('ogive').execute(adapt({
            getUser:   n => n === 'user'   ? message.mentions.users.first() : null,
            getNumber: n => n === 'amount' ? parseFloat(args[1])            : null,
        }));

    if (cmd === 'osetbalance' || cmd === 'osetbal')
        return client.commands.get('osetbalance').execute(adapt({
            getUser:   n => n === 'user'   ? message.mentions.users.first() : null,
            getNumber: n => n === 'amount' ? parseFloat(args[1])            : null,
        }));

    if (cmd === 'osetbank')
        return client.commands.get('osetbank').execute(adapt({
            getUser:   n => n === 'user'   ? message.mentions.users.first() : null,
            getNumber: n => n === 'amount' ? parseFloat(args[1])            : null,
        }));

    if (cmd === 'oeconomystats' || cmd === 'ostats')
        return client.commands.get('oeconomystats').execute(adapt());

    if (cmd === 'ouserinfo')
        return client.commands.get('ouserinfo').execute(adapt({
            getUser: n => n === 'user' ? message.mentions.users.first() : null,
        }));

    if (cmd === 'ojackpotdrop')
        return client.commands.get('ojackpotdrop').execute(adapt({
            getNumber: n => n === 'amount' ? parseFloat(args[0]) : null,
        }));

    if (cmd === 'oresetleaderboard' || cmd === 'oreset')
        return client.commands.get('oresetleaderboard').execute(adapt());

    if (cmd === 'clearcooldowns')
        return client.commands.get('clearcooldowns').execute(adapt());

    // ────────────────────────────────────────────────────────────
    // ?stocks
    // ────────────────────────────────────────────────────────────
    if (cmd === 'stocks') {
        const stocks = await Stock.find({ guildId }).sort({ ticker: 1 });
        if (!stocks.length) return message.reply('❌ No stocks set up yet. An admin can run `?setupmarket` to initialize the market.');
        const rows = stocks.map(s => {
            const prev   = s.history.length >= 2 ? s.history[s.history.length - 2] : s.price;
            const change = s.price - prev;
            const pct    = ((change / prev) * 100).toFixed(2);
            const arrow  = change > 0 ? '▲' : change < 0 ? '▼' : '—';
            return `${arrow} \`${s.ticker.padEnd(4)}\` **${s.name}** — $${fmt(s.price)} (${change >= 0 ? '+' : ''}${pct}%)`;
        }).join('\n');
        return message.reply({ embeds: [new EmbedBuilder()
            .setTitle('Stock Market')
            .setDescription(rows)
            .setColor(0x00FF99)
            .setFooter({ text: 'Prices update every 30 minutes' })
            .setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?buystock <TICKER> <shares|max>
    // ────────────────────────────────────────────────────────────
    if (cmd === 'buystock') {
        const ticker = args[0]?.toUpperCase();
        if (!ticker) return message.reply('❌ Usage: `?buystock <TICKER> <shares|max>`');
        const stock = await Stock.findOne({ guildId, ticker });
        if (!stock) return message.reply(`❌ Ticker \`${ticker}\` not found.`);
        const user = await User.findOne({ userId: message.author.id, guildId });
        if (!user) return message.reply('❌ You have no economy account.');

        let shares;
        if (!args[1] || args[1].toLowerCase() === 'max') {
            shares = Math.floor(user.balance / stock.price);
            if (shares <= 0) return message.reply(`❌ You can't afford even 1 share of \`${ticker}\` at $${fmt(stock.price)}.`);
        } else {
            shares = parseInt(args[1]);
            if (isNaN(shares) || shares <= 0) return message.reply('❌ Shares must be a whole number.');
        }

        const totalCost = parseFloat((stock.price * shares).toFixed(2));
        if (user.balance < totalCost) return message.reply(`❌ You need **$${fmt(totalCost)}** but only have **$${fmt(user.balance)}**.`);

        user.balance = parseFloat((user.balance - totalCost).toFixed(2));
        await user.save();

        let portfolio = await Portfolio.findOne({ userId: message.author.id, guildId });
        if (!portfolio) portfolio = new Portfolio({ userId: message.author.id, guildId, holdings: [] });
        const existing = portfolio.holdings.find(h => h.ticker === ticker);
        if (existing) {
            const totalShares = existing.shares + shares;
            existing.avgBuyPrice = parseFloat(((existing.avgBuyPrice * existing.shares + stock.price * shares) / totalShares).toFixed(2));
            existing.shares = totalShares;
        } else {
            portfolio.holdings.push({ ticker, shares, avgBuyPrice: stock.price });
        }
        await portfolio.save();

        const buyImpact = 1 + Math.min(shares / Math.max(stock.totalShares + shares, 10000), 0.1) * 0.5;
        stock.price = Math.min(parseFloat((stock.price * buyImpact).toFixed(2)), 999999);
        stock.totalShares += shares;
        await stock.save();

        return message.reply({ embeds: [new EmbedBuilder().setTitle('Stock Purchased').setColor(0x00FF99).addFields(
            { name: 'Stock',           value: `${stock.name} (\`${ticker}\`)`, inline: true },
            { name: 'Shares',          value: `${fmtInt(shares)}`,             inline: true },
            { name: 'Price Per Share', value: `$${fmt(stock.price)}`,          inline: true },
            { name: 'Total Cost',      value: `$${fmt(totalCost)}`,            inline: true },
            { name: 'Cash Remaining',  value: `$${fmt(user.balance)}`,         inline: true }
        ).setFooter({ text: 'Economic Bomb Stock Market' }).setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?sellstock <TICKER> <shares|all>
    // ────────────────────────────────────────────────────────────
    if (cmd === 'sellstock') {
        const ticker = args[0]?.toUpperCase();
        if (!ticker) return message.reply('❌ Usage: `?sellstock <TICKER> <shares|all>`');
        const stock = await Stock.findOne({ guildId, ticker });
        if (!stock) return message.reply(`❌ Ticker \`${ticker}\` not found.`);
        const portfolio = await Portfolio.findOne({ userId: message.author.id, guildId });
        const holding   = portfolio?.holdings.find(h => h.ticker === ticker);
        if (!holding || holding.shares <= 0) return message.reply(`❌ You don't hold any shares of \`${ticker}\`.`);

        let shares;
        if (!args[1] || args[1].toLowerCase() === 'all') {
            shares = holding.shares;
        } else {
            shares = parseInt(args[1]);
            if (isNaN(shares) || shares <= 0) return message.reply('❌ Shares must be a whole number.');
        }
        if (shares > holding.shares) return message.reply(`❌ You only have **${fmtInt(holding.shares)}** shares of \`${ticker}\`.`);

        const totalEarned = parseFloat((stock.price * shares).toFixed(2));
        const profit      = parseFloat((totalEarned - holding.avgBuyPrice * shares).toFixed(2));

        holding.shares -= shares;
        if (holding.shares === 0) portfolio.holdings = portfolio.holdings.filter(h => h.ticker !== ticker);
        await portfolio.save();

        const user = await User.findOne({ userId: message.author.id, guildId });
        user.balance = parseFloat((user.balance + totalEarned).toFixed(2));
        await user.save();

        const sellImpact = Math.min(shares / Math.max(stock.totalShares, 10000), 0.1) * 0.5;
        const newPrice   = Math.max(parseFloat((stock.price * (1 - sellImpact)).toFixed(2)), 0.01);
        stock.price      = newPrice;
        stock.totalShares = Math.max(0, stock.totalShares - shares);
        await stock.save();

        return message.reply({ embeds: [new EmbedBuilder().setTitle('Stock Sold').setColor(profit >= 0 ? 0x00FF99 : 0xFF4500).addFields(
            { name: 'Stock',            value: `${stock.name} (\`${ticker}\`)`,      inline: true },
            { name: 'Shares Sold',      value: `${fmtInt(shares)}`,                  inline: true },
            { name: 'Price Per Share',  value: `$${fmt(stock.price)}`,               inline: true },
            { name: 'Total Earned',     value: `$${fmt(totalEarned)}`,               inline: true },
            { name: 'Profit/Loss',      value: `${profit >= 0 ? '+' : ''}$${fmt(profit)}`, inline: true },
            { name: 'New Cash Balance', value: `$${fmt(user.balance)}`,              inline: true }
        ).setFooter({ text: 'Economic Bomb Stock Market' }).setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?portfolio / ?port
    // ────────────────────────────────────────────────────────────
    if (cmd === 'portfolio' || cmd === 'port') {
        const portfolio = await Portfolio.findOne({ userId: message.author.id, guildId });
        if (!portfolio || !portfolio.holdings.length) return message.reply('📭 You have no stocks. Use `?buystock` to get started.');
        let totalValue = 0, totalCost = 0;
        const rows = [];
        for (const h of portfolio.holdings) {
            const stock = await Stock.findOne({ guildId, ticker: h.ticker });
            if (!stock) continue;
            const currentValue = stock.price * h.shares;
            const costBasis    = h.avgBuyPrice * h.shares;
            const profit       = currentValue - costBasis;
            totalValue += currentValue;
            totalCost  += costBasis;
            const arrow = profit >= 0 ? '▲' : '▼';
            rows.push(`${arrow} \`${h.ticker}\` x${fmtInt(h.shares)} — $${fmt(currentValue)} (${profit >= 0 ? '+' : ''}$${fmt(profit)})`);
        }
        const totalProfit = totalValue - totalCost;
        return message.reply({ embeds: [new EmbedBuilder()
            .setTitle(`${message.author.username}'s Portfolio`)
            .setDescription(rows.join('\n'))
            .setColor(totalProfit >= 0 ? 0x00FF99 : 0xFF4500)
            .addFields(
                { name: 'Total Value',       value: `$${fmt(totalValue)}`,  inline: true },
                { name: 'Total Profit/Loss', value: `${totalProfit >= 0 ? '+' : ''}$${fmt(totalProfit)}`, inline: true }
            )
            .setFooter({ text: 'Economic Bomb Stock Market' })
            .setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?stockhistory / ?sh
    // ────────────────────────────────────────────────────────────
    if (cmd === 'stockhistory' || cmd === 'sh') {
        const ticker = args[0]?.toUpperCase();
        if (!ticker) return message.reply('❌ Usage: `?stockhistory <TICKER>`');
        const stock = await Stock.findOne({ guildId, ticker });
        if (!stock) return message.reply(`❌ Ticker \`${ticker}\` not found.`);
        const history = stock.history.slice(-10);
        const chart = history.map((p, i) => {
            const prev  = history[i - 1] ?? p;
            const arrow = p > prev ? '▲' : p < prev ? '▼' : '—';
            return `${arrow} $${fmt(p)}`;
        }).join('\n');
        const first = history[0], last = history[history.length - 1];
        const overallChange = last - first;
        const overallPct    = ((overallChange / first) * 100).toFixed(2);
        return message.reply({ embeds: [new EmbedBuilder()
            .setTitle(`${stock.name} (\`${ticker}\`) — Price History`)
            .setDescription(chart || 'No history yet.')
            .setColor(overallChange >= 0 ? 0x00FF99 : 0xFF4500)
            .addFields(
                { name: 'Current Price',   value: `$${fmt(stock.price)}`,                         inline: true },
                { name: 'Overall Change',  value: `${overallChange >= 0 ? '+' : ''}${overallPct}%`, inline: true }
            )
            .setFooter({ text: 'Last 10 price points' })
            .setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?buy @user — slave purchase
    // ────────────────────────────────────────────────────────────
    if (cmd === 'buy') {
        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Usage: `?buy @user`');
        if (target.id === message.author.id) return message.reply("❌ You can't buy yourself.");
        if (target.bot) return message.reply("❌ You can't buy a bot.");
        const buyer       = await getUser(message.author.id, guildId);
        const targetEcon  = await getUser(target.id, guildId);
        const existingSlave = await Slave.findOne({ userId: target.id, guildId });
        if (existingSlave?.ownerId) return message.reply(`❌ <@${target.id}> is already owned by <@${existingSlave.ownerId}>.`);
        const buyPrice = parseFloat((targetEcon.balance * 2).toFixed(2));
        if (buyPrice <= 0) return message.reply('❌ This person has no balance to determine a price.');
        if (buyer.balance < buyPrice) return message.reply(`❌ You need **$${fmt(buyPrice)}** to buy <@${target.id}> but only have **$${fmt(buyer.balance)}**.`);

        await message.channel.send({ embeds: [new EmbedBuilder()
            .setTitle('Auction Started!')
            .setDescription(`<@${message.author.id}> wants to buy <@${target.id}> for **$${fmt(buyPrice)}**!\n\n<@${target.id}> you have **2 minutes** to escape by typing \`?outbid <amount>\` with more than **$${fmt(buyPrice)}**.`)
            .setColor(0xFF4500)
            .setTimestamp()] });

        const collector = message.channel.createMessageCollector({ filter: m => m.author.id === target.id && m.content.toLowerCase().startsWith('?outbid'), time: 120000, max: 1 });
        collector.on('collect', async m => {
            const outbidAmount = parseFloat(m.content.split(/\s+/)[1]);
            if (!outbidAmount || outbidAmount <= buyPrice) return m.reply(`❌ You need to outbid more than **$${fmt(buyPrice)}**.`);
            const fresh = await getUser(target.id, guildId);
            if (fresh.balance < outbidAmount) return m.reply(`❌ You don't have **$${fmt(outbidAmount)}** to outbid.`);
            collector.stop('outbid');
            return m.reply({ embeds: [new EmbedBuilder().setTitle('Purchase Blocked!').setDescription(`<@${target.id}> outbid with **$${fmt(outbidAmount)}** and avoided being bought!`).setColor(0x00FF99)] });
        });
        collector.on('end', async (_, reason) => {
            if (reason === 'outbid') return;
            const freshBuyer = await getUser(message.author.id, guildId);
            freshBuyer.balance = parseFloat((freshBuyer.balance - buyPrice).toFixed(2));
            await freshBuyer.save();
            let slave = await Slave.findOne({ userId: target.id, guildId });
            if (!slave) slave = new Slave({ userId: target.id, guildId });
            slave.ownerId     = message.author.id;
            slave.debt        = parseFloat((buyPrice * 2).toFixed(2));
            slave.totalEarned = 0;
            await slave.save();
            await message.channel.send({ embeds: [new EmbedBuilder().setTitle('Purchase Complete!').setDescription(`<@${message.author.id}> has bought <@${target.id}> for **$${fmt(buyPrice)}**!\n\n<@${target.id}> must earn **$${fmt(buyPrice * 2)}** to be free.`).setColor(0xFF0000).setTimestamp()] });
            try { await target.send({ embeds: [new EmbedBuilder().setTitle('You Have Been Bought!').setDescription(`<@${message.author.id}> purchased you for **$${fmt(buyPrice)}**. You must earn **$${fmt(buyPrice * 2)}** to be free.`).setColor(0xFF0000)] }); } catch {}
        });
    }

    // ────────────────────────────────────────────────────────────
    // ?slave
    // ────────────────────────────────────────────────────────────
    if (cmd === 'slave') {
        const slave = await Slave.findOne({ userId: message.author.id, guildId });
        if (!slave?.ownerId) return message.reply('✅ You are a free person.');
        return message.reply({ embeds: [new EmbedBuilder()
            .setTitle('Your Slave Status')
            .setDescription(`You are owned by <@${slave.ownerId}>`)
            .addFields(
                { name: 'Debt Remaining',          value: `$${fmt(slave.debt)}`,        inline: true },
                { name: 'Total Earned for Owner',  value: `$${fmt(slave.totalEarned)}`, inline: true }
            )
            .setColor(0xFF0000)
            .setFooter({ text: 'Keep working to pay off your debt!' })
            .setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?slavepanel
    // ────────────────────────────────────────────────────────────
    if (cmd === 'slavepanel') {
        const slaves = await Slave.find({ ownerId: message.author.id, guildId });
        if (!slaves.length) return message.reply("❌ You don't own anyone.");
        for (const slave of slaves) {
            const slaveEcon = await getUser(slave.userId, guildId);
            const embed = new EmbedBuilder()
                .setTitle(`Slave: <@${slave.userId}>`)
                .addFields(
                    { name: 'Debt Remaining',        value: `$${fmt(slave.debt)}`,        inline: true },
                    { name: 'Total Earned for You',  value: `$${fmt(slave.totalEarned)}`, inline: true },
                    { name: 'Their Current Balance', value: `$${fmt(slaveEcon.balance)}`, inline: true }
                )
                .setColor(0xFF4500)
                .setTimestamp();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`slave_free_${slave.userId}`).setLabel('Set Free').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`slave_renew_${slave.userId}`).setLabel('Renew (Double Debt)').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`slave_check_${slave.userId}`).setLabel('Refresh Stats').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`slave_takepay_${slave.userId}`).setLabel('Take Payment').setStyle(ButtonStyle.Primary)
            );
            await message.channel.send({ embeds: [embed], components: [row] });
        }
    }

    // ────────────────────────────────────────────────────────────
    // ?daily
    // ────────────────────────────────────────────────────────────
    if (cmd === 'daily') {
        const user     = await getUser(message.author.id, guildId);
        const COOLDOWN = 24 * 60 * 60 * 1000;
        if (user.lastDaily && now - user.lastDaily < COOLDOWN) {
            const left = COOLDOWN - (now - user.lastDaily);
            const h = Math.floor(left / 3600000);
            const m = Math.floor((left % 3600000) / 60000);
            const s = Math.floor((left % 60000) / 1000);
            return message.reply({ embeds: [new EmbedBuilder()
                .setTitle('Daily Already Claimed')
                .setDescription(`Come back in **${h}h ${m}m ${s}s**.`)
                .setColor(0x2b2d31)] });
        }
        const streak = user.dailyStreak && user.lastDaily && (now - user.lastDaily < 48 * 60 * 60 * 1000) ? user.dailyStreak + 1 : 1;
        const amount  = 200 + Math.min(streak - 1, 30) * 25;
        user.lastDaily    = now;
        user.dailyStreak  = streak;
        user.balance      = parseFloat((user.balance + amount).toFixed(2));
        await user.save();
        return message.reply({ embeds: [new EmbedBuilder()
            .setTitle('Daily Reward')
            .setDescription(`You claimed your daily reward!`)
            .addFields(
                { name: 'Amount',      value: `$${fmtInt(amount)}`,               inline: true },
                { name: 'Streak',      value: `${streak} day${streak !== 1 ? 's' : ''}`, inline: true },
                { name: 'New Balance', value: `$${fmt(user.balance)}`,            inline: true }
            )
            .setColor(0xFFD700)
            .setFooter({ text: streak >= 7 ? 'Hot streak! Keep it going!' : 'Come back tomorrow for a streak bonus!' })] });
    }

    // ────────────────────────────────────────────────────────────
    // ?setupmarket
    // ────────────────────────────────────────────────────────────
    if (cmd === 'setupmarket') {
        if (!isAdmin(message.member)) return message.reply('❌ You need Administrator permission.');
        await seedMarket(guildId);
        return message.reply({ embeds: [new EmbedBuilder()
            .setTitle('Market Initialized')
            .setDescription(`Successfully seeded **${COMPANIES.length} stocks** for this server.\nUse \`?stocks\` to view the market.`)
            .setColor(0x00FF99)
            .setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?slavelist
    // ────────────────────────────────────────────────────────────
    if (cmd === 'slavelist') {
        const slaves = await Slave.find({ guildId, ownerId: { $ne: null } });
        if (!slaves.length) return message.reply('No active slaves in this server.');
        const ownerMap = {};
        for (const s of slaves) ownerMap[s.ownerId] = (ownerMap[s.ownerId] || 0) + 1;
        const sorted = Object.entries(ownerMap).sort((a, b) => b[1] - a[1]);
        const lines  = sorted.map(([ownerId, count], i) => `**${i + 1}.** <@${ownerId}> — ${count} slave${count !== 1 ? 's' : ''}`);
        return message.reply({ embeds: [new EmbedBuilder()
            .setTitle('Slave Leaderboard')
            .setDescription(lines.join('\n'))
            .setColor(0xFF4500)] });
    }

    // ────────────────────────────────────────────────────────────
    // ?ostockfix
    // ────────────────────────────────────────────────────────────
    if (cmd === 'ostockfix') {
        if (!isAdmin(message.member)) return;
        const stocks = await Stock.find({ guildId });
        if (!stocks.length) return message.reply('❌ No stocks found. Run `?setupmarket` first.');
        const results = [];
        for (const stock of stocks) {
            const oldPrice = stock.price;
            const change   = 1 + (Math.random() * 0.06 - 0.03);
            const newPrice = Math.max(0.01, parseFloat((stock.price * change).toFixed(2)));
            stock.history.push(newPrice);
            if (stock.history.length > 30) stock.history.shift();
            stock.price = newPrice;
            await stock.save();
            const diff = newPrice - oldPrice;
            const pct  = ((diff / oldPrice) * 100).toFixed(2);
            results.push(`${diff >= 0 ? '▲' : '▼'} \`${stock.ticker}\` $${fmt(oldPrice)} → $${fmt(newPrice)} (${diff >= 0 ? '+' : ''}${pct}%)`);
        }
        return message.reply({ embeds: [new EmbedBuilder()
            .setTitle('Stock Market Manually Ticked')
            .setDescription(results.join('\n'))
            .setColor(0x00FF99)
            .setFooter({ text: 'Same logic as the 30-minute auto tick' })
            .setTimestamp()] });
    }

    // ────────────────────────────────────────────────────────────
    // ?oremovestock @user <TICKER>
    // ────────────────────────────────────────────────────────────
    if (cmd === 'oremovestock') {
        if (!isAdmin(message.member)) return;
        const targetId = message.mentions.users.first()?.id;
        const ticker   = args[1]?.toUpperCase();
        if (!targetId || !ticker) return message.reply('❌ Usage: `?oremovestock @user <TICKER>`');
        const portfolio = await Portfolio.findOne({ userId: targetId, guildId });
        if (!portfolio) return message.reply('❌ User has no portfolio.');
        const before = portfolio.holdings.length;
        portfolio.holdings = portfolio.holdings.filter(h => h.ticker !== ticker);
        if (portfolio.holdings.length === before) return message.reply(`❌ <@${targetId}> doesn't hold \`${ticker}\`.`);
        await portfolio.save();
        return message.reply(`✅ Removed all \`${ticker}\` shares from <@${targetId}>'s portfolio.`);
    }

    // ────────────────────────────────────────────────────────────
    // ?help
    // ────────────────────────────────────────────────────────────
    if (cmd === 'help') {
        const admin = isAdmin(message.member);
        const embed = new EmbedBuilder()
            .setTitle('Economic Bomb — Commands')
            .setColor(0x2b2d31)
            .addFields(
                { name: 'Economy',     value: '`?balance` `?deposit <amount|all>` `?withdraw <amount|all>` `?givemoney @user <amount>` `?work` `?daily`', inline: false },
                { name: 'Gambling',    value: '`?coinflip <bet> <h|t>` `?dice <bet>` `?slots <bet>` `?rob @user` `?duel @user [bet|all]`', inline: false },
                { name: 'Stocks',      value: '`?stocks` `?buystock <TICKER> <shares|max>` `?sellstock <TICKER> <shares|all>` `?portfolio` `?stockhistory <TICKER>`', inline: false },
                { name: 'Leaderboard', value: '`?leaderboard [bank|wallet]`', inline: false },
                { name: 'Slave System', value: '`?buy @user` `?slave` `?slavepanel` `?slavelist`', inline: false }
            )
            .setFooter({ text: 'Economic Bomb' });

        if (admin) {
            embed.addFields({ name: 'Admin Only', value: '`?ogive` `?osetbalance` `?osetbank` `?oresetleaderboard` `?oeconomystats` `?ouserinfo` `?ojackpotdrop` `?clearcooldowns` `?setupmarket` `?ostockfix` `?oremovestock`', inline: false });
        }

        return message.reply({ embeds: [embed] });
    }
});

// ── Interaction handler ────────────────────────────────────────────
client.on('interactionCreate', async interaction => {

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction);
    }

    if (interaction.isButton()) {
        const guildId = interaction.guild.id;

        if (interaction.customId.startsWith('slave_free_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave    = await Slave.findOne({ userId: targetId, guildId });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            slave.ownerId = null; slave.debt = 0; slave.totalEarned = 0;
            await slave.save();
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Slave Freed').setDescription(`<@${targetId}> has been set free.`).setColor(0x00FF99)] });
            try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('You Are Free!').setDescription(`<@${interaction.user.id}> has set you free.`).setColor(0x00FF99)] }); } catch {}
        }

        if (interaction.customId.startsWith('slave_renew_')) {
            const targetId  = interaction.customId.split('_')[2];
            const slave     = await Slave.findOne({ userId: targetId, guildId });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            const renewCost = parseFloat((slave.debt / 2).toFixed(2));
            const owner     = await getUser(interaction.user.id, guildId);
            if (owner.balance < renewCost) return interaction.reply({ content: `❌ You need **$${fmt(renewCost)}** to renew but only have **$${fmt(owner.balance)}**.`, ephemeral: true });
            owner.balance = parseFloat((owner.balance - renewCost).toFixed(2));
            await owner.save();
            const oldDebt = slave.debt;
            slave.debt    = parseFloat((slave.debt * 2).toFixed(2));
            await slave.save();
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Debt Renewed').setDescription(`You paid **$${fmt(renewCost)}** to renew <@${targetId}>'s contract.\nDebt: **$${fmt(oldDebt)}** → **$${fmt(slave.debt)}**`).setColor(0xFF4500)] });
            try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('Your Debt Has Been Renewed!').setDescription(`Your debt has doubled to **$${fmt(slave.debt)}**.`).setColor(0xFF4500)] }); } catch {}
        }

        if (interaction.customId.startsWith('slave_check_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave    = await Slave.findOne({ userId: targetId, guildId });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            const slaveEcon = await getUser(targetId, guildId);
            await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder()
                .setTitle(`Stats for <@${targetId}>`)
                .addFields(
                    { name: 'Debt Remaining',      value: `$${fmt(slave.debt)}`,        inline: true },
                    { name: 'Total Earned for You', value: `$${fmt(slave.totalEarned)}`, inline: true },
                    { name: 'Their Balance',        value: `$${fmt(slaveEcon.balance)}`, inline: true }
                )
                .setColor(0x2b2d31)
                .setTimestamp()] });
        }

        if (interaction.customId.startsWith('slave_takepay_')) {
            const targetId = interaction.customId.split('_')[2];
            const slave    = await Slave.findOne({ userId: targetId, guildId });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            const modal = new ModalBuilder().setCustomId(`takepay_modal_${targetId}`).setTitle('Take Payment from Slave');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('takepay_amount').setLabel(`Amount to take (Debt: $${fmt(slave.debt)})`).setStyle(TextInputStyle.Short).setPlaceholder('e.g. 500').setRequired(true)));
            return interaction.showModal(modal);
        }

        if (interaction.customId === 'open_order_modal') {
            const modal = new ModalBuilder().setCustomId('order_modal').setTitle('Order Form');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('website_ip').setLabel('Website IP').setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('website_name').setLabel('Website Name').setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('filters').setLabel('Filter Links').setStyle(TextInputStyle.Paragraph))
            );
            return interaction.showModal(modal);
        }

        if (interaction.customId.startsWith('respond_')) {
            const userId = interaction.customId.split('_')[1];
            const modal  = new ModalBuilder().setCustomId(`response_modal_${userId}`).setTitle('Send Links');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('links').setLabel('Insert Links here').setStyle(TextInputStyle.Paragraph)));
            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        const guildId = interaction.guild.id;

        if (interaction.customId.startsWith('takepay_modal_')) {
            const targetId = interaction.customId.split('_')[2];
            const amount   = parseFloat(interaction.fields.getTextInputValue('takepay_amount'));
            if (!amount || isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Invalid amount.', ephemeral: true });
            const slave    = await Slave.findOne({ userId: targetId, guildId });
            if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
            const slaveUser = await getUser(targetId, guildId);
            if (slaveUser.balance < amount) return interaction.reply({ content: `❌ <@${targetId}> only has **$${fmt(slaveUser.balance)}** in their wallet.`, ephemeral: true });
            const taken = parseFloat(Math.min(amount, slave.debt).toFixed(2));
            slaveUser.balance = parseFloat((slaveUser.balance - taken).toFixed(2));
            await slaveUser.save();
            slave.debt = parseFloat((slave.debt - taken).toFixed(2));
            if (slave.debt <= 0) {
                slave.ownerId = null; slave.debt = 0;
                await slave.save();
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Debt Fully Paid!').setDescription(`Took **$${fmt(taken)}** from <@${targetId}>'s wallet — debt cleared, they are free.`).setColor(0x00FF99)] });
                try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('You Are Free!').setDescription(`Your remaining debt was paid. You are now free.`).setColor(0x00FF99)] }); } catch {}
            } else {
                await slave.save();
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Payment Taken').setDescription(`Took **$${fmt(taken)}** from <@${targetId}>'s wallet.`).addFields(
                    { name: 'Debt Remaining',          value: `$${fmt(slave.debt)}`,        inline: true },
                    { name: 'Their Remaining Balance', value: `$${fmt(slaveUser.balance)}`, inline: true }
                ).setColor(0xFF4500)] });
                try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('Payment Taken').setDescription(`**$${fmt(taken)}** was taken from your wallet toward your debt.\nDebt remaining: **$${fmt(slave.debt)}**`).setColor(0xFF4500)] }); } catch {}
            }
        }

        if (interaction.customId === 'order_modal') {
            const ip      = interaction.fields.getTextInputValue('website_ip');
            const name    = interaction.fields.getTextInputValue('website_name');
            const filters = interaction.fields.getTextInputValue('filters');
            const userId  = interaction.user.id;
            await interaction.user.send('Your order has been received. You will get your links soon.');
            await fetch(process.env.WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [{ title: 'New Order', fields: [{ name: 'User', value: `<@${userId}>` }, { name: 'Website IP', value: ip }, { name: 'Website Name', value: name }, { name: 'Filters', value: filters }], color: 0x2b2d31 }], components: [{ type: 1, components: [{ type: 2, label: 'Send Links', style: 1, custom_id: `respond_${userId}` }] }] }) });
            return interaction.reply({ content: 'Order submitted! Check your DMs.', ephemeral: true });
        }

        if (interaction.customId.startsWith('response_modal_')) {
            const userId = interaction.customId.split('_')[2];
            const links  = interaction.fields.getTextInputValue('links');
            try { const u = await client.users.fetch(userId); await u.send(`Your Order is Ready!\n\n${links}`); return interaction.reply({ content: 'Links sent to user.', ephemeral: true }); }
            catch { return interaction.reply({ content: 'Failed to DM user.', ephemeral: true }); }
        }
    }
});

client.login(process.env.TOKEN);
