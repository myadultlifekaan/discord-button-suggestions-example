import { MessageActionRow } from 'discord.js';

const options = {
    staffOnly: true,
};

const run = async (client, interaction, args) => {
    const userRow = interaction.message.components[0];
    userRow.spliceComponents(2, 1);

    const staffRow = new MessageActionRow().addComponents([
        args.btn('Accept', 'SUCCESS'),
        args.btn('Reject', 'DANGER'),
        args.btn('Cancel', 'SECONDARY'),
    ]);

    interaction.update({ components: [userRow, staffRow] });
};

export { options, run };
