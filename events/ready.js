
module.exports = {
	name: 'ready',
	once: true,
	execute(client) {
		global.statistics.sync();
		console.log(`Ready! Logged in as ${client.user.tag}`);
	},
};