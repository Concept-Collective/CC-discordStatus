const fs = require('node:fs');
const path = require('node:path');
const fetch = require('node-fetch');


// Serverside Configuration
const root = GetResourcePath(GetCurrentResourceName());
let env_config = require(path.join(root, 'env.js'));

// Requires external module due to JSONC not being a standard JSON format
const parser = require('jsonc-parser');
const config = parser.parse(LoadResourceFile('ccDiscordWrapper', 'config.jsonc'))

// Discord.js initialisation for Discord Bot Module
const { Client, Collection, GatewayIntentBits, EmbedBuilder, WebhookClient } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMembers] });

// Support Checker - Checks if the resource is named correctly
on("onResourceStart", async (resourceName) => {
	if (GetCurrentResourceName() !== "ccDiscordWrapper" && config.supportChecker === true) {
		return console.warn(`^6[Warning]^0 For better support, it is recommended that "${GetCurrentResourceName()}" be renamed to "ccDiscordWrapper"^0`);
	}
	if (GetCurrentResourceName() === resourceName && config.versionChecker === true){
		const response = await fetch('https://api.github.com/repos/Concept-Collective/ccDiscordWrapper/releases/latest')
		const json = await response.json()
		if (json.tag_name !== `v${GetResourceMetadata(GetCurrentResourceName(), 'version', 0)}`){
			console.warn(`^3[WARNING]^0 ccDiscordWrapper is out of date! Please update to the latest version: ^2${json.tag_name}^0`)
		} else {
			console.log('^2[INFO]^0 ccDiscordWrapper is up to date!')
		}
	}
});

// Discord Bot Module
if (config.DiscordBot.enabled === true){
	discordProcess();
}

function discordProcess() {
	client.commands = new Collection();
	client.discord = require('discord.js');
	client.config = config;
	client.players = {};
	client.statusMessage = null;
	
	const commandsPath = path.join(root, 'server', 'commands');
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
	
	const eventsPath = path.join(root, 'server', 'events');
	const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
	
	for (const file of eventFiles) {
		const filePath = path.join(eventsPath, file);
		const event = require(filePath);
		if (event.once) {
			client.once(event.name, (...args) => event.execute(...args));
		} else {
			client.on(event.name, (...args) => event.execute(...args));
		}
	}
	
	client.login(env_config.Discord_Token);
	
	// Discord Bot Module - senNewMessage function
	async function botSendNewMessage(channelId, message){
		const channel = await client.channels.cache.get(channelId);
		getGuildUsersandRolesforIngamePlayers(channel.guild.id)
		let newEmbed = new client.discord.EmbedBuilder()
		.setColor(0x0099FF)
		.setTitle(`${message[0]}`)
		.setDescription(`${message[1]}`)
		.setTimestamp()
		.setFooter({ text: 'This message was generated by ccDiscordWrapper', iconURL: 'https://conceptcollective.net/img/icon.png', URL: 'https://conceptcollective.net' });
		await channel.send({embeds: [newEmbed]});
	}
	
	async function webhookSendNewMessage(color, name, message, footer) {
		const webhookClient = new WebhookClient({ url: env_config.Discord_Webhook });
		let embed = new EmbedBuilder()
			.setColor(color)
			.setTitle(name)
			.setDescription(message)
			.setTimestamp()
			.setFooter({ text: `${footer} | Generated by ccDiscordWrapper`, iconURL: 'https://conceptcollective.net/img/icon.png', URL: 'https://conceptcollective.net' });

		webhookClient.send({embeds: [embed]});
	}

	function isPlayerInDiscord(source) {
		let playerName = GetPlayerName(source);
		let isPlayerInGuild = client.players[playerName].inGuild
		return isPlayerInGuild
	}

	function getPlayerDiscordAvatar(source) {
		let playerName = GetPlayerName(source);
		let avatarURL = client.players[playerName].avatarURL
		return avatarURL
	}

	function getPlayerDiscordRoles(source) {
		let playerName = GetPlayerName(source);
		let roles = client.players[playerName].roles
		return roles
	}

	function getPlayerDiscordHighestRole(source, type) {
		let playerName = GetPlayerName(source);
		if (type === "name") {
			let highestRole = client.players[playerName].roles[0].name
			return highestRole
		} else {
			let highestRole = client.players[playerName].roles[0]
			return highestRole
		}
	}
	
	function checkIfPlayerHasRole(source, role, type) {
		let playerName = GetPlayerName(source);
		if (type === "name"){
			let hasRole = client.players[playerName].roles.filter(rolef => rolef.name === role)
			return hasRole
		} else if (type === "id"){
			let hasRole = client.players[playerName].roles.filter(rolef => rolef.id === role)
			return hasRole
		}
	}

	exports('botSendNewMessage', botSendNewMessage);
	exports('webhookSendNewMessage', webhookSendNewMessage);
	exports('getPlayerDiscordAvatar', getPlayerDiscordAvatar);
	exports('getPlayerDiscordHighestRole', getPlayerDiscordHighestRole);
	exports('isPlayerInDiscord', isPlayerInDiscord);
	exports('checkIfPlayerHasRole', checkIfPlayerHasRole);
	exports('getPlayerDiscordRoles', getPlayerDiscordRoles);
}

