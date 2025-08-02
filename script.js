require("dotenv").config();
const fetch = require("node-fetch");
const { promises: fs } = require("fs");
const fsSync = require("fs");
const path = require("path");
const { Client, GatewayIntentBits } = require("discord.js");

const guildName = process.env.GUILD_NAME;

const CHANGES_LOG_FILE = path.resolve(__dirname, "changes_log.txt");
const CSV_FILE = path.resolve(__dirname, "guild_members.csv");
const OLD_CSV_FILE = path.resolve(__dirname, "guild_members_old.csv");
const BANNED_FILE = path.resolve(__dirname, "banned_players.json");

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});
let channel;
let wordleChannel;
let discordGuild;

const SKYBLOCK_ROLES = {
	"480-519": "480 - 519",
	"440-479": "440 - 479",
	"400-439": "400 - 439",
	"360-399": "360 - 399",
	"320-359": "320 - 359",
	"280-319": "280 - 319",
	"240-279": "240 - 279",
	"200-239": "200 - 239",
	"160-199": "160 - 199",
	"120-159": "120 - 159",
	"80-119": "80 - 119",
	"40-79": "40 - 79",
	"0-39": "0 - 39",
};

const CATACOMBS_ROLES = {
	"Below 30": null,
	"30-35": "Cata 30+",
	"35-40": "Cata 35+",
	"40-45": "Cata 40+",
	"45-50": "Cata 45+",
	MAX: "Cata 50+",
};

const NOT_IN_GUILD_ROLE = "Not in guild";

function waitForDiscordReady() {
	return new Promise(resolve => {
		if (client.isReady()) {
			resolve();
		} else {
			client.once("ready", resolve);
		}
	});
}

function getTodayDateString() {
	const today = new Date();
	return today.toISOString().split("T")[0];
}

function parseWordleMessage(content) {
	const patterns = [/X\/6:\s*(<@\d+>(?:\s+<@\d+>)*)/, /X\/6[:\s]+(<@[^>]+>(?:\s+<@[^>]+>)*)/];

	for (const pattern of patterns) {
		const match = content.match(pattern);
		if (match) {
			console.log("Found X/6 match:", match[1]);
			const mentions = match[1].match(/<@(\d+)>/g);
			if (mentions) {
				const userIds = mentions.map(mention => mention.match(/<@(\d+)>/)[1]);
				console.log("Extracted user IDs:", userIds);
				return userIds;
			}
		}
	}

	if (content.includes("X/6")) {
		const afterX6 = content.split("X/6")[1];
		if (afterX6) {
			console.log("Content after X/6:", afterX6);
			const mentions = afterX6.match(/<@(\d+)>/g);
			if (mentions) {
				const userIds = mentions.map(mention => mention.match(/<@(\d+)>/)[1]);
				console.log("Aggressively extracted user IDs:", userIds);
				return userIds;
			}
		}
	}

	return [];
}

