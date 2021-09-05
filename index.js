require('dotenv').config();

// Configuration
const SUGGEST_CHANNEL_ID = '884156951200673808'; // Users send suggestions in this channel
const SUGGESTIONS_CHANNEL_ID = '884156880870572072'; // Suggestions are sent to this channel for staff

const {
    Client,
    Intents,
    MessageEmbed,
    MessageButton,
    MessageActionRow,
} = require('discord.js');
const intents = [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES];
const client = new Client({ intents });

const db = require('quick.db');

// Button Handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.member.permissions.has('MANAGE_GUILD')) return;

    const fields = interaction.customId.split('_');

    if (fields[0] !== 'suggestion') return;
    const suggestion = db.get(`suggestions_${fields[1]}.${fields[2]}`);
    const type = fields[3];

    if (type === 'Opinions') {
        if (suggestion.thread) {
            interaction.reply({
                ephemeral: true,
                content: 'A thread was already created!',
            });
        }

        // Create thread
        const embed = new MessageEmbed()
            .setTitle(`Feedback Requested`)
            .setColor(0x5865f2)
            .setDescription(suggestion.content)
            .setFooter(
                `Suggested by ${suggestion.author.tag} (${suggestion.author.id})`
            );

        const parent = await interaction.guild.channels.cache
            .get(SUGGEST_CHANNEL_ID)
            .send({ embeds: [embed] });

        const thread = await parent.startThread({
            name: 'Give your opinion on the above suggestion',
            autoArchiveDuration: 60,
        });

        return db.set(`suggestions_${fields[1]}.${fields[2]}.thread`, {
            parent: parent.id,
            thread: thread.id,
        });
    }

    // Remove options
    const embed = new MessageEmbed()
        .setTitle(`Suggestion ${type === 'Accept' ? 'Accepted' : 'Denied'}`)
        .setColor(type === 'Accept' ? 0x43b581 : 0xf04747)
        .setDescription(suggestion.content)
        .setFooter(
            `Suggested by ${suggestion.author.tag} (${suggestion.author.id})`
        );
    interaction.message.edit({ embeds: [embed], components: [] });

    // Delete Thread
    if (suggestion.thread) {
        try {
            const parent = await interaction.guild.channels.cache
                .get(SUGGEST_CHANNEL_ID)
                .messages.fetch(suggestion.thread.parent);
            const thread = await interaction.guild.channels.fetch(
                suggestion.thread.thread
            );
            if (parent) parent.delete();
            if (thread) thread.delete();
        } catch (e) {}
    }
});

// Message Handler
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.channel.id !== SUGGEST_CHANNEL_ID) return;

    // Add to database
    const cb = db.push(`suggestions_${message.author.id}`, {
        status: 'pending',
        content: message.content,
        author: { tag: message.author.tag, id: message.author.id },
    });
    const index = cb.length - 1;

    // Create a new embed
    const embed = new MessageEmbed()
        .setTitle(`New Suggestion`)
        .setColor(0x5865f2)
        .setDescription(message.content)
        .setFooter(`Suggested by ${message.author.tag} (${message.author.id})`);

    // Create buttons
    const btn = (type, style) =>
        new MessageButton()
            .setCustomId(`suggestion_${message.author.id}_${index}_${type}`)
            .setLabel(type)
            .setStyle(style);

    const row = new MessageActionRow().addComponents([
        btn('Accept', 'SUCCESS'),
        btn('Opinions', 'PRIMARY'),
        btn('Deny', 'DANGER'),
    ]);

    // Send staff message
    const feedback = await message.guild.channels.cache
        .get(SUGGESTIONS_CHANNEL_ID)
        .send({ embeds: [embed], components: [row] });

    message.delete();
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