if (config.onJoinAdaptiveCard.enabled === true){

	on('playerConnecting', async (playerName, setKickReason, deferrals) => {
		if (config.General.IsDiscordRequired === true){
			let playerDiscordID = GetPlayerIdentifierByType(source, 'discord').substring(8)
			if (!playerDiscordID) {
				setKickReason(`You must have Discord open to join this server!`)
				CancelEvent()
				return
			}
		}
		let adaptiveCard = {
			"$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
			"type": "AdaptiveCard",
			"version": "1.6",
			"body": [
				{
					"type": "ColumnSet",
					"columns": [
						{
							"type": "Column",
							"width": "20px"
						},
						{
							"type": "Column",
							"width": "stretch",
							"items": [
								{
									"type": "TextBlock",
									"text": `${config.onJoinAdaptiveCard.mainTitle}`,
									"wrap": true,
									"style": "heading",
									"horizontalAlignment": "Center",
									"size": "ExtraLarge",
									"maxLines": 1
								}
							]
						}
					]
				},
				{
					"type": "Container",
					"items": [
						{
							"type": "ColumnSet",
							"columns": [
								{
									"type": "Column",
									"width": "auto",
									"items": [
										{
											"type": "Image",
											"url": `${config.onJoinAdaptiveCard.logoURL}`,
											"size": "Medium",
											"altText": "Concept Collective Logo",
											"spacing": "None",
											"horizontalAlignment": "Center"
										},
										{
											"type": "TextBlock",
											"text": `${config.onJoinAdaptiveCard.logoText}`,
											"horizontalAlignment": "Center",
											"weight": "Bolder",
											"wrap": true
										}
									]
								},
								{
									"type": "Column",
									"width": "stretch",
									"separator": true,
									"spacing": "Medium",
									"items": [
										{
											"type": "TextBlock",
											"text": `${new Date().toLocaleString(config.onJoinAdaptiveCard.timeLocale.timeFormat, { timeZone: config.onJoinAdaptiveCard.timeLocale.timeZone })}`,
											"horizontalAlignment": "Center",
											"wrap": true
										},
										{
											"type": "TextBlock",
											"text": `${config.onJoinAdaptiveCard.mainDescription}`,
											"size": "Medium",
											"horizontalAlignment": "Center",
											"wrap": true
										},
										{
											"type": "TextBlock",
											"text": `${config.onJoinAdaptiveCard.otherDescription}`,
											"size": "Large",
											"horizontalAlignment": "Center",
											"style": "heading",
											"wrap": true
										}
									]
								},
								{
									"type": "Column",
									"width": "100px"
								}
							]
						}
					]
				},
				{
					"type": "ColumnSet",
					"columns": [
						{
							"type": "Column",
							"width": "240px"
						},
						{
							"type": "Column",
							"width": "150px",
							"items": [
								{
									"type": "ActionSet",
									"actions": [
										{
											"type": "Action.OpenUrl",
											"title": "Discord",
											"url": "https://discord.conceptcollective.net",
											"style": "positive"
										}
									],
									"spacing": "None",
									"horizontalAlignment": "Center"
								}
							]
						},
						{
							"type": "Column",
							"width": "135px",
							"items": [
								{
									"type": "ActionSet",
									"actions": [
										{
											"type": "Action.Submit",
											"title": "Play Now!",
											"style": "positive",
											"id": "playSubmit"
										}
									]
								}
							]
						},
						{
							"type": "Column",
							"width": "150px",
							"items": [
								{
									"type": "ActionSet",
									"actions": [
										{
											"type": "Action.OpenUrl",
											"title": "Website",
											"style": "positive",
											"url": "https://conceptcollective.net"
										}
									]
								}
							]
						}
					]
				}
			]
		}
		deferrals.defer()
		deferrals.update(`Hello ${playerName}. Your Discord ID is being checked...`)
		try {
			setTimeout(() => {
				deferrals.presentCard(adaptiveCard, function(data, error) {
					if (data.submitId === 'playSubmit') {
						deferrals.done()
					}
				})
			}, 1000)
		}
		catch (e) {
			deferrals.update(`Something went wrong, please check the server console!`)
			console.log(`[ERROR] ${e}`)
			setTimeout(() => {
				deferrals.done()
			}, 1000)
		}
		
	});

}