async function checkWordleResults() {
	if (!wordleChannel) {
		console.log("Wordle channel not configured, skipping Wordle check");
		return;
	}

	try {
		console.log("Checking for today's Wordle results...");

		const today = getTodayDateString();
		const yesterday = getYesterdayDateString();

		console.log("Looking for messages from:", today);

		const messages = await wordleChannel.messages.fetch({ limit: 50 });
		console.log(`Fetched ${messages.size} messages`);

		let foundTodaysWordle = false;

		function formatMentions(ids) {
			if (ids.length === 1) return `<@${ids[0]}>`;
			const mentions = ids.map(id => `<@${id}>`);
			return `${mentions.slice(0, -1).join(", ")} and ${mentions.slice(-1)}`;
		}

		const singleFailureMessages = [
			"%s got folded by five letters. Pathetic.",
			"Wordle dunked on %s without mercy.",
			"Five letters. Infinite brain farts. Nice work, %s.",
			"%s tried. Wordle laughed.",
			"Today's Wordle MVP: not %s, that's for sure.",
			"One braincell was not enough, %s.",
			"Wordle handed %s a personal L.",
			"%s got outplayed by the dictionary.",
			"Utter collapse by %s. Shameful stuff.",
			"%s couldn't spell 'win' today.",
			"%s's Wordle skills just entered witness protection.",
			"The word was easy. %s still failed gloriously.",
			"%s just invented a new way to fail Wordle.",
			"%s made Wordle look like rocket science.",
			"%s guessed vibes instead of letters.",
			"One guess in, %s was already lost.",
			"%s just got sent to Wordle rehab.",
			"Retire from Wordle, %s. For everyone's sake.",
			"This wasn't even a hard word, %s.",
			"%s failed so hard, it echoed.",
			"%s dropped the ball, then stomped on it.",
			"You misspelled failure as %s.",
			"Wordle took %s's lunch money.",
			"%s's guesses looked like static noise.",
			"%s just nuked a streak in record time.",
			"We expected failure. %s still surprised us.",
			"Even random letters would've done better than %s.",
			"No notes. Just embarrassment for %s.",
			"Wordle said 'Try again.' %s said 'I can't.'",
			"%s guessed everything but the answer.",
			"We watched it happen in slow motion. %s failed hard.",
			"Next time, just don't, %s.",
			"If losing was art, %s is Picasso.",
			"%s forgot how words work.",
			"%s's performance was aggressively incorrect.",
			"Another day, another L for %s.",
			"%s went full chaos mode. No survivors.",
			"This isn't Wordle. It's %s's crime scene.",
			"Nobody failed like %s failed today.",
			"%s got lost somewhere between W and E.",
			"%s went in confident and came out crying.",
			"%s versus Wordle: fatality.",
			"Five-letter word: loser. Synonym: %s.",
			"Disappointment has a name. It's %s.",
			"%s just rage quit learning altogether.",
			"%s: a cautionary tale in real time.",
			"%s guessed like they were blindfolded and panicking.",
			"%s needs a dictionary and a hug.",
			"You tried, %s. You shouldn't have.",
			"Wordle wasn't hard. %s just is.",
		];

		const multipleFailureMessages = [
			"%s fumbled the bag in glorious sync.",
			"Not one of you, %s, got it right. Impressive.",
			"%s turned Wordle into a public meltdown.",
			"So much failure in one group. Thanks, %s.",
			"Five-letter word for disaster? %s.",
			"%s: collective proof that guessing is not thinking.",
			"%s made it look like a group challenge to lose.",
			"Nobody expected a group fail. Then came %s.",
			"Every single guess from %s was worse than the last.",
			"Wordle wasn't ready for the mess %s brought.",
			"At least %s were consistent — consistently wrong.",
			"Guessing blindfolded? %s sure were.",
			"United in chaos: %s.",
			"Wordle delivered a curb stomp to %s.",
			"Zero for %s. Absolute carnage.",
			"Wordle posted your results to 'r/cringe', %s.",
			"Today we mourn the attempt by %s.",
			"%s turned five letters into a horror show.",
			"If there were a team trophy for failing, %s just earned it.",
			"%s tanked like it was a group project.",
			"We witnessed synchronized defeat. Thanks, %s.",
			"%s treated Wordle like a spelling bee from hell.",
			"%s are banned from vocabulary permanently.",
			"This wasn't solving. It was butchery by %s.",
			"%s guessed like they were dodging the answer.",
			"Wordle beat %s with a five-letter word and a dream.",
			"%s failed in stereo. Outstanding.",
			"Even auto-fill would've done better than %s.",
			"A dictionary cried when it saw %s play.",
			"Everyone lost. %s just lost louder.",
			"It's called Wordle, not 'How to Fail' — take notes, %s.",
			"%s managed to disappoint expectations already on the floor.",
			"%s redefined what group failure looks like.",
			"This wasn't a puzzle. It was a trap, and %s fell in.",
			"Watching %s fail was today's entertainment.",
			"Five guesses, zero brain cells. Well done, %s.",
			"We hoped for the best. Then %s showed up.",
			"Not even divine intervention could've helped %s.",
			"%s vs. Wordle: history's saddest war.",
			"Wordle walked. %s tripped over it.",
			"Group chat now muted due to %s's performance.",
			"Nobody failed harder, faster, or dumber than %s.",
			"Wordle will never recover from witnessing %s.",
			"Hope died the moment %s started guessing.",
			"Wordle was easy. %s still summoned disaster.",
			"A storm of dumb hit today. It was %s.",
			"%s ruined a streak and some friendships.",
			"We expected noise. We got catastrophe. Thanks, %s.",
			"Let's never speak of %s's Wordle attempt again.",
			"Worst-case scenario: %s made it real.",
		];

		for (const message of messages.values()) {
			const messageDate = message.createdAt.toISOString().split("T")[0];

			if (messageDate !== today) {
				continue;
			}

			const content = message.content;

			if (content.includes("Here are yesterday's results:") && content.includes("X/6")) {
				console.log("Found today's Wordle results message!");
				foundTodaysWordle = true;

				const failedUserIds = parseWordleMessage(content);

				console.log(`Found ${failedUserIds.length} failed Wordle attempts.`);

				const mentionsFormatted = formatMentions(failedUserIds);
				const messageTemplates = failedUserIds.length === 1 ? singleFailureMessages : multipleFailureMessages;
				const replyText = messageTemplates[Math.floor(Math.random() * messageTemplates.length)].replace("%s", mentionsFormatted);

				if (wordleChannel) {
					await message.reply(replyText);
					console.log("Replied to Wordle results message");
				}

				break;
			}
		}

		if (!foundTodaysWordle) {
			console.log("No Wordle results found for today, checking yesterday...");
			console.log("Looking for messages from:", yesterday);

			for (const message of messages.values()) {
				const messageDate = message.createdAt.toISOString().split("T")[0];

				if (messageDate !== yesterday) {
					continue;
				}

				const content = message.content;

				if (content.includes("Here are yesterday's results:") && content.includes("X/6")) {
					console.log("Found yesterday's Wordle results message!");

					const failedUserIds = parseWordleMessage(content);

					console.log(`Found ${failedUserIds.length} failed Wordle attempts from yesterday.`);

					const mentionsFormatted = formatMentions(failedUserIds);
					const messageTemplates = failedUserIds.length === 1 ? singleFailureMessages : multipleFailureMessages;
					const replyText = messageTemplates[Math.floor(Math.random() * messageTemplates.length)].replace("%s", mentionsFormatted);

					if (wordleChannel) {
						await message.reply(replyText);
						console.log("Replied to yesterday's Wordle results message");
					}

					break;
				}
			}
		}

		if (!foundTodaysWordle) {
			console.log("No Wordle results found for today or yesterday");
		}
	} catch (error) {
		console.error("Error checking Wordle results:", error);
	}
}

