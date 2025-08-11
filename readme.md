# What is this project?

This is a discord bot made to update roles in Hypixel Skyblock related servers. It fetches fresh guild data from the official API, then compares them with the current server roles, and updates if changes needed.

## Technologies Used

JavaScript

## Step by step running guide

Firstly, download NPM and Node.js from official sources      

Secondly, create a file in this folder named .env with these contents:   
   
HYPIXEL_API_KEY = xxxxx --> Get from hypixel developer portal (needs to be refreshed every day)   
DC_TOKEN = xxxxx --> Token of the Discord Bot   
GUILD_NAME = xxxxx --> Skyblock Guild Name   
CHANNEL_ID = xxxxx --> Right click discord channel and press "Copy ID"   
GUILD_ID = xxxxx --> Right click discord server and press "Copy ID"  
WORDLE_CHANNEL = xxxxx --> The channel ID where the Wordle is being played (You can leave this empty) 

Finally, run by typing: node script.js