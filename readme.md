# What is this project?

This is a discord bot made to update roles in Hypixel Skyblock related servers. It fetches fresh guild data from the official API, then compares them with the current server roles, and updates if changes needed.

## Technologies Used

JavaScript

## Step by step running guide

Create .env with these contents:

HYPIXEL_API_KEY = xxxxx --> Get from hypixel developer portal (needs to be refreshed every day)
DC_TOKEN = xxxxx --> Discord bots token
GUILD_NAME = xxxxx --> Skyblock Guild Name
CHANNEL_ID = xxxxx --> Right click discord channel and press "Copy ID"
GUILD_ID = xxxxx --> Right click discord server and press "Copy ID"

run by: node script.js