function getYesterdayDateString() {
	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	return yesterday.toISOString().split("T")[0];
}

client.login(process.env.DC_TOKEN);
client.once("ready", async () => {
	try {
		channel = await client.channels.fetch(process.env.CHANNEL_ID);
		discordGuild = await client.guilds.fetch(process.env.GUILD_ID);

		if (process.env.WORDLE_CHANNEL) {
			try {
				wordleChannel = await client.channels.fetch(process.env.WORDLE_CHANNEL);
				console.log(`Connected to Wordle channel: ${wordleChannel.name}`);
			} catch (error) {
				console.error("Error setting up Wordle channel:", error);
				console.log("Make sure WORDLE_CHANNEL is correct in your .env file");
			}
		} else {
			console.log("WORDLE_CHANNEL not configured in .env file");
		}

		console.log(`Connected to Discord server: ${discordGuild.name}`);
	} catch (error) {
		console.error("Error setting up Discord connection:", error);
		console.log("Make sure GUILD_ID and CHANNEL_ID are correct in your .env file");
	}
});

function getDungeonLevel(experience) {
	const catacombsXpTable = [50, 75, 110, 160, 230, 330, 470, 670, 950, 1340, 1890, 2665, 3760, 5260, 7380, 10300, 14400, 20000, 27600, 38000, 52500, 71500, 97000, 132000, 180000, 243000, 328000, 445000, 600000, 800000, 1065000, 1410000, 1900000, 2500000, 3300000, 4300000, 5600000, 7200000, 9200000, 12000000, 15000000, 19000000, 24000000, 30000000, 38000000, 48000000, 60000000, 75000000, 93000000, 116250000];
	let totalExperience = 0;
	for (let levelIndex = 0; levelIndex < catacombsXpTable.length; levelIndex++) {
		totalExperience += catacombsXpTable[levelIndex];
		if (experience < totalExperience) return levelIndex;
	}
	return 50;
}

