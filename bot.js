const { 
    Client, GatewayIntentBits, Routes, SlashCommandBuilder, 
    PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder 
} = require('discord.js');
const { Sequelize, DataTypes, Op } = require('sequelize');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 🔴 CENTRAL WEB LOG & GLOBAL EVENT SYSTEM
// ==========================================
const serverLogs = [];
let ACTIVE_EVENT = { name: "Normal Adventure", type: "NONE", multiplier: 1.0, endAt: null };

function logToWeb(message) {
    const time = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const formattedLog = `[${time}] ${message}`;
    console.log(formattedLog);
    serverLogs.unshift(formattedLog);
    if (serverLogs.length > 100) serverLogs.pop();
}

function checkActiveEvent() {
    if (ACTIVE_EVENT.endAt && Date.now() > ACTIVE_EVENT.endAt) {
        logToWeb(`[EVENT] Event "${ACTIVE_EVENT.name}" telah berakhir secara otomatis.`);
        ACTIVE_EVENT = { name: "Normal Adventure", type: "NONE", multiplier: 1.0, endAt: null };
    }
}

// ==========================================
// ⚙️ SYSTEM CONFIG & DATABASE STRUCTURE
// ==========================================
const CONFIG_SETUP = {
    SPAWN_CHANNEL_ID: process.env.SPAWN_CHANNEL_ID || 'ID_TEXT_CHANNEL_SPAWN',
    VOICE_COUNTER_CHANNEL_ID: process.env.VOICE_COUNTER_CHANNEL_ID || 'ID_VOICE_CHANNEL_COUNTER',
    SPAWN_INTERVAL: 20 * 60 * 1000   // ⏱️ 20 MENIT
};

