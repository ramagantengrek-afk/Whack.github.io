const { Client, GatewayIntentBits, Routes, SlashCommandBuilder } = require('discord.js');
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

// 1. SETUP DATABASE (SQLite)
// Di Railway, file database akan disimpan di folder /data agar permanen
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.RAILWAY_VOLUME_MOUNT_PATH ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/database.sqlite` : './database.sqlite',
    logging: false
});

// Model Database untuk Inventory Pokemon
const Inventory = sequelize.define('Inventory', {
    userId: { type: DataTypes.STRING, allowNull: false },
    pokemonName: { type: DataTypes.STRING, allowNull: false }
});

// 2. SETUP DISCORD CLIENT
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let wildPokemon = null;

const COUNTER_CHANNELS = {
    total: process.env.CHANNEL_TOTAL || 'ID_CHANNEL_TOTAL',
    bots: process.env.CHANNEL_BOTS || 'ID_CHANNEL_BOTS',
    online: process.env.CHANNEL_ONLINE || 'ID_CHANNEL_ONLINE'
};

async function updateCounters(guild) {
    try {
        const members = await guild.members.fetch({ withPresences: true });
        const totalCount = members.filter(m => !m.user.bot).size;
        const botCount = members.filter(m => m.user.bot).size;
        const onlineCount = members.filter(m => !m.user.bot && m.presence && m.presence.status !== 'offline').size;

        const totalChan = guild.channels.cache.get(COUNTER_CHANNELS.total);
        const botsChan = guild.channels.cache.get(COUNTER_CHANNELS.bots);
        const onlineChan = guild.channels.cache.get(COUNTER_CHANNELS.online);

        if (totalChan) await totalChan.setName(`👥 Total Member: ${totalCount}`);
        if (botsChan) await botsChan.setName(`🤖 Bots: ${botCount}`);
        if (onlineChan) await onlineChan.setName(`🟢 Online: ${onlineCount}`);
    } catch (error) {
        console.error('Counter error:', error);
    }
}

client.once('ready', async () => {
    console.log(`Bot Online: ${client.user.tag}`);
    
    // Sinkronisasi Database
    await sequelize.sync();
    console.log('Database SQLite berhasil terhubung & disinkronkan!');

    // Registrasi Slash Commands
    const commands = [
        new SlashCommandBuilder().setName('pokemon').setDescription('Cek status pokemon liar saat ini'),
        new SlashCommandBuilder().setName('catch').setDescription('Tangkap pokemon liar!').addStringOption(option => option.setName('nama').setDescription('Nama pokemon').setRequired(true)),
        new SlashCommandBuilder().setName('bag').setDescription('Lihat koleksi Pokemon kamu')
    ];

    const rest = new (require('@discordjs/rest').REST)({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    } catch (e) { console.error(e); }

    // Loop Counter (10 Menit)
    setInterval(() => {
        client.guilds.cache.forEach(guild => updateCounters(guild));
    }, 10 * 60 * 1000);

    // Loop Spawn Pokemon (5 Menit)
    const pokemonList = ['Pikachu', 'Charmander', 'Bulbasaur', 'Squirtle', 'Eevee', 'Mewtwo'];
    setInterval(() => {
        wildPokemon = pokemonList[Math.floor(Math.random() * pokemonList.length)];
        console.log(`[SPAWN] ${wildPokemon} muncul!`);
    }, 5 * 60 * 1000);
});

client.on('guildMemberAdd', m => updateCounters(m.guild));
client.on('guildMemberRemove', m => updateCounters(m.guild));
client.on('presenceUpdate', (o, n) => { if(n) updateCounters(n.guild); });

// HANDLE INTERACTION (SYSTEM POKEMON)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, user } = interaction;

    if (commandName === 'pokemon') {
        if (wildPokemon) return interaction.reply(`⚠️ **${wildPokemon}** liar sedang muncul! Tangkap dengan \`/catch\``);
        await interaction.reply('Belum ada pokemon liar saat ini.');
    }

    if (commandName === 'catch') {
        const guess = interaction.options.getString('nama');
        if (!wildPokemon) return interaction.reply('Tidak ada pokemon di sekitar sini.');

        if (guess.toLowerCase() === wildPokemon.toLowerCase()) {
            // SIMPAN KE DATABASE SQLITE
            await Inventory.create({ userId: user.id, pokemonName: wildPokemon });

            await interaction.reply(`🎉 Hore! ${user} berhasil menangkap **${wildPokemon}**! (Data tersimpan aman di database)`);
            wildPokemon = null;
        } else {
            await interaction.reply(`❌ Salah! Itu bukan **${guess}**.`);
        }
    }

    if (commandName === 'bag') {
        // AMBIL DARI DATABASE SQLITE
        const userBag = await Inventory.findAll({ where: { userId: user.id } });
        
        if (userBag.length === 0) return interaction.reply('Tas kamu kosong.');
        
        const listPokemon = userBag.map((p, index) => `${index + 1}. ${p.pokemonName}`).join('\n');
        await interaction.reply(`🎒 **Koleksi Pokemon ${user.username}:**\n${listPokemon}`);
    }
});

client.login(process.env.DISCORD_TOKEN);
