import os
import discord
from discord.ext import tasks, commands
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")
GUILD_ID = int(os.getenv("GUILD_ID"))
TOTAL_PLAYER_CHANNEL_ID = int(os.getenv("TOTAL_PLAYER_CHANNEL_ID"))
TOTAL_BOT_CHANNEL_ID = int(os.getenv("TOTAL_BOT_CHANNEL_ID"))
PLAYER_ONLINE_CHANNEL_ID = int(os.getenv("PLAYER_ONLINE_CHANNEL_ID"))

intents = discord.Intents.default()
intents.guilds = True
intents.members = True
intents.presences = True

bot = commands.Bot(command_prefix="!", intents=intents)


def count_stats(guild: discord.Guild):
    total_bots = 0
    total_players = 0
    player_online = 0

    for member in guild.members:
        if member.bot:
            total_bots += 1
        else:
            total_players += 1
            if member.status in [discord.Status.online, discord.Status.idle, discord.Status.dnd]:
                player_online += 1

    return total_players, total_bots, player_online


async def update_voice_channel(channel_id: int, name: str):
    channel = bot.get_channel(channel_id)
    if channel:
        try:
            await channel.edit(name=name)
        except Exception as e:
            print(f"Gagal update channel {channel_id}: {e}")


@tasks.loop(seconds=30)
async def update_counters():
    guild = bot.get_guild(GUILD_ID)
    if not guild:
        return

    total_players, total_bots, player_online = count_stats(guild)

    await update_voice_channel(TOTAL_PLAYER_CHANNEL_ID, f"👥 Player: {total_players}")
    await update_voice_channel(TOTAL_BOT_CHANNEL_ID, f"🤖 Bot: {total_bots}")
    await update_voice_channel(PLAYER_ONLINE_CHANNEL_ID, f"🟢 Online: {player_online}")


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user} ({bot.user.id})")
    if not update_counters.is_running():
        update_counters.start()


@bot.command()
async def ping(ctx):
    await ctx.send("Pong!")


bot.run(TOKEN)