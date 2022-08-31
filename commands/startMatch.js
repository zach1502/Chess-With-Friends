
const {Ic} = require('isepic-chess')
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed, InteractionCollector} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription('play chess with someone!')
        .addUserOption(option => option.setName('target').setDescription('Select a User').setRequired(true))
        .addStringOption(option => option.setName('colour').setDescription('Optional: select your colour, enter "w" for White or "b" for Black. Leave blank for random')),
	
    async execute(interaction) {
        if(await cannotStartGame(interaction)){
            // replies are handled in the function ^
            return;
        }

        let challengerColour = null
        let challengedColour = null

        if(colourInputIsValid(interaction.options.getString('colour'))){
            challengerColour = interaction.options.getString('colour').toLowerCase();
            challengedColour = (challengerColour === "w") ? "b" : "w";
        }
        else{
            challengerColour = (Math.random() < 0.5) ? "w" : "b";
            challengedColour = (challengerColour === "w") ? "b" : "w";
        }

        const row = buildEmbedButtons()
        const embed = buildChallengeEmbed()
        await interaction.reply({ content: `<@${challengedUser.id}> has been challenged to a match by <@${challengerUser.id}>!`, embeds: [embed], components: [row] });

        initCollector(interaction, challengerColour, challengedColour, challengerUser, challengedUser)
	},
};

async function cannotStartGame(interaction){
    // check if trying to play against a bot
    if(interaction.options.getUser('target').bot) {
        await interaction.reply("You can't play against a bot!");
        return true;
    }

    const challengedUser = interaction.options.getUser('target');
    const challengerUser = interaction.user;

    // check if trying to play against themselves
    if(challengedUser === challengerUser){
        await interaction.reply("You can't play against yourself!");
        return true;
    }

    // if either players are already in a game
    if(global.chessGames[challengedUser.id] != undefined){
        await interaction.reply("The person you want to challenge is already in a game!");
        return true;
    }
    if(global.chessGames[challengerUser.id] != undefined){
        await interaction.reply("You're already in a game!");
        return true;
    }

    return false
}

function colourInputIsValid(str){
    return str === "w" || str === "b";
}

async function initCollector(interaction, challengerColour, challengedColour, challengerUser, challengedUser){
    const filter = i => i.user.id === challengedUser.id;
    const collector = interaction.channel.createMessageComponentCollector({filter, time: 60000, max: 1});

    collector.on('collect', async i => {
        if (i.customId === 'Accept'){
            await startMatch(interaction, challengerColour, challengedColour, challengerUser, challengedUser);
        }
        else{
            await declineMatch();
        }
    });
}

async function declineMatch(){
    const updatedEmbed = buildDeclinedEmbed()
    await i.update({embeds: [updatedEmbed], components: [] });
}

async function startMatch(interaction, challengerColour, challengedColour, challengerUser, challengedUser){
    interaction.options.getString('colour')

    // the game itself
    const board = Ic.initBoard({})
    
    // store game in memory, 
    global.chessGames[challengedUser.id] = [board, challengedColour, challengerUser];
    global.chessGames[challengerUser.id] = [global.chessGames[challengedUser.id][0], challengerColour, challengedUser];
    
    // build embed info
    const FEN = (board.fen).replace(/ /g, '%20');
    const description_text = (challengedColour === "w") ? `<@${challengedUser.id}> vs <@${challengerUser.id}>`:`<@${challengerUser.id}> vs <@${challengedUser.id}>` 
    const whiteStr = (challengedColour === "w") ?`<@${challengedUser.id}>`:`<@${challengerUser.id}>`;
    const blackStr = (challengedColour === "w") ?`<@${challengerUser.id}>`:`<@${challengedUser.id}>`;
    const gameEmbed = buildAcceptedEmbed(description_text, whiteStr, blackStr, FEN);
    await i.update({embeds: [gameEmbed], components: []});

    // check for user 
    const challengedTag = await global.statistics.findOne({ where: { userId: challengedUser.id} });
    const challengerTag = await global.statistics.findOne({ where: { userId: challengerUser.id} });

    // doesn't exist
    if(!challengedTag){
        await global.statistics.create({
            userId: challengedUser.id,
            elo: 1000,
            win: 0,
            draw: 0,
            lose: 0,
            matches: 0,
        });
    }
    if(!challengerTag){
        await global.statistics.create({
            userId: challengerUser.id,
            elo: 1000,
            win: 0,
            draw: 0,
            lose: 0,
            matches: 0,
        });
    }
}

function buildEmbedButtons(){
    return new MessageActionRow()
    .addComponents(
        new MessageButton()
            .setCustomId('Accept')
            .setLabel('Accept')
            .setStyle('SUCCESS'),
        new MessageButton()
            .setCustomId('Decline')
            .setLabel('Decline')
            .setStyle('DANGER'),
    );
}

function buildChallengeEmbed(){
    return new MessageEmbed()
    .setColor('#0099ff')
    .setTitle(`Challenge Request!`)
    .setDescription('Click on the buttons below to accept or decline this challenge! \nYou have 60 seconds to accept or decline.');
}

function buildDeclinedEmbed(){
    return new MessageEmbed()
    .setColor('#FF0000')
    .setTitle(`CHALLENGE DECLINED!`)
    .setDescription("Oh well I guess");
}

function buildAcceptedEmbed(description_text, whiteStr, blackStr, FEN){
    return new MessageEmbed()
        .setColor('#00FF00')
        .setTitle(`CHALLENGE ACCEPTED!`)
        .setDescription(description_text)
        .addFields(
            { name: 'White', value: whiteStr},
            { name: 'Black', value: blackStr},
        )
        .setImage(`https://fen2png.com/api/?fen=${FEN}&raw=true`)
        .setFooter({ text: 'Use /move to make a move.'})
}