// Fungsi pembantu untuk update Voice Channel Counter
async function updateVoiceCounter(guild) {
    if (!CONFIG_SETUP.VOICE_COUNTER_CHANNEL_ID || CONFIG_SETUP.VOICE_COUNTER_CHANNEL_ID.includes('ID_VOICE_')) return;
    try {
        const channel = await guild.channels.fetch(CONFIG_SETUP.VOICE_COUNTER_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        // Hitung total member di semua voice channel dalam satu server
        let totalVoiceMembers = 0;
        guild.channels.cache.forEach(c => {
            if (c.isVoiceBased()) {
                totalVoiceMembers += c.members.size;
            }
        });

        const newName = `🎙️ Users Online: ${totalVoiceMembers}`;
        if (channel.name !== newName) {
            await channel.setName(newName);
            logToWeb(`[VOICE] Nama channel counter diperbarui menjadi: ${newName}`);
        }
    } catch (err) {
        console.error("Gagal memperbarui Voice Counter Channel:", err);
    }
}

const NATURES = {
    'Adamant': { buff: 'attack', nerf: 'spAtk', multiplier: 1.1 },
    'Modest': { buff: 'spAtk', nerf: 'attack', multiplier: 1.1 },
    'Timid': { buff: 'speed', nerf: 'attack', multiplier: 1.1 },
    'Jolly': { buff: 'speed', nerf: 'spAtk', multiplier: 1.1 },
    'Hardy': { buff: null, nerf: null, multiplier: 1.0 }
};

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres', logging: false,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

const Profile = sequelize.define('Profile', {
    userId: { type: DataTypes.STRING, allowNull: false, unique: true },
    coins: { type: DataTypes.INTEGER, defaultValue: 1000 },
    pokeballs: { type: DataTypes.INTEGER, defaultValue: 10 },
    greatballs: { type: DataTypes.INTEGER, defaultValue: 2 },
    ultraballs: { type: DataTypes.INTEGER, defaultValue: 0 },
    masterballs: { type: DataTypes.INTEGER, defaultValue: 0 },
    berry: { type: DataTypes.INTEGER, defaultValue: 5 },        
    rarecandy: { type: DataTypes.INTEGER, defaultValue: 0 },    
    megastone: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const Inventory = sequelize.define('Inventory', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    pokemonName: { type: DataTypes.STRING, allowNull: false },
    level: { type: DataTypes.INTEGER, defaultValue: 5 },
    xp: { type: DataTypes.INTEGER, defaultValue: 0 },
    gender: { type: DataTypes.STRING, defaultValue: 'Male' },
    nature: { type: DataTypes.STRING, defaultValue: 'Hardy' },
    isShiny: { type: DataTypes.BOOLEAN, defaultValue: false }
});

// ==========================================
// 🐉 DATABASE STATS POKÉMON RESMI
// ==========================================
const POKEMON_DB = {
    'Bulbasaur': { type: 'Grass', hp: 45, attack: 49, defense: 49, speed: 45, catchRate: 0.50, evolvesTo: 'Ivysaur', canSpawnWild: true },
    'Charmander': { type: 'Fire', hp: 39, attack: 52, defense: 43, speed: 65, catchRate: 0.50, evolvesTo: 'Charmeleon', canSpawnWild: true },
    'Squirtle': { type: 'Water', hp: 44, attack: 48, defense: 65, speed: 43, catchRate: 0.50, evolvesTo: 'Wartortle', canSpawnWild: true },
    'Pikachu': { type: 'Electric', hp: 35, attack: 55, defense: 40, speed: 90, catchRate: 0.40, evolvesTo: 'Raichu', canSpawnWild: true },
    
    'Ivysaur': { type: 'Grass', hp: 60, attack: 62, defense: 63, speed: 60, catchRate: 0.25, evolvesTo: 'Venusaur', canSpawnWild: false },
    'Venusaur': { type: 'Grass', hp: 80, attack: 82, defense: 83, speed: 80, catchRate: 0.10, megaTo: 'Mega Venusaur', canSpawnWild: false },
    'Mega Venusaur': { type: 'Grass', hp: 130, attack: 122, defense: 123, speed: 80, catchRate: 0.0, canSpawnWild: false },
    
    'Charmeleon': { type: 'Fire', hp: 58, attack: 64, defense: 58, speed: 80, catchRate: 0.25, evolvesTo: 'Charizard', canSpawnWild: false },
    'Charizard': { type: 'Fire', hp: 78, attack: 84, defense: 78, speed: 100, catchRate: 0.10, megaTo: 'Mega Charizard X', canSpawnWild: false },
    'Mega Charizard X': { type: 'Fire', hp: 128, attack: 130, defense: 111, speed: 100, catchRate: 0.0, canSpawnWild: false },

    'Wartortle': { type: 'Water', hp: 59, attack: 63, defense: 80, speed: 58, catchRate: 0.25, evolvesTo: 'Blastoise', canSpawnWild: false },
    'Blastoise': { type: 'Water', hp: 79, attack: 83, defense: 100, speed: 78, catchRate: 0.10, megaTo: 'Mega Blastoise', canSpawnWild: false },
    'Mega Blastoise': { type: 'Water', hp: 129, attack: 133, defense: 120, speed: 78, catchRate: 0.0, canSpawnWild: false },

    'Raichu': { type: 'Electric', hp: 60, attack: 90, defense: 55, speed: 110, catchRate: 0.15, canSpawnWild: false }
};

const WILD_SPAWN_LIST = Object.keys(POKEMON_DB).filter(name => POKEMON_DB[name].canSpawnWild === true);

function getPokemonStats(pk) {
    const base = POKEMON_DB[pk.pokemonName] || { hp: 50, attack: 50, defense: 50, speed: 50 };
    const nature = NATURES[pk.nature] || { buff: null, nerf: null, multiplier: 1.0 };
    let calculatedHp = Math.floor((base.hp * 2 * pk.level) / 100) + pk.level + 10;
    let calculatedAtk = Math.floor((base.attack * 2 * pk.level) / 100) + 5;
    let calculatedDef = Math.floor((base.defense * 2 * pk.level) / 100) + 5;
    let calculatedSpd = Math.floor((base.speed * 2 * pk.level) / 100) + 5;

    if (nature.buff === 'attack') calculatedAtk = Math.floor(calculatedAtk * 1.1);
    if (nature.buff === 'speed') calculatedSpd = Math.floor(calculatedSpd * 1.1);
    return { maxHp: calculatedHp, attack: calculatedAtk, defense: calculatedDef, speed: calculatedSpd };
}

function getTypeEffectiveness(atkType, defType) {
    if (atkType === 'Fire' && defType === 'Grass') return 2.0;
    if (atkType === 'Water' && defType === 'Fire') return 2.0;
    if (atkType === 'Grass' && defType === 'Water') return 2.0;
    return 1.0;
}

// Pastikan GuildVoiceStates ditambahkan di Intents agar bot bisa membaca aktivitas voice channel!
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates // 🚨 WAJIB AKTIF UNTUK VOICE COUNTER
    ] 
});

