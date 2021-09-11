require('dotenv').config();

// Configuration
const SUGGESTIONS_CHANNEL_ID = '886001921712877578';

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

// Handle Button Presses
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const fields = interaction.customId.split('_');
    if (fields[0] !== 'suggestion') return;

    const suggestion = db.get(`suggestions_${fields[1]}.${fields[2]}`);
    const action = fields[3];
    const mId = interaction.member.id;

    const updateEmbedWithFeedback = () => {
        const embed = interaction.message.embeds[0];
        embed.fields[0].value = `Upvotes: \`${suggestion.upvotes.length}\`\nDownvotes: \`${suggestion.downvotes.length}\``;
        interaction.update({ embeds: [embed] });
    };

    const btn = (label, style = 'PRIMARY') =>
        new MessageButton()
            .setCustomId(
                `suggestion_${fields[1]}_${fields[2]}_${label
                    .replace(/ /g, '-')
                    .toLowerCase()}`
            )
            .setLabel(label)
            .setStyle(style);

    if (action === 'upvote') {
        if (suggestion.upvotes.includes(mId)) {
            suggestion.upvotes.splice(suggestion.upvotes.indexOf(mId), 1);
        } else if (suggestion.downvotes.includes(mId)) {
            suggestion.downvotes.splice(suggestion.downvotes.indexOf(mId), 1);
            suggestion.upvotes.push(mId);
        } else suggestion.upvotes.push(mId);
        db.set(`suggestions_${fields[1]}.${fields[2]}`, suggestion);
        updateEmbedWithFeedback();
    }

    if (action === 'downvote') {
        if (suggestion.downvotes.includes(mId)) {
            suggestion.downvotes.splice(suggestion.downvotes.indexOf(mId), 1);
        } else if (suggestion.upvotes.includes(mId)) {
            suggestion.upvotes.splice(suggestion.upvotes.indexOf(mId), 1);
            suggestion.downvotes.push(mId);
        } else suggestion.downvotes.push(mId);
        db.set(`suggestions_${fields[1]}.${fields[2]}`, suggestion);
        updateEmbedWithFeedback();
    } else if (action === 'staff-options') {
        const userRow = interaction.message.components[0];
        userRow.spliceComponents(2, 1); // Remove the staff options button

        // Add staff options
        const staffRow = new MessageActionRow().addComponents([
            btn('Accept', 'SUCCESS'),
            btn('Reject', 'DANGER'),
            btn('Cancel', 'SECONDARY'),
        ]);

        // Update the message
        interaction.update({ components: [userRow, staffRow] });
    } else if (action === 'cancel') {
        if (!interaction.member.permissions.has('MANAGE_GUILD')) {
            return interaction.reply({
                content: 'You do not have permission to do this!',
                ephemeral: true,
            });
        }

        const userRow = interaction.message.components[0];

        userRow.addComponents([btn('Staff Options')]);

        interaction.update({
            components: [userRow],
        });
    } else if (action === 'accept' || action === 'reject') {
        if (!interaction.member.permissions.has('MANAGE_GUILD')) {
            return interaction.reply({
                content: 'You do not have permission to do this!',
                ephemeral: true,
            });
        }

        if (suggestion.thread) {
            const thread = await interaction.guild.channels.fetch(
                suggestion.thread
            );
            if (thread) thread.delete();
        }

        const embed = interaction.message.embeds[0];
        embed.setColor(action === 'accept' ? 0x43b581 : 0xf04747);
        embed.fields[0].name = `Suggestion ${
            action === 'accept' ? 'Accepted' : 'Rejected'
        }`;

        interaction.update({ embeds: [embed], components: [] });
    }
});

// Handle Messages
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.channel.id !== SUGGESTIONS_CHANNEL_ID) return;

    // Add suggestion to database
    const cb = db.push(`suggestions_${message.author.id}`, {
        status: 'pending',
        content: message.content,
        author: { tag: message.author.tag, id: message.author.id },
        upvotes: [],
        downvotes: [],
    });
    const index = cb.length - 1;

    // Create suggestion embed
    const embed = new MessageEmbed()
        .setColor(0x5865f2)
        .setFooter(message.author.tag, message.author.displayAvatarURL())
        .setDescription(message.content)
        .setTitle('Suggestion')
        .addField('User Feedback', 'Upvotes: `0`\nDownvotes: `0`');

    // New button helper method
    const btn = (label, style = 'PRIMARY') =>
        new MessageButton()
            .setCustomId(
                `suggestion_${message.author.id}_${index}_${label
                    .replace(/ /g, '-')
                    .toLowerCase()}`
            )
            .setLabel(label)
            .setStyle(style);

    // Create buttons
    const row = new MessageActionRow().addComponents([
        btn('Upvote', 'SUCCESS'),
        btn('Downvote', 'DANGER'),
        btn('Staff Options'),
    ]);

    // Send embed
    const msg = await message.guild.channels.cache
        .get(SUGGESTIONS_CHANNEL_ID)
        .send({ embeds: [embed], components: [row] });

    // Create thread
    const thread = await msg.startThread({
        name: 'Discussion',
        autoArchiveDuration: 'MAX',
    });

    db.set(`suggestions_${message.author.id}.${index}.thread`, thread.id);

    // Delete original message
    message.delete();
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
