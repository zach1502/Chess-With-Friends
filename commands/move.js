const {Ic} = require('isepic-chess')
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed, MessageAttachment } = require('discord.js');
const path = require('path');
const { match } = require('assert');

//global.chessGames = {
	// user_id: [chess obj, colour, opponent id]
//}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('move')
		.setDescription('play a move in your current game')
        .addStringOption(option => option.setName('move').setDescription('Enter move in either SAN or UCI form. Examples: e2e4 or e4, b8c6 or Nc6, g5f6 or Bxf6+').setRequired(true)),
    async execute(interaction){
        // check for game
        // exit if no game

        if(await cannotMove(interaction)){
            // replies are handled in the function ^
            return;
        }

        let game_data = global.chessGames[interaction.user.id];
        const board = game_data[0];
        const FEN = (board.fen).replace(/ /g, '%20');

        // check for game end
        if(isGameEnd(board)){
            await handleGameEnd(interaction);
            return;
        }
        
        // return board if valid
        const whiteId = (game_data[1] === "w")?(interaction.user.id):(game_data[2].id);
        const blackId = (game_data[1] === "b")?(interaction.user.id):(game_data[2].id);

        const gameEmbed = buildGameEmbed(whiteId, blackId, FEN);
        await interaction.reply({embeds: [gameEmbed], components: []})
    }
}

function isGameEnd(board){
    return (board.isCheckmate || board.inDraw );
}

async function cannotMove(interaction){
    // check for ongoing game
    const move = interaction.options.getString('move');
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

    // try to make move
    // return error if invalid
    if(board.playMove(move, {isMockMove: false, isLegalMove: false}) === null){
        await interaction.reply({ content: `I can't read your input! Check your input please!` });
        return true;
    }

    return false;
}

// despite it being called winner and loser, this function can also handle draws
function calculateElo(winnerElo, loserElo, score, winnerTotalMatches, loserTotalMatches){
    // modifies the impact of 1 match, this should change depending on the number of games played and the number of wins - loses
    const kWinner = 128 * Math.sqrt(1/(winnerTotalMatches + 1)) + 8;
    const kLoser = 128 * Math.sqrt(1/(loserTotalMatches + 1)) + 8;

    const transWinnerElo = Math.pow(10, winnerElo/400);
    const transLoserElo = Math.pow(10, loserElo/400);

    const expectedWinnerScore = transWinnerElo / (transWinnerElo + transLoserElo);
    const expectedLoserScore = transLoserElo / (transWinnerElo + transLoserElo);

    const actualWinnerScore = score;
    const actualLoserScore = 1 - score;

    const winnerEloDelta = kWinner * (actualWinnerScore - expectedWinnerScore);
    const loserEloDelta = kLoser * (actualLoserScore - expectedLoserScore);

    const newWinnerElo = winnerElo + winnerEloDelta;
    const newLoserElo = loserElo + loserEloDelta;

    return [newWinnerElo, newLoserElo, winnerEloDelta, loserEloDelta];
}

async function handleGameEnd(interaction){
    // user_id: [chess obj, colour, opponent User object]
    const winner = interaction.user.id;
    const loser = global.chessGames[interaction.user.id][2].id;

    // user_id: elo, win, draw, lose, matchCount
    const winnerStats = await global.statistics.findOne({ where: { userId: winner }});
    const loserStats = await global.statistics.findOne({ where: { userId: loser }});
    const oldWinnerElo = winnerStats.get('elo');
    const oldLoserElo = loserStats.get('elo');

    const winnerTotalMatches = winnerStats.get('matches');
    const loserTotalMatches = loserStats.get('matches');
    
    const newEloData = calculateElo(oldWinnerElo, oldLoserElo, (board.isCheckmate)? 1 : 0.5, winnerTotalMatches, loserTotalMatches);

    // update elo
    await global.statistics.update({ elo: newEloData[0] }, { where: { userId: winner } });
    await global.statistics.update({ elo: newEloData[1] }, { where: { userId: loser } });

    if(board.isCheckmate){
        await interaction.reply({ embeds: [BuildWinnerEmbed(interaction, newEloData, oldWinnerElo, oldLoserElo, global.chessGames[interaction.user.id][2])] });
        await winnerStats.increment(['win', 'matches']);
        await loserStats.increment(['lose', 'matches']);
    }
    else{
        // is draw
        await interaction.reply({ embeds: [BuildDrawnEmbed(interaction, newEloData, oldWinnerElo, oldLoserElo, global.chessGames[interaction.user.id][2])] });
        await winnerStats.increment(['draw', 'matches']);
        await loserStats.increment(['draw', 'matches']);
    }

    // reset game data
    global.chessGames[winner] = undefined;
    global.chessGames[loser] = undefined;
}

function buildGameEmbed(whiteId, blackId, FEN){
    return new MessageEmbed()
            .setColor('#0099ff')
            .addFields(
                { name: 'White', value: `<@${whiteId}>`},
                { name: 'Black', value: `<@${blackId}>`},
            )
            .setImage(`https://fen2png.com/api/?fen=${FEN}&raw=true`)
            .setFooter({ text: 'Use /move to make a move.'})
}

function BuildWinnerEmbed(interaction, newEloData, oldWinnerElo, oldLoserElo, loserUser){
    const newWinnerElo = newEloData[0];
    const newLoserElo = newEloData[1];
    const winnerEloDelta = newEloData[2];
    const loserEloDelta = newEloData[3];

    return new MessageEmbed()
                    .setColor('#00FF00')
                    .setTitle(`A WINNER IS YOU! ${interaction.user.username}!`)
                    .setDescription(`Here's the elo changes...`)
                    .setImage(`https://fen2png.com/api/?fen=${FEN}&raw=true`)
                    .addFields(
                        { name: `${interaction.user.username}`, value: `\`\`\`fix\n${oldWinnerElo}(${winnerEloDelta}) -> ${newWinnerElo}\`\`\``},
                        { name: `${loserUser.username}`, value: `\`\`\`fix\n${oldLoserElo}(${loserEloDelta}) -> ${newLoserElo}\`\`\``},
                        // Patchy fix ^
                    )
}

function BuildDrawnEmbed(interaction, newEloData, oldWinnerElo, oldLoserElo, loserUser){              
    const newWinnerElo = newEloData[0];
    const newLoserElo = newEloData[1];
    const winnerEloDelta = newEloData[2];
    const loserEloDelta = newEloData[3];

    return new MessageEmbed()
        .setColor('#FFFF00')
        .setTitle(`This game could've went either way! Well fought <@${winner}> and <@${loser}>!`)
        .setDescription(`Here's the ELO changes...`)
        .addFields(
            { name: `<@${interaction.user.username}>`, value: `\`\`\`fix\n${oldWinnerElo}(${winnerEloDelta}) -> ${newWinnerElo}\`\`\``},
            { name: `<@${loserUser.username}>` , value: `\`\`\`fix\n${oldLoserElo}(${loserEloDelta}) -> ${newLoserElo}\`\`\``},
        )
        .setFooter({content: ""})
}