let wildPokemon = null;

// ==========================================
// 🚀 RUNTIME CLIENT ON READY
// ==========================================
client.once('ready', async () => {
    logToWeb(`[SYS] Pokémon Engine v2 Terhubung.`);
    await sequelize.sync();
    
    // Hitung stats voice saat bot baru dinyalakan
    client.guilds.cache.forEach(guild => updateVoiceCounter(guild));

    // Auto Spawn Loop 20 Menit
    setInterval(async () => {
        checkActiveEvent();
        const randomPokemon = WILD_SPAWN_LIST[Math.floor(Math.random() * WILD_SPAWN_LIST.length)];
        wildPokemon = randomPokemon;
        
        let msg = `Seekor **${wildPokemon}** liar muncul! Tangkap sebelum kabur!`;
        const channel = await client.channels.fetch(CONFIG_SETUP.SPAWN_CHANNEL_ID).catch(() => null);
        if (channel) {
            const embed = new EmbedBuilder().setTitle('🚨 POKÉMON LIAR DETECTED!').setDescription(msg).setColor('#FF5722');
            await channel.send({ embeds: [embed] });
        }
    }, CONFIG_SETUP.SPAWN_INTERVAL);

    const commands = [
        new SlashCommandBuilder().setName('bag').setDescription('Periksa tas, item, dan daftar Pokémon milikmu'),
        new SlashCommandBuilder().setName('catch').setDescription('Tangkap Pokémon liar yang aktif')
            .addStringOption(o => o.setName('nama').setRequired(true))
            .addStringOption(o => o.setName('ball').setRequired(true)),
        new SlashCommandBuilder().setName('battle').setDescription('⚔️ Turn-Based Battle PVP 1v1 dengan Trainer lain')
            .addUserOption(o => o.setName('lawan').setRequired(true))
            .addIntegerOption(o => o.setName('id_pokemon').setRequired(true)),
        new SlashCommandBuilder().setName('release').setDescription('🍂 Lepaskan Pokémon lama milikmu untuk ditukar dengan koin imbalan')
            .addIntegerOption(o => o.setName('id').setRequired(true)),
        new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Lihat daftar peringkat Trainer terkaya di server'),
        new SlashCommandBuilder().setName('evolve').setDescription('🔺 Evolusikan Pokémon yang sudah memenuhi kriteria level minimum')
            .addIntegerOption(o => o.setName('id').setRequired(true)),
        new SlashCommandBuilder().setName('admin-give-coin').setDescription('👑 [ADMIN] Berikan koin ke Trainer tertentu')
            .addUserOption(o => o.setName('target').setRequired(true)).addIntegerOption(o => o.setName('jumlah').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ];

    const rest = new (require('@discordjs/rest').REST)({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
});

// ==========================================
// 🎙️ VOICE STATE LISTENER (REAL-TIME UPDATE)
// ==========================================
client.on('voiceStateUpdate', (oldState, newState) => {
    // Dipicu setiap ada yang gabung, pindah, atau keluar voice channel
    const guild = newState.guild || oldState.guild;
    if (guild) updateVoiceCounter(guild);
});

// ==========================================
// 🛠️ INTERACTION CONTROLLER
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, user, options } = interaction;
    const t = await sequelize.transaction();

    try {
        const profile = await Profile.findOrCreate({ where: { userId: user.id }, transaction: t });
        const userProf = profile[0];

        if (commandName === 'bag') {
            const bag = await Inventory.findAll({ where: { userId: user.id }, transaction: t });
            await t.commit();
            let pText = bag.length === 0 ? '*Kosong*' : bag.map(p => `• ID: \`${p.id}\` | ${p.isShiny ? '✨ ' : ''}**${p.pokemonName}** (Lv. ${p.level}) [XP: ${p.xp}/100]`).join('\n');
            const embed = new EmbedBuilder().setTitle(`🎒 Kantong Trainer: ${user.username}`).setColor('#42a5f5')
                .addFields(
                    { name: '🪙 Tabungan', value: `\`${userProf.coins} Koin\`` },
                    { name: '🐉 Pokémon Dimiliki', value: pText }
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'catch') {
            const name = options.getString('nama');
            const ball = options.getString('ball');
            if (!wildPokemon || wildPokemon.toLowerCase() !== name.toLowerCase()) { await t.rollback(); return interaction.reply('❌ Pokémon tidak terdeteksi.'); }
            
            const isShiny = Math.random() <= 0.05;
            await Inventory.create({ userId: user.id, pokemonName: wildPokemon, isShiny, level: 5 }, { transaction: t });
            userProf.coins += 150;
            await userProf.save({ transaction: t });
            await t.commit();
            
            wildPokemon = null;
            return interaction.reply(`🎉 **Selamat!** Kamu menangkap **${name}**!`);
        }

        if (commandName === 'release') {
            const targetId = options.getInteger('id');
            const pk = await Inventory.findOne({ where: { id: targetId, userId: user.id }, transaction: t });
            if (!pk) { await t.rollback(); return interaction.reply('❌ Pokémon dengan ID tersebut tidak ditemukan.'); }

            await pk.destroy({ transaction: t });
            userProf.coins += 100;
            await userProf.save({ transaction: t });
            await t.commit();
            return interaction.reply(`🍂 Berhasil melepas **${pk.pokemonName}** (\`+100 Koin\`).`);
        }

        if (commandName === 'leaderboard') {
            await t.commit();
            const topTrainers = await Profile.findAll({ order: [['coins', 'DESC']], limit: 5 });
            let rankText = topTrainers.map((p, index) => `${index + 1}. <@${p.userId}> — \`${p.coins} Koin\``).join('\n');
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 TRAINER TERKAYA').setDescription(rankText).setColor('#fbc02d')] });
        }

        if (commandName === 'evolve') {
            const id = options.getInteger('id');
            const pk = await Inventory.findOne({ where: { id, userId: user.id }, transaction: t });
            if (!pk || pk.level < 16) { await t.rollback(); return interaction.reply('❌ Level tidak cukup atau Pokémon tidak ada.'); }
            
            const pData = POKEMON_DB[pk.pokemonName];
            if (!pData || !pData.evolvesTo) { await t.rollback(); return interaction.reply('❌ Jalur evolusi tidak ada.'); }

            pk.pokemonName = pData.evolvesTo;
            await pk.save({ transaction: t });
            await t.commit();
            return interaction.reply(`🔺 **Evolusi Sukses!** Menjadi **${pk.pokemonName}**!`);
        }

        if (commandName === 'admin-give-coin') {
            const target = options.getUser('target');
            const amount = options.getInteger('jumlah');
            const [tProf] = await Profile.findOrCreate({ where: { userId: target.id }, transaction: t });
            tProf.coins += amount;
            await tProf.save({ transaction: t });
            await t.commit();
            return interaction.reply(`👑 Koin berhasil diberikan ke ${target}.`);
        }
        
        if (commandName === 'battle') {
            const opponent = options.getUser('lawan');
            const myId = options.getInteger('id_pokemon');
            const oppPokes = await Inventory.findAll({ where: { userId: opponent.id }, transaction: t });
            await t.commit();

            const menuOptions = oppPokes.slice(0, 25).map(p => ({ label: `${p.pokemonName} (Lv. ${p.level})`, value: `opp_pk_${p.id}` }));
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId(`pvp_start_${user.id}_${opponent.id}_${myId}`).setPlaceholder('Pilih monster lawan').addOptions(menuOptions)
            );
            return interaction.reply({ content: `⚔️ Duel dengan ${opponent}!`, components: [row] });
        }
    } catch (e) { if (t) await t.rollback(); }
});