function getCatacombsBracket(level) {
	if (level >= 50) return "MAX";
	if (level >= 45) return "45-50";
	if (level >= 40) return "40-45";
	if (level >= 35) return "35-40";
	if (level >= 30) return "30-35";
	return "Below 30";
}

function getSkyblockBracket(level) {
	const low = Math.floor(level / 40) * 40;
	const high = low + 39;
	return `${low}-${high}`;
}

async function logChange(message) {
	console.log(message);
	const timestamp = new Date().toISOString();
	const logMessage = `[${timestamp}] ${message}\n`;
	await fs.appendFile(CHANGES_LOG_FILE, logMessage);
	if (channel) await channel.send(message);
}

async function detectChangesAndLog(previousData, currentData) {
	const prev = new Set(Object.keys(previousData));
	const curr = new Set(Object.keys(currentData));

	for (const uuid of curr) {
		if (!prev.has(uuid)) {
			await logChange(`Welcome to our guild ${currentData[uuid].username}!`);
		}
	}

	for (const uuid of prev) {
		if (!curr.has(uuid)) {
			await logChange(`Member left: ${previousData[uuid].username}`);
		}
	}

	for (const uuid of curr) {
		if (prev.has(uuid)) {
			const a = previousData[uuid],
				b = currentData[uuid];
			if (a.catacombsBracket !== b.catacombsBracket) {
				await logChange(`Congratulations ${b.username} on reaching Catacombs level bracket ${b.catacombsBracket}! Enjoy your new role!`);
			}
			if (a.skyblockLevel !== b.skyblockLevel) {
				await logChange(`Congratulations ${b.username} on reaching Skyblock level bracket ${b.skyblockLevel}! Enjoy your new role!`);
			}
		}
	}
}

async function loadBannedPlayers() {
	try {
		const data = await fs.readFile(BANNED_FILE, "utf8");
		return new Set(JSON.parse(data));
	} catch {
		await fs.writeFile(BANNED_FILE, "[]", "utf8");
		return new Set();
	}
}

async function getDiscordMemberMapping() {
	if (!discordGuild) {
		console.log("Discord guild not available, skipping Discord integration");
		return { nicknameMap: new Map(), memberObjectMap: new Map() };
	}

	try {
		console.log("Fetching Discord server members...");
		await discordGuild.members.fetch();
		const members = discordGuild.members.cache;

		const nicknameMap = new Map();
		const memberObjectMap = new Map();

		members.forEach(member => {
			const displayName = member.displayName;
			const username = member.user.username;
			nicknameMap.set(displayName.toLowerCase(), username);
			memberObjectMap.set(displayName.toLowerCase(), member);
			if (displayName !== username) {
				nicknameMap.set(username.toLowerCase(), username);
				memberObjectMap.set(username.toLowerCase(), member);
			}
		});

		console.log(`Loaded ${nicknameMap.size} Discord member mappings`);
		return { nicknameMap, memberObjectMap };
	} catch (error) {
		console.error("Error fetching Discord members:", error);
		return { nicknameMap: new Map(), memberObjectMap: new Map() };
	}
}

