const {Ic} = require('isepic-chess')
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed, MessageAttachment } = require('discord.js');
const path = require('path')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('movelist')
		.setDescription('play a move in your current game')
        .addStringOption(option => option.setName('format').setDescription('Optional: Specify "SAN" or "UCI" to return in that format. Defaults to "SAN"')),
    async execute(interaction){
        // check for game
        // exit if no game
        // if game
        // output board and move list
        let format = interaction.options.getString('format');
        if (format != null) format = format.toUpperCase();

        let game_data = global.chessGames[interaction.user.id];
        if(game_data === undefined){
            await interaction.reply({ content: `You don't have an on-going game!` });
            return;
        }

        const board = game_data[0];
        Ic.fenApply(board.fen, "legalSanMoves");

        let moves = null;
        let moves_str = "";
        if(format === "UCI"){
            moves = board.legalUci;
            console.log(moves)
            for (const element of moves){
                console.log(element)
                moves_str += element + "\n";
            }
        }
        else{
            // terrible, but this library doesn't offer any better ways
            for(let x = "b"; x < "h"; x = nextChar(x)){
                for(let y = 1; y <= 8; y++){
                    const square = x + y.toString();
                    moves = Ic.fenApply(board.fen, "legalSanMoves", [square])
                    console.log(moves)
                    for (const element of moves){
                        console.log(element)
                        moves_str += element + "\n";
                    }
                }
            }
        }

        console.log(moves);
        const movesEmbed = buildMoveListEmbed(moves_str, board);

        await interaction.reply({embeds: [movesEmbed]});
    }
}

function buildMoveListEmbed(str, board){
    return new MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`Possible moves for ${board.activeColor}`)
        .setDescription(str)
        .setImage(`https://fen2png.com/api/?fen=${(board.fen).replace(/ /g, '%20')}&raw=true`)
        .setFooter({ text: 'Use /move to make a move.'})
}

function nextChar(ch) {
    return String.fromCharCode(ch.charCodeAt(0) + 1);
}