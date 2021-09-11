import db from 'quick.db';

const run = async (client, interaction, args) => {
    const mId = interaction.member.id;
    const suggestion = args.suggestion;

    if (suggestion.upvotes.includes(mId)) {
        suggestion.upvotes.splice(suggestion.upvotes.indexOf(mId), 1);
    } else if (suggestion.downvotes.includes(mId)) {
        suggestion.downvotes.splice(suggestion.downvotes.indexOf(mId), 1);
        suggestion.upvotes.push(mId);
    } else suggestion.upvotes.push(mId);

    db.set(args.suggestionPath, suggestion);

    const embed = interaction.message.embeds[0];
    embed.fields[0].value = `Upvotes: \`${suggestion.upvotes.length}\`\nDownvotes: \`${suggestion.downvotes.length}\``;
    interaction.update({ embeds: [embed] });
};

export { run };
