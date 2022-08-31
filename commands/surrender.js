const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed, MessageAttachment, InteractionCollector } = require('discord.js');
const path = require('path')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ff')
		.setDescription('Forfeit your current game.'),
    async execute(interaction){

        // checks
        if(await cannotSurrender(interaction)){
            return;
        }

        const row = buildConfirmationEmbedButtons()
        const embed = buildConfirmationEmbed()

        await interaction.reply({embeds: [embed], components: [row]});
        await initCollector(interaction);
    }
}

async function cannotSurrender(interaction){
    // check for ongoing game
    let game_data = global.chessGames[interaction.user.id];
    if(game_data === undefined){
        await interaction.reply({ content: `You don't have an on-going game!` });
        return true;
    }
    
    // check if its their turn
    const board = game_data[0];
    if(game_data[1] != board.activeColor){
        await interaction.reply({ content: `It's not your turn yet!` });
        return true;
    }

    return false;
}

async function initCollector(interaction){
    const filter = i => i.user.id === challengedId;
    const collector = interaction.channel.createMessageComponentCollector({filter, time: 15000, max: 1});

    collector.on('collect', async i => {
        if (i.customId === 'Surrender'){
            await handleSurrender(interaction);
        }
        else{
            const updatedEmbed = buildDeclinedEmbed()
            await i.update({embeds: [updatedEmbed], components: [] });
        }
    });

}

async function handleSurrender(interaction){
    let game_data = global.chessGames[interaction.user.id];
    const board = game_data[0];

    // user_id: [chess obj, colour, opponent id]
    const winner = global.chessGames[interaction.user.id][2].id;
    const loser = interaction.user.id

    // user_id: elo, win, draw, lose, matchCount
    const winnerStats = await global.statistics.findOne({ where: { userId: winner }});
    const loserStats = await global.statistics.findOne({ where: { userId: loser }});
    const oldWinnerElo = winnerStats.get('elo');
    const oldLoserElo = loserStats.get('elo');

    const winnerTotalMatches = winnerStats.get('matches');
    const loserTotalMatches = loserStats.get('matches');

    const newEloData = calculateElo(oldWinnerElo, oldLoserElo, 1, winnerTotalMatches, loserTotalMatches);

    const surrenderEmbed = buildSurrenderEmbed(board, oldWinnerElo, oldLoserElo, newEloData, interaction, global.chessGames[interaction.user.id][2]);
    await interaction.update({ embeds: [surrenderEmbed] });

    // update elo
    await global.statistics.update({ elo: newEloData[0] }, { where: { userId: winner } });
    await global.statistics.update({ elo: newEloData[1] }, { where: { userId: loser } });
    
    // update stats
    await winnerStats.increment(['win', 'matches']);
    await loserStats.increment(['lose', 'matches']);

    // clear game data
    global.chessGames[winner] = undefined;
    global.chessGames[loser] = undefined;
}

function buildDeclinedEmbed(){
    return  new MessageEmbed()
    .setColor('#00FF00')
    .setTitle(`Surrender Canceled!`)
    .setDescription(`Nothing happened...`)
    .setImage(`https://fen2png.com/api/?fen=${(board.fen).replace(/ /g, '%20')}&raw=true`)
}

function buildSurrenderEmbed(board, oldWinnerElo, oldLoserElo, newEloData, interaction, winnerUser){
    const newWinnerElo = newEloData[0];
    const newLoserElo = newEloData[1];
    const winnerEloDelta = newEloData[2];
    const loserEloDelta = newEloData[3];

    return new MessageEmbed()
    .setColor('#00FF00')
    .setTitle(`A WINNER IS YOU!!`)
    .setDescription(`Here's the elo changes...`)
    .setImage(`https://fen2png.com/api/?fen=${(board.fen).replace(/ /g, '%20')}&raw=true`)
    .addFields(
        { name: `${winnerUser.username}`, value: `\`\`\`fix\n${oldWinnerElo}(${winnerEloDelta}) -> ${newWinnerElo}\`\`\``},
        { name: `${interaction.user.username}`, value: `\`\`\`fix\n${oldLoserElo}(${loserEloDelta}) -> ${newLoserElo}\`\`\``},
        // Patchy fix ^
    )
}

function buildConfirmationEmbed(){
    return new MessageEmbed()
    .setColor('#0099ff')
    .setTitle(`WARNING!`)
    .setDescription('Click on the buttons below to confirm that you want to forfeit your game or not.')
    .setFooter({ text: "You have 15 seconds to decide." })
}

function buildConfirmationEmbedButtons(){
    return new MessageActionRow()
    .addComponents(
        new MessageButton()
            .setCustomId('Surrender')
            .setLabel('Surrender')
            .setStyle('SUCCESS'),
        new MessageButton()
            .setCustomId("Continue")
            .setLabel("Continue Playing")
            .setStyle('DANGER'),
    );
}