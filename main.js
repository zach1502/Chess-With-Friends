const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Intents } = require('discord.js');
const { token } = require('./config.json');
const Sequelize = require('sequelize');

const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

// command set up
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// events set up
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

// fetch commands
for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	// Set a new item in the Collection
	// With the key as the command name and the value as the exported module
	client.commands.set(command.data.name, command);
}

// fetch events
for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

// init database
const sequelize = new Sequelize('database', 'user', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	// SQLite only
	storage: 'database.sqlite',
});

// user_id: [elo, win, draw, loss]
global.statistics = sequelize.define('chessStats', {
	userId: Sequelize.TEXT,
	elo:{
		type: Sequelize.DOUBLE,
		defaultValue: 1000,
		allowNull: false,
	},
	win:{
		type: Sequelize.INTEGER,
		defaultValue: 0,
		allowNull: false,
	},
	draw:{
		type: Sequelize.INTEGER,
		defaultValue: 0,
		allowNull: false,
	},
	lose:{
		type: Sequelize.INTEGER,
		defaultValue: 0,
		allowNull: false,
	},
	matches:{
		type: Sequelize.INTEGER,
		defaultValue: 0,
		allowNull: false,
	}
});

// should be kept in memory for speed
global.chessGames = {
	// user_id: [chessboard, colour, opponent id]
}


client.on('interactionCreate', async interaction => {
	console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered an interaction.`);
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);
	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

// button interactions
client.on('interactionCreate', interaction => {
	if (!interaction.isButton()) return;
});

client.login(token);