function findDiscordUsername(minecraftIGN, discordMap) {
	if (!minecraftIGN || minecraftIGN === "undefined") return null;
	const lowerIGN = minecraftIGN.toLowerCase();
	return discordMap.get(lowerIGN) || null;
}

function findDiscordMemberByUsername(username, memberObjectMap) {
	if (!username || username === "undefined") return null;
	return memberObjectMap.get(username.toLowerCase()) || null;
}

function hasAnyRoles(discordMember) {
	return discordMember.roles.cache.size > 1;
}

async function updateDiscordNickname(discordMember, newNickname) {
	if (!discordMember) return;
	try {
		if (discordMember.displayName !== newNickname) {
			await discordMember.setNickname(newNickname);
			console.log(`Updated Discord nickname for ${discordMember.user.username} to ${newNickname}`);
		}
	} catch (error) {
		console.error(`Error updating nickname for ${discordMember.user.username}:`, error);
		if (error.code === 50013) {
			console.error("Bot lacks permissions to manage nicknames. Make sure the bot has 'Manage Nicknames' permission.");
		}
	}
}

async function manageUserRoles(discordMember, skyblockBracket, catacombsBracket, isInGuild = true) {
	if (!discordMember || !discordGuild) {
		console.log("Discord member or guild not available for role management");
		return;
	}

	try {
		console.log(`Managing roles for ${discordMember.displayName}: SB Bracket ${skyblockBracket}, Catacombs ${catacombsBracket}, In Guild: ${isInGuild}`);
		const allRoles = discordGuild.roles.cache;
		const notInGuildRole = allRoles.find(r => r.name === NOT_IN_GUILD_ROLE);
		const botRole = allRoles.find(r => r.name === "Bot");

		if (!hasAnyRoles(discordMember)) {
			console.log(`${discordMember.displayName} has no roles (unverified), skipping role management`);
			return;
		}

		const hasBotRole = botRole && discordMember.roles.cache.has(botRole.id);

		if (!isInGuild) {
			if (notInGuildRole && !discordMember.roles.cache.has(notInGuildRole.id) && !hasBotRole) {
				await discordMember.roles.add(notInGuildRole);
				console.log(`Added "Not in guild" role to ${discordMember.displayName}`);
			}
			return;
		} else {
			if (notInGuildRole && discordMember.roles.cache.has(notInGuildRole.id)) {
				await discordMember.roles.remove(notInGuildRole);
				console.log(`Removed "Not in guild" role from ${discordMember.displayName}`);
			}
		}

		const skyblockRolesToRemove = [];
		Object.values(SKYBLOCK_ROLES).forEach(roleName => {
			if (roleName && roleName !== SKYBLOCK_ROLES[skyblockBracket]) {
				const role = allRoles.find(r => r.name === roleName);
				if (role && discordMember.roles.cache.has(role.id)) {
					skyblockRolesToRemove.push(role);
				}
			}
		});

		const catacombsRolesToRemove = [];
		Object.values(CATACOMBS_ROLES).forEach(roleName => {
			if (roleName && roleName !== CATACOMBS_ROLES[catacombsBracket]) {
				const role = allRoles.find(r => r.name === roleName);
				if (role && discordMember.roles.cache.has(role.id)) {
					catacombsRolesToRemove.push(role);
				}
			}
		});

		if (skyblockRolesToRemove.length > 0) {
			await discordMember.roles.remove(skyblockRolesToRemove);
			console.log(`Removed old Skyblock roles from ${discordMember.displayName}: ${skyblockRolesToRemove.map(r => r.name).join(", ")}`);
		}

		if (catacombsRolesToRemove.length > 0) {
			await discordMember.roles.remove(catacombsRolesToRemove);
			console.log(`Removed old Catacombs roles from ${discordMember.displayName}: ${catacombsRolesToRemove.map(r => r.name).join(", ")}`);
		}

		const skyblockRoleName = SKYBLOCK_ROLES[skyblockBracket];
		if (skyblockRoleName) {
			const skyblockRole = allRoles.find(r => r.name === skyblockRoleName);
			if (skyblockRole) {
				if (!discordMember.roles.cache.has(skyblockRole.id)) {
					await discordMember.roles.add(skyblockRole);
					console.log(`Added Skyblock role "${skyblockRoleName}" to ${discordMember.displayName}`);
				} else {
					console.log(`${discordMember.displayName} already has Skyblock role "${skyblockRoleName}"`);
				}
			} else {
				console.log(`Skyblock role "${skyblockRoleName}" not found on server`);
			}
		} else {
			console.log(`No Skyblock role mapping found for bracket "${skyblockBracket}"`);
		}

		const catacombsRoleName = CATACOMBS_ROLES[catacombsBracket];
		if (catacombsRoleName) {
			const catacombsRole = allRoles.find(r => r.name === catacombsRoleName);
			if (catacombsRole) {
				if (!discordMember.roles.cache.has(catacombsRole.id)) {
					await discordMember.roles.add(catacombsRole);
					console.log(`Added Catacombs role "${catacombsRoleName}" to ${discordMember.displayName}`);
				} else {
					console.log(`${discordMember.displayName} already has Catacombs role "${catacombsRoleName}"`);
				}
			} else {
				console.log(`Catacombs role "${catacombsRoleName}" not found on server`);
			}
		} else {
			console.log(`No Catacombs role for bracket "${catacombsBracket}"`);
		}
	} catch (error) {
		console.error(`Error managing roles for ${discordMember.displayName}:`, error);
		if (error.code === 50013) {
			console.error("Bot lacks permissions to manage roles. Make sure the bot role is above the roles it needs to manage and has 'Manage Roles' permission.");
		}
	}
}

