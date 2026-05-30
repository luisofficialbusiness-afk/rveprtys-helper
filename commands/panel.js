const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Send the order panel'),

    async execute(interaction) {

        const OWNER_ID = process.env.OWNER_ID ?? '1453078748080504996';
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({
                content: "You are not allowed to use this command.",
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('Make a Order')
            .setDescription('To Order a link, fill out the form by clicking the button and the bot will dm you the links when its done')
            .setColor(0x2b2d31);

        const button = new ButtonBuilder()
            .setCustomId('open_order_modal')
            .setLabel('Order Now')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    }
};
