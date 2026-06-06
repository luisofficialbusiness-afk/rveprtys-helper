const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { formatNumber }                          = require('../../utils/format');
const { getUser }                               = require('../../utils/economy');
const { hasItem }                               = require('../../utils/inventory');
const { ITEMS, ROD_TIERS, BUCKET_TIERS, PICKAXE_TIERS } = require('./items');

const SELL_RATE = 0.25;

const PAGES = [
    {
        id: 'general',
        label: '🏪 General',
        keys: ['lifesaver'],
    },
    {
        id: 'fishing',
        label: '🎣 Fishing',
        keys: [
            'fishing_rod_wooden', 'fishing_rod_basic', 'fishing_rod_upgraded',
            'fishing_rod_super', 'fishing_rod_legendary', 'fishing_bait',
            'bucket_wooden', 'bucket_iron', 'bucket_gold', 'bucket_diamond', 'bucket_crystal',
        ],
    },
    {
        id: 'mining',
        label: '⛏️ Mining',
        keys: ['pickaxe_wooden', 'pickaxe_basic', 'pickaxe_iron', 'pickaxe_diamond', 'pickaxe_netherite', 'mining_backpack', 'mining_bomb'],
    },
    {
        id: 'streaming',
        label: '📺 Streaming',
        keys: ['keyboard_mouse', 'camera', 'ring_light', 'microphone', 'dedicated_server'],
    },
    {
        id: 'gear',
        label: '⚙️ My Gear',
        keys: null,
    },
];

function getHighestOwned(user, tierArr) {
    for (let i = tierArr.length - 1; i >= 0; i--) {
        if (hasItem(user, tierArr[i])) return tierArr[i];
    }
    return null;
}

function itemLine(key, user) {
    const item = ITEMS[key];
    if (!item) return null;
    const qty    = user.inventory?.find(i => i.item === key)?.quantity ?? 0;
    const locked = !!(item.requires && !hasItem(user, item.requires));

    let badge   = '';
    let reqLine = '';

    if (qty > 0) {
        badge = item.consumable ? ` ×${qty}` : ' ✅';
    } else if (locked) {
        badge   = ' 🔒';
        reqLine = `*Requires: ${ITEMS[item.requires]?.name ?? item.requires}*\n`;
    }

    const price = `$${formatNumber(item.price)}${item.consumable ? ' each' : ''}`;
    return `${item.emoji} **${item.name}**${badge} - ${price}\n${reqLine}${item.description}`;
}

function buildGearBody(user) {
    const sections = [];

    const rodId    = getHighestOwned(user, ROD_TIERS);
    const bucketId = getHighestOwned(user, BUCKET_TIERS);
    if (rodId || bucketId) {
        const rodLine    = rodId    ? `Rod: **${ITEMS[rodId].name}** - ${user.fishRodDurability ?? 0} uses left` : 'Rod: *none*';
        const bucketLine = bucketId ? `Bucket: **${ITEMS[bucketId].name}**` : 'Bucket: *none*';
        sections.push(`🎣 **Fishing**\n${rodLine}\n${bucketLine}`);
    }

    const pickaxeId = getHighestOwned(user, PICKAXE_TIERS);
    if (pickaxeId || hasItem(user, 'mining_backpack')) {
        const pickLine = pickaxeId ? `Pickaxe: **${ITEMS[pickaxeId].name}** - ${user.pickaxeDurability ?? 0} uses left` : 'Pickaxe: *none*';
        const backLine = hasItem(user, 'mining_backpack') ? '\nBackpack: ✅' : '';
        sections.push(`⛏️ **Mining**\n${pickLine}${backLine}`);
    }

    const streamOwned = ['keyboard_mouse', 'camera', 'ring_light', 'microphone', 'dedicated_server'].filter(k => hasItem(user, k));
    if (streamOwned.length > 0) {
        sections.push(`📺 **Streaming**\n${streamOwned.map(k => ITEMS[k].name).join('  ·  ')}`);
    }

    const consumOwned = ['lifesaver', 'fishing_bait', 'mining_bomb'].filter(k => hasItem(user, k));
    if (consumOwned.length > 0) {
        const lines = consumOwned.map(k => {
            const qty = user.inventory?.find(i => i.item === k)?.quantity ?? 0;
            return `${ITEMS[k].emoji} **${ITEMS[k].name}** ×${qty}`;
        });
        sections.push(`🎒 **Consumables**\n${lines.join('  ·  ')}`);
    }

    return sections.length > 0
        ? sections.join('\n\n')
        : '*No equipment owned yet. Browse the other pages to get started.*';
}