async function handleNotInGuildMembers(currentUsernames, memberObjectMap) {
	if (!discordGuild) return;
	console.log("Checking for Discord members not in guild...");
	for (const discordMember of memberObjectMap.values()) {
		if (!hasAnyRoles(discordMember)) continue;
		const name = discordMember.user.username.toLowerCase();
		const nick = discordMember.displayName.toLowerCase();
		if (!currentUsernames.includes(name) && !currentUsernames.includes(nick)) {
			await manageUserRoles(discordMember, null, null, false);
		}
	}
}

(async () => {
	const args = process.argv.slice(2);
	const wordleOnly = args.includes("wordle");

	const apiKey = process.env.HYPIXEL_API_KEY;

	console.log("Waiting for Discord client to be ready...");
	await waitForDiscordReady();

	await new Promise(resolve => setTimeout(resolve, 2000));

	await checkWordleResults();

	if (wordleOnly) {
		console.log("Wordle-only mode complete.");
		if (client) client.destroy();
		return;
	}

	const bannedSet = await loadBannedPlayers();

	let previousMembers = {};
	const csvData = await fs.readFile(CSV_FILE, "utf8").catch(() => "");
	if (csvData) {
		const lines = csvData.trim().split("\n");
		for (let i = 1; i < lines.length; i++) {
			const parts = lines[i].split(",");
			const [uuid, ign, bracket, lvl] = parts;
			const discordUsername = parts[4] || null;
			previousMembers[uuid] = {
				username: ign,
				catacombsBracket: bracket,
				skyblockLevel: isNaN(+lvl) ? lvl : getSkyblockBracket(+lvl),
				discordUsername: discordUsername === "null" ? null : discordUsername,
			};
		}
	}
	console.log(`Loaded ${Object.keys(previousMembers).length} previous members from CSV`);

	const findRes = await fetch(`https://api.hypixel.net/findGuild?key=${apiKey}&byName=${guildName}`);
	const { success, guild: guildId } = await findRes.json();
	if (!success || !guildId) throw new Error("Guild not found");

	const guildRes = await fetch(`https://api.hypixel.net/guild?key=${apiKey}&id=${guildId}`);
	const guildJson = await guildRes.json();
	if (!guildJson.success || !guildJson.guild) throw new Error("Failed to fetch guild data");
	const members = guildJson.guild.members;

	const { nicknameMap, memberObjectMap } = await getDiscordMemberMapping();

	const currentData = {};
	const csvLines = ["uuid,ign,catacombs,skyblock_bracket,discord_username"];
	let cnt = 0;

	for (const m of members) {
		cnt++;
		console.log(`Processing ${cnt}/${members.length}: ${m.uuid}`);
		let username = "undefined";
		const resp = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${m.uuid}`);
		if (resp.ok) username = (await resp.json()).name || "undefined";

		let bracket = "Below 30",
			maxSB = 0;
		const p = await fetch(`https://api.hypixel.net/v2/skyblock/profiles?key=${apiKey}&uuid=${m.uuid}`);
		const pj = await p.json();
		if (pj.success && pj.profiles.length) {
			let maxXP = 0;
			for (const prof of pj.profiles) {
				const dat = prof.members?.[m.uuid];
				if (!dat) continue;
				const xp = dat.dungeons?.dungeon_types?.catacombs?.experience || 0;
				if (xp > maxXP) maxXP = xp;
				const lvl = Math.floor((dat.leveling?.experience || 0) / 100);
				if (lvl > maxSB) maxSB = lvl;
			}
			bracket = getCatacombsBracket(getDungeonLevel(maxXP));
		}

		const skyBracket = getSkyblockBracket(maxSB);

		let discordUsername = null;
		let discordMember = null;

		if (previousMembers[m.uuid] && previousMembers[m.uuid].discordUsername) {
			discordUsername = previousMembers[m.uuid].discordUsername;
			discordMember = findDiscordMemberByUsername(discordUsername, memberObjectMap);
			if (discordMember) {
				const previousIGN = previousMembers[m.uuid].username;
				if (previousIGN !== username && username !== "undefined") {
					await logChange(`${previousIGN} changed their Minecraft username to ${username}.`);
					await updateDiscordNickname(discordMember, username);
				}
			}
		} else {
			discordUsername = findDiscordUsername(username, nicknameMap);
			discordMember = username !== "undefined" ? memberObjectMap.get(username.toLowerCase()) : null;
		}

		if (discordMember) {
			await manageUserRoles(discordMember, skyBracket, bracket, true);
		} else if (username !== "undefined") {
			console.log(`Discord member not found for Minecraft user: ${username}`);
		}

		currentData[m.uuid] = {
			username,
			catacombsBracket: bracket,
			skyblockLevel: skyBracket,
			discordUsername: discordUsername,
		};

		const discordUsernameForCSV = discordUsername || "null";
		csvLines.push(`${m.uuid},${username},${bracket},${skyBracket},${discordUsernameForCSV}`);

		if (bannedSet.has(m.uuid)) {
			await logChange(`Banned player detected in guild: ${username} (${m.uuid})`);
		}
	}

	const currentDiscordUsernames = Object.values(currentData)
		.map(u => u.discordUsername)
		.filter(Boolean)
		.map(n => n.toLowerCase());
	await handleNotInGuildMembers(currentDiscordUsernames, memberObjectMap);

	await fs.copyFile(CSV_FILE, OLD_CSV_FILE);
	await fs.writeFile(CSV_FILE, csvLines.join("\n"), "utf8");
	console.log(`Wrote ${csvLines.length - 1} members to CSV with Discord usernames`);

	if (fsSync.existsSync("guild_members.csv")) {
		console.log("Detecting changes...");
		await detectChangesAndLog(previousMembers, currentData);
	} else {
		console.log("CSV file does not exist, not sending any messages in the channel.");
	}

	console.log("Done.");
	if (client) client.destroy();
})();