// PVP Battle handler tetap dipertahankan seperti script sebelumnya...
client.on('interactionCreate', async selectInter => {
    if (!selectInter.isStringSelectMenu() || !selectInter.customId.startsWith('pvp_start_')) return;
    const [,,, oppId, p1Id] = selectInter.customId.split('_');
    if (selectInter.user.id !== oppId) return selectInter.reply({ content: '❌ Bukan giliranmu!', ephemeral: true });

    const p2Id = selectInter.values[0].replace('opp_pk_', '');
    const poke1 = await Inventory.findByPk(p1Id); const poke2 = await Inventory.findByPk(p2Id);
    let s1 = getPokemonStats(poke1); let s2 = getPokemonStats(poke2);
    
    let hp1 = s1.maxHp; let hp2 = s2.maxHp;
    let coinsDrop = Math.floor(Math.random() * 100) + 50;

    let winnerUserId = hp1 > hp2 ? poke1.userId : poke2.userId;
    const winnerProf = await Profile.findOne({ where: { userId: winnerUserId } });
    if (winnerProf) { winnerProf.coins += coinsDrop; await winnerProf.save(); }

    return selectInter.update({ content: `🎖️ Duel dimenangkan! Pemenang dapat \`+${coinsDrop} Koin\``, components: [] });
});