function buildActionButtons(pageIndex, user) {
    const page = PAGES[pageIndex];
    if (!page.keys) return null;

    const buyButtons  = [];
    const sellButtons = [];

    for (const key of page.keys) {
        const item = ITEMS[key];
        if (!item) continue;
        const qty    = user.inventory?.find(i => i.item === key)?.quantity ?? 0;
        const locked = !!(item.requires && !hasItem(user, item.requires));

        if (item.consumable) {
            buyButtons.push(
                new ButtonBuilder()
                    .setCustomId(`shop_buy:${key}:${pageIndex}`)
                    .setLabel(`Buy ${item.name}`)
                    .setStyle(ButtonStyle.Success)
            );
        } else if (qty === 0 && !locked) {
            buyButtons.push(
                new ButtonBuilder()
                    .setCustomId(`shop_buy:${key}:${pageIndex}`)
                    .setLabel(`Buy ${item.name}`)
                    .setStyle(ButtonStyle.Primary)
            );
        } else if (qty > 0) {
            sellButtons.push(
                new ButtonBuilder()
                    .setCustomId(`shop_sell:${key}:${pageIndex}`)
                    .setLabel(`Sell ${item.name}`)
                    .setStyle(ButtonStyle.Danger)
            );
        }
    }

    const all = [...buyButtons, ...sellButtons].slice(0, 5);
    return all.length > 0 ? new ActionRowBuilder().addComponents(...all) : null;
}

function buildPage(pageIndex, user) {
    const page = PAGES[pageIndex];

    const body = page.keys
        ? page.keys.map(k => itemLine(k, user)).filter(Boolean).join('\n\n')
        : buildGearBody(user);

    const tabRow = new ActionRowBuilder().addComponents(
        PAGES.map((p, i) =>
            new ButtonBuilder()
                .setCustomId(`shop_page:${i}`)
                .setLabel(p.label)
                .setStyle(i === pageIndex ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(i === pageIndex)
        )
    );

    const actionRow = buildActionButtons(pageIndex, user);

    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${page.label}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# /buy <item>  ·  ?buy <item>  ·  /sell <item>  ·  ?sell <item>`))
        .addActionRowComponents(tabRow);

    if (actionRow) container.addActionRowComponents(actionRow);

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function execute(interaction, user) {
    return interaction.reply(buildPage(0, user));
}

async function handlePage(interaction) {
    await interaction.deferUpdate();
    const pageIndex = parseInt(interaction.customId.split(':')[1]);
    if (isNaN(pageIndex) || pageIndex < 0 || pageIndex >= PAGES.length) return;
    const user = await getUser(interaction.user.id, interaction.guild.id);
    await interaction.message.edit(buildPage(pageIndex, user));
}

async function handleShopBuy(interaction) {
    const [, key, pageStr] = interaction.customId.split(':');
    const pageIndex        = parseInt(pageStr);
    const item             = ITEMS[key];
    if (!item) return interaction.reply({ content: '❌ Invalid item.', ephemeral: true });

    await interaction.deferUpdate();
    const user = await getUser(interaction.user.id, interaction.guild.id);

    if (item.requires && !hasItem(user, item.requires)) {
        const req = ITEMS[item.requires];
        await interaction.followUp({ content: `❌ You need a **${req?.name ?? item.requires}** first.`, ephemeral: true });
        return;
    }
    if (!item.consumable && hasItem(user, key)) {
        await interaction.followUp({ content: `❌ You already own a **${item.name}**.`, ephemeral: true });
        return;
    }
    if (user.balance < item.price) {
        await interaction.followUp({ content: `❌ You need **$${formatNumber(item.price)}** but only have **$${formatNumber(user.balance)}**.`, ephemeral: true });
        return;
    }

    user.balance = parseFloat((user.balance - item.price).toFixed(2));
    const existing = user.inventory?.find(i => i.item === key);
    if (existing) {
        existing.quantity++;
    } else {
        if (!user.inventory) user.inventory = [];
        user.inventory.push({ item: key, quantity: 1 });
    }
    if (ROD_TIERS.includes(key) && item.durability)     user.fishRodDurability = item.durability;
    if (PICKAXE_TIERS.includes(key) && item.durability) user.pickaxeDurability  = item.durability;
    await user.save();

    await interaction.message.edit(buildPage(isNaN(pageIndex) ? 0 : pageIndex, user));
}

async function handleShopSell(interaction) {
    const [, key, pageStr] = interaction.customId.split(':');
    const pageIndex        = parseInt(pageStr);
    const item             = ITEMS[key];

    await interaction.deferUpdate();
    const user = await getUser(interaction.user.id, interaction.guild.id);

    if (!item || !hasItem(user, key)) {
        await interaction.followUp({ content: `❌ You don't own a **${item?.name ?? key}**.`, ephemeral: true });
        return;
    }

    const entry = user.inventory.find(i => i.item === key);
    entry.quantity--;
    if (entry.quantity <= 0) user.inventory = user.inventory.filter(i => i.item !== key);
    if (PICKAXE_TIERS.includes(key)) user.pickaxeDurability = 0;
    if (ROD_TIERS.includes(key))     user.fishRodDurability = 0;

    const sellPrice = Math.floor(item.price * SELL_RATE);
    user.balance    = parseFloat((user.balance + sellPrice).toFixed(2));
    await user.save();

    await interaction.message.edit(buildPage(isNaN(pageIndex) ? 0 : pageIndex, user));
    await interaction.followUp({ content: `${item.emoji} Sold **${item.name}** for **$${formatNumber(sellPrice)}**.`, ephemeral: true });
}

module.exports = { execute, handlePage, handleShopBuy, handleShopSell };
