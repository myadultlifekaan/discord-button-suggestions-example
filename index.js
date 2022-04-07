import dotenv from 'dotenv';
dotenv.config();

const SUGGESTIONS_CHANNEL_ID = '886001921712877578';

import {
    Client,
    Collection,
    Intents,
    MessageEmbed,
    MessageButton,
    MessageActionRow,
} from 'discord.js';
import { globby } from 'globby';
import db from 'quick.db';

const intents = [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES];
const client = new Client({ intents });

client.buttons = new Collection();

client.once('ready', async () => {
    console.log('Ready!');

    const buttons = await globby('Buttons');
    const categories = buttons
        .map(i => i.split('/')[1])
        .filter((v, i, a) => a.indexOf(v) === i);

    for (let i = 0; i < categories.length; i++) {
        const files = buttons.filter(f => f.split('/')[1] === categories[i]);
        client.buttons.set(categories[i], files);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const fields = interaction.customId.split('_');

    const commands = client.buttons.get(fields[0]);
    if (!commands) return console.log('Button category not found');

    const path = commands.find(f => f.split('/')[2] === `${fields[3]}.js`);
    if (!path) return console.log('Button path not found');

    const args = {};

    if (fields[0] === 'suggestion') {
        args.suggestionPath = `suggestions_${fields[1]}.${fields[2]}`;
        args.suggestion = db.get(args.suggestionPath);
        args.btn = (label, style = 'PRIMARY') =>
            new MessageButton()
                .setCustomId(
                    `suggestion_${fields[1]}_${fields[2]}_${label
                        .replace(/ /g, '-')
                        .toLowerCase()}`
                )
                .setLabel(label)
                .setStyle(style);
    }

    const file = await import(`./${path}`);

    if (file?.options?.staffOnly) {
        if (!interaction.member.permissions.has('MANAGE_MESSAGES')) {
            return interaction.reply({
                content: 'You do not have permission to do this!',
                ephemeral: true,
            });
        }
    }

    file.run(client, interaction, args);
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

client.login(OTU4MDE2ODc4Mzc3MzIwNDQ5.YkHMvg.ZCHFQYbr4iOSNB8rtCkQZHVmOFc);