// ==========================================
// 💻 ADVANCED CONTROL PANEL WEB VIEW
// ==========================================
app.get('/', async (req, res) => {
    try {
        const totalUsers = await Profile.count();
        const totalMonsters = await Inventory.count();
        
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Rift Dashboard & Live Logs</title>
            <style>
                body { background: #121212; color: #fff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; margin: 0; }
                h2 { color: #00e5ff; margin-bottom: 20px; font-weight: 600; }
                .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 20px; }
                .card { background: #1e1e1e; padding: 15px; border-radius: 8px; border-left: 4px solid #00e5ff; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
                .card strong { color: #00e5ff; }
                h3 { margin-top: 25px; color: #ffca28; }
                .log-box { background: #000; color: #00ff66; padding: 15px; height: 350px; overflow-y: auto; font-family: 'Courier New', Courier, monospace; border-radius: 6px; border: 1px solid #333; line-height: 1.5; }
                .log-line { margin-bottom: 6px; border-bottom: 1px solid #111; padding-bottom: 4px; }
                .spawn { color: #ff9100; }
                .voice { color: #00e5ff; }
                .catch { color: #aeea00; }
            </style>
        </head>
        <body>
            <h2>⚡ Pokémon Rift Control Panel</h2>
            
            <div class="grid">
                <div class="card">
                    <p>🎁 <strong>Active Event:</strong> ${ACTIVE_EVENT.name}</p>
                    <p>⏱️ <strong>Spawn Rule:</strong> Setiap 20 Menit (Normal Only)</p>
                </div>
                <div class="card">
                    <p>📊 <strong>Database Stats:</strong></p>
                    <p>• Total Trainer Terdaftar: <strong>${totalUsers}</strong> User</p>
                    <p>• Total Pokémon Tertangkap: <strong>${totalMonsters}</strong> Ekor</p>
                </div>
            </div>

            <h3>📜 Real-time System Logs</h3>
            <div class="log-box">
                ${serverLogs.length === 0 ? '<div style="color:#aaa;">> Menunggu aktivitas server...</div>' : serverLogs.map(l => {
                    let customClass = '';
                    if (l.includes('[SPAWN]')) customClass = 'class="spawn"';
                    if (l.includes('[VOICE]')) customClass = 'class="voice"';
                    if (l.includes('[CATCH]')) customClass = 'class="catch"';
                    return `<div ${customClass} class="log-line">> ${l}</div>`;
                }).join('')}
            </div>
        </body>
        </html>`;
        
        res.send(html);
    } catch (err) {
        res.status(500).send("Gagal memuat Dashboard: " + err.message);
    }
});

// Jalankan Web Server Express & Login Bot
app.listen(PORT, () => {
    logToWeb(`[SYS] Web Dashboard berhasil dinyalakan di Port ${PORT}`);
});
client.login(process.env.DISCORD_TOKEN);
