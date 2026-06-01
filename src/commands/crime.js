const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');
const { applyDeathPenalty } = require('../utils/penalty');
const cooldowns = require('../utils/cooldowns');

const fmt    = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n).toLocaleString('en-US');

const COOLDOWN = 60 * 60 * 1000;

const CRIMES = {
    pickpocket:    { emoji: '🤏', label: 'Pickpocket',    min: 100,  max: 400,   deathChance: 0.04, catchChance: 0.20, fine: 0.30, failChance: 0.15, failPenalty: 0,   failMsg: 'You attempted to pickpocket someone but your pants fell down and they got away.' },
    shoplift:      { emoji: '🛍️', label: 'Shoplift',      min: 200,  max: 800,   deathChance: 0.06, catchChance: 0.25, fine: 0.35, failChance: 0.15, failPenalty: 0,   failMsg: 'You stole a pack of gum from Walmart and were immediately arrested.' },
    carjack:       { emoji: '🚙', label: 'Carjack',       min: 500,  max: 1800,  deathChance: 0.10, catchChance: 0.30, fine: 0.40, failChance: 0.20, failPenalty: 0,   failMsg: "You tried carjacking someone but you don't know how to drive and failed." },
    mugging:       { emoji: '🔪', label: 'Mugging',       min: 700,  max: 2800,  deathChance: 0.14, catchChance: 0.35, fine: 0.45, failChance: 0.20, failPenalty: 0,   failMsg: "You tried mugging someone but you don't even go outside." },
    fraud:         { emoji: '💳', label: 'Fraud',         min: 1000, max: 4500,  deathChance: 0.05, catchChance: 0.40, fine: 0.50, failChance: 0.20, failPenalty: 500, failMsg: 'You committed fraud in your own name and lost $500.' },
    bank_robbery:  { emoji: '🏦', label: 'Bank Robbery',  min: 3000, max: 12000, deathChance: 0.22, catchChance: 0.50, fine: 0.60, failChance: 0.25, failPenalty: 0,   failMsg: 'All of the money you stole was fake, you idiot.' },
};

const DEATH_MSGS = [
    'The mark fought back harder than expected.',
    'A bystander called the cops and things escalated.',
    'You ran into the wrong people.',
    'It was a setup from the start.',
    'Security was waiting for you.',
];

const CAUGHT_MSGS = [
    'You almost got away with it, but got caught at the last second.',
    'An off-duty officer spotted you.',
    'A camera caught everything.',
    'Someone recognized you and called it in.',
];

const SUCCESS_MSGS = [
    'Clean getaway.',
    'Nobody even noticed.',
    'In and out, just like that.',
    'Professional.',
    'Too easy.',
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crime')
        .setDescription('Commit a crime for big money - high risk, high reward')
        .addStringOption(o =>
            o.setName('type').setDescription('Type of crime').setRequired(true)
                .addChoices(
                    { name: 'Pickpocket',   value: 'pickpocket'   },
                    { name: 'Shoplift',     value: 'shoplift'     },
                    { name: 'Carjack',      value: 'carjack'      },
                    { name: 'Mugging',      value: 'mugging'      },
                    { name: 'Fraud',        value: 'fraud'        },
                    { name: 'Bank Robbery', value: 'bank_robbery' }
                )
        ),

    async execute(interaction) {
        const key  = interaction.options.getString('type');
        const c    = CRIMES[key];
        const now  = Date.now();

        if (cooldowns.crime.has(interaction.user.id)) {
            const exp = cooldowns.crime.get(interaction.user.id) + COOLDOWN;
            if (now < exp) {
                const left = exp - now;
                const totalSecs = Math.ceil(left / 1000);
                const m = Math.floor(totalSecs / 60), s = totalSecs % 60;
                return interaction.reply({ content: `⏳ Laying low. Try again in **${m}m ${s}s**.`, ephemeral: true });
            }
        }
        cooldowns.crime.set(interaction.user.id, now);

        const user = await getUser(interaction.user.id, interaction.guild.id);

        if (Math.random() < c.deathChance) {
            const result = await applyDeathPenalty(user);
            const msg    = DEATH_MSGS[Math.floor(Math.random() * DEATH_MSGS.length)];

            if (result.blocked) {
                return interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle(`${c.emoji} ${c.label} - Barely Survived`)
                    .setDescription(`${msg}\n\n🛟 **Your lifesaver saved you!** No money was lost.`)
                    .setColor(0xFFD700)] });
            }

            const lostStr = result.from === 'wallet'
                ? `**$${fmt(result.penalty)}** from your wallet (2%)`
                : `**$${fmt(result.penalty)}** from your bank (4%)`;

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`☠️ ${c.label} Gone Wrong`)
                .setDescription(`${msg}\n\nYou lost ${lostStr}.`)
                .setColor(0xff3333)] });
        }

        if (Math.random() < c.failChance) {
            if (c.failPenalty > 0) {
                const lost = Math.min(c.failPenalty, user.balance);
                user.balance = parseFloat((user.balance - lost).toFixed(2));
                await user.save();
                return interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle(`${c.emoji} ${c.label} - Failed`)
                    .setDescription(`${c.failMsg}`)
                    .addFields({ name: '💵 New Balance', value: `$${fmt(user.balance)}`, inline: true })
                    .setColor(0xff8800)] });
            }
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`${c.emoji} ${c.label} - Failed`)
                .setDescription(`${c.failMsg}`)
                .setColor(0xff8800)] });
        }

        if (Math.random() < c.catchChance) {
            const potential = Math.floor(Math.random() * (c.max - c.min + 1)) + c.min;
            const fine      = parseFloat((potential * c.fine).toFixed(2));
            const actual    = Math.min(fine, user.balance);
            user.balance    = parseFloat((user.balance - actual).toFixed(2));
            await user.save();

            const msg = CAUGHT_MSGS[Math.floor(Math.random() * CAUGHT_MSGS.length)];
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`🚨 Caught - ${c.label}`)
                .setDescription(`${msg}\n\nYou paid a **$${fmt(actual)}** fine.`)
                .addFields({ name: '💵 New Balance', value: `$${fmt(user.balance)}`, inline: true })
                .setColor(0xff8800)
                .setFooter({ text: `Catch chance: ${Math.round(c.catchChance * 100)}%` })] });
        }

        const amount = Math.floor(Math.random() * (c.max - c.min + 1)) + c.min;
        user.balance = parseFloat((user.balance + amount).toFixed(2));
        await user.save();

        const msg = SUCCESS_MSGS[Math.floor(Math.random() * SUCCESS_MSGS.length)];
        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle(`${c.emoji} ${c.label} - Success`)
            .setDescription(`${msg} You walked away with **$${fmtInt(amount)}**.`)
            .addFields({ name: '💵 New Balance', value: `$${fmt(user.balance)}`, inline: true })
            .setColor(0x00cc44)
            .setFooter({ text: `Death: ${Math.round(c.deathChance * 100)}% • Catch: ${Math.round(c.catchChance * 100)}%` })] });
    }
};
