const { Client, GatewayIntentBits, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { Sequelize, DataTypes, Op } = require('sequelize');
require('dotenv').config();

// ==========================================
// 0. CONFIGURASI & SETUP ID CHANNEL
// ==========================================
const CONFIG_SETUP = {
    ONLINE_CHANNEL_ID: '1517425669607260220',
    TOTAL_CHANNEL_ID: '1517424744251658260',
    SPAWN_CHANNEL_ID: process.env.SPAWN_CHANNEL_ID || 'ID_TEXT_CHANNEL_SPAWN_ZONE',
    COUNTER_INTERVAL: 5 * 60 * 1000, // 5 Menit sekali update status server
    SPAWN_INTERVAL: 10 * 60 * 1000   // 10 Menit sekali POKEMON OTOMATIS SPAWN!
};

const NATURES = {
    'Adamant': { buff: 'baseAtk', nerf: 'baseDef' },
    'Modest': { buff: 'baseAtk', nerf: 'hp' },
    'Timid': { buff: 'hp', nerf: 'baseDef' },
    'Jolly': { buff: 'baseAtk', nerf: null },
    'Hardy': { buff: null, nerf: null }
};

// ==========================================
// 1. DATABASE LAYERS WITH TRANSACTION & HISTORY
// ==========================================
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
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
    megastone: { type: DataTypes.INTEGER, defaultValue: 0 },
    potion: { type: DataTypes.INTEGER, defaultValue: 2 },        // ITEM BARU
    escaperope: { type: DataTypes.INTEGER, defaultValue: 1 }     // ITEM BARU
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

const TransactionHistory = sequelize.define('TransactionHistory', {
    userId: { type: DataTypes.STRING, allowNull: false },
    snapshotCoins: { type: DataTypes.INTEGER },
    snapshotInventory: { type: DataTypes.TEXT },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

// ==========================================
// 2. DATA 100+ POKÉMON DATABASE (GEN 1 - 7 COMPACT MAP)
// ==========================================
const POKEMON_DB = {
    // GEN 1
    'Bulbasaur': { gen: 1, catchRate: 0.60, hp: 45, baseAtk: 49, evolvesTo: 'Ivysaur', megaTo: null, color: '#4CAF50' },
    'Ivysaur': { gen: 1, catchRate: 0.35, hp: 60, baseAtk: 62, evolvesTo: 'Venusaur', megaTo: null, color: '#388E3C' },
    'Venusaur': { gen: 1, catchRate: 0.15, hp: 80, baseAtk: 82, evolvesTo: null, megaTo: 'Mega Venusaur', color: '#1B5E20' },
    'Mega Venusaur': { gen: 1, catchRate: 0.00, hp: 130, baseAtk: 122, evolvesTo: null, megaTo: null, color: '#004D40' },
    'Charmander': { gen: 1, catchRate: 0.60, hp: 39, baseAtk: 52, evolvesTo: 'Charmeleon', megaTo: null, color: '#FF5722' },
    'Charmeleon': { gen: 1, catchRate: 0.35, hp: 58, baseAtk: 64, evolvesTo: 'Charizard', megaTo: null, color: '#E64A19' },
    'Charizard': { gen: 1, catchRate: 0.15, hp: 78, baseAtk: 84, evolvesTo: null, megaTo: 'Mega Charizard X', color: '#BF360C' },
    'Mega Charizard X': { gen: 1, catchRate: 0.00, hp: 128, baseAtk: 130, evolvesTo: null, megaTo: null, color: '#212121' },
    'Squirtle': { gen: 1, catchRate: 0.60, hp: 44, baseAtk: 48, evolvesTo: 'Wartortle', megaTo: null, color: '#2196F3' },
    'Wartortle': { gen: 1, catchRate: 0.35, hp: 59, baseAtk: 63, evolvesTo: 'Blastoise', megaTo: null, color: '#1976D2' },
    'Blastoise': { gen: 1, catchRate: 0.15, hp: 79, baseAtk: 83, evolvesTo: null, megaTo: 'Mega Blastoise', color: '#0D47A1' },
    'Mega Blastoise': { gen: 1, catchRate: 0.00, hp: 129, baseAtk: 133, evolvesTo: null, megaTo: null, color: '#0A2472' },
    'Caterpie': { gen: 1, catchRate: 0.85, hp: 45, baseAtk: 30, evolvesTo: 'Metapod', megaTo: null, color: '#81C784' },
    'Metapod': { gen: 1, catchRate: 0.60, hp: 50, baseAtk: 20, evolvesTo: 'Butterfree', megaTo: null, color: '#4CAF50' },
    'Butterfree': { gen: 1, catchRate: 0.40, hp: 60, baseAtk: 45, evolvesTo: null, megaTo: null, color: '#90CAF9' },
    'Pikachu': { gen: 1, catchRate: 0.50, hp: 35, baseAtk: 55, evolvesTo: 'Raichu', megaTo: null, color: '#FFEB3B' },
    'Raichu': { gen: 1, catchRate: 0.20, hp: 60, baseAtk: 90, evolvesTo: null, megaTo: null, color: '#F57F17' },
    'Eevee': { gen: 1, catchRate: 0.45, hp: 55, baseAtk: 55, evolvesTo: 'Vaporeon', megaTo: null, color: '#A1887F' },
    'Vaporeon': { gen: 1, catchRate: 0.15, hp: 130, baseAtk: 65, evolvesTo: null, megaTo: null, color: '#0288D1' },
    'Jolteon': { gen: 1, catchRate: 0.15, hp: 65, baseAtk: 65, evolvesTo: null, megaTo: null, color: '#FBC02D' },
    'Flareon': { gen: 1, catchRate: 0.15, hp: 65, baseAtk: 130, evolvesTo: null, megaTo: null, color: '#F4511E' },
    'Mewtwo': { gen: 1, catchRate: 0.02, hp: 106, baseAtk: 110, evolvesTo: null, megaTo: null, color: '#E040FB' },
    // GEN 2
    'Chikorita': { gen: 2, catchRate: 0.60, hp: 45, baseAtk: 49, evolvesTo: 'Bayleef', megaTo: null, color: '#CCFF90' },
    'Bayleef': { gen: 2, catchRate: 0.35, hp: 60, baseAtk: 62, evolvesTo: 'Meganium', megaTo: null, color: '#B2FF59' },
    'Meganium': { gen: 2, catchRate: 0.15, hp: 80, baseAtk: 82, evolvesTo: null, megaTo: null, color: '#76FF03' },
    'Cyndaquil': { gen: 2, catchRate: 0.60, hp: 39, baseAtk: 52, evolvesTo: 'Quilava', megaTo: null, color: '#FFAB40' },
    'Quilava': { gen: 2, catchRate: 0.35, hp: 58, baseAtk: 64, evolvesTo: 'Typhlosion', megaTo: null, color: '#FF9100' },
    'Typhlosion': { gen: 2, catchRate: 0.15, hp: 78, baseAtk: 84, evolvesTo: null, megaTo: null, color: '#FF6D00' },
    'Totodile': { gen: 2, catchRate: 0.60, hp: 50, baseAtk: 65, evolvesTo: 'Croconaw', megaTo: null, color: '#40C4FF' },
    'Croconaw': { gen: 2, catchRate: 0.35, hp: 65, baseAtk: 80, evolvesTo: 'Feraligatr', megaTo: null, color: '#00B0FF' },
    'Feraligatr': { gen: 2, catchRate: 0.15, hp: 85, baseAtk: 105, evolvesTo: null, megaTo: null, color: '#0091EA' },
    'Lugia': { gen: 2, catchRate: 0.02, hp: 106, baseAtk: 90, evolvesTo: null, megaTo: null, color: '#B39DDB' },
    'Ho-Oh': { gen: 2, catchRate: 0.02, hp: 106, baseAtk: 130, evolvesTo: null, megaTo: null, color: '#FF5252' },
    'Celebi': { gen: 2, catchRate: 0.03, hp: 100, baseAtk: 100, evolvesTo: null, megaTo: null, color: '#69F0AE' },
    // GEN 3
    'Treecko': { gen: 3, catchRate: 0.60, hp: 40, baseAtk: 45, evolvesTo: 'Grovyle', megaTo: null, color: '#00E676' },
    'Grovyle': { gen: 3, catchRate: 0.35, hp: 50, baseAtk: 65, evolvesTo: 'Sceptile', megaTo: null, color: '#00C853' },
    'Sceptile': { gen: 3, catchRate: 0.15, hp: 70, baseAtk: 85, evolvesTo: null, megaTo: 'Mega Sceptile', color: '#1B5E20' },
    'Torchic': { gen: 3, catchRate: 0.60, hp: 45, baseAtk: 60, evolvesTo: 'Combusken', megaTo: null, color: '#FF6E40' },
    'Combusken': { gen: 3, catchRate: 0.35, hp: 60, baseAtk: 85, evolvesTo: 'Blaziken', megaTo: null, color: '#FF3D00' },
    'Blaziken': { gen: 3, catchRate: 0.15, hp: 80, baseAtk: 120, evolvesTo: null, megaTo: 'Mega Blaziken', color: '#D50000' },
    'Mudkip': { gen: 3, catchRate: 0.60, hp: 50, baseAtk: 70, evolvesTo: 'Marshtomp', megaTo: null, color: '#80D8FF' },
    'Marshtomp': { gen: 3, catchRate: 0.35, hp: 70, baseAtk: 85, evolvesTo: 'Swampert', megaTo: null, color: '#00B0FF' },
    'Swampert': { gen: 3, catchRate: 0.15, hp: 100, baseAtk: 110, evolvesTo: null, megaTo: 'Mega Swampert', color: '#0091EA' },
    'Kyogre': { gen: 3, catchRate: 0.02, hp: 100, baseAtk: 100, evolvesTo: null, megaTo: null, color: '#2962FF' },
    'Groudon': { gen: 3, catchRate: 0.02, hp: 100, baseAtk: 150, evolvesTo: null, megaTo: null, color: '#DD2C00' },
    'Rayquaza': { gen: 3, catchRate: 0.02, hp: 105, baseAtk: 150, evolvesTo: null, megaTo: 'Mega Rayquaza', color: '#00C853' },
    // GEN 4
    'Turtwig': { gen: 4, catchRate: 0.60, hp: 55, baseAtk: 68, evolvesTo: 'Grotle', megaTo: null, color: '#4CAF50' },
    'Grotle': { gen: 4, catchRate: 0.35, hp: 75, baseAtk: 89, evolvesTo: 'Torterra', megaTo: null, color: '#388E3C' },
    'Torterra': { gen: 4, catchRate: 0.15, hp: 95, baseAtk: 109, evolvesTo: null, megaTo: null, color: '#1B5E20' },
    'Chimchar': { gen: 4, catchRate: 0.60, hp: 44, baseAtk: 58, evolvesTo: 'Monferno', megaTo: null, color: '#FF7043' },
    'Monferno': { gen: 4, catchRate: 0.35, hp: 64, baseAtk: 78, evolvesTo: 'Infernape', megaTo: null, color: '#F4511E' },
    'Infernape': { gen: 4, catchRate: 0.15, hp: 76, baseAtk: 104, evolvesTo: null, megaTo: null, color: '#D84315' },
    'Piplup': { gen: 4, catchRate: 0.60, hp: 53, baseAtk: 51, evolvesTo: 'Prinplup', megaTo: null, color: '#4FC3F7' },
    'Prinplup': { gen: 4, catchRate: 0.35, hp: 64, baseAtk: 66, evolvesTo: 'Empoleon', megaTo: null, color: '#0288D1' },
    'Empoleon': { gen: 4, catchRate: 0.15, hp: 84, baseAtk: 86, evolvesTo: null, megaTo: null, color: '#01579B' },
    'Lucario': { gen: 4, catchRate: 0.10, hp: 70, baseAtk: 110, evolvesTo: null, megaTo: 'Mega Lucario', color: '#303F9F' },
    'Dialga': { gen: 4, catchRate: 0.02, hp: 100, baseAtk: 120, evolvesTo: null, megaTo: null, color: '#B0BEC5' },
    'Palkia': { gen: 4, catchRate: 0.02, hp: 90, baseAtk: 120, evolvesTo: null, megaTo: null, color: '#F8BBD0' },
    'Arceus': { gen: 4, catchRate: 0.01, hp: 120, baseAtk: 120, evolvesTo: null, megaTo: null, color: '#FFFFFF' },
    // GEN 5
    'Snivy': { gen: 5, catchRate: 0.60, hp: 45, baseAtk: 45, evolvesTo: 'Servine', megaTo: null, color: '#81C784' },
    'Servine': { gen: 5, catchRate: 0.35, hp: 60, baseAtk: 60, evolvesTo: 'Serperior', megaTo: null, color: '#4CAF50' },
    'Serperior': { gen: 5, catchRate: 0.15, hp: 75, baseAtk: 75, evolvesTo: null, megaTo: null, color: '#2E7D32' },
    'Tepig': { gen: 5, catchRate: 0.60, hp: 65, baseAtk: 63, evolvesTo: 'Pignite', megaTo: null, color: '#FF8A65' },
    'Pignite': { gen: 5, catchRate: 0.35, hp: 90, baseAtk: 93, evolvesTo: 'Emboar', megaTo: null, color: '#FF5722' },
    'Emboar': { gen: 5, catchRate: 0.15, hp: 110, baseAtk: 123, evolvesTo: null, megaTo: null, color: '#E64A19' },
    'Oshawott': { gen: 5, catchRate: 0.60, hp: 55, baseAtk: 55, evolvesTo: 'Dewott', megaTo: null, color: '#4FC3F7' },
    'Dewott': { gen: 5, catchRate: 0.35, hp: 75, baseAtk: 75, evolvesTo: 'Samurott', megaTo: null, color: '#03A9F4' },
    'Samurott': { gen: 5, catchRate: 0.15, hp: 95, baseAtk: 100, evolvesTo: null, megaTo: null, color: '#0288D1' },
    'Zekrom': { gen: 5, catchRate: 0.02, hp: 100, baseAtk: 150, evolvesTo: null, megaTo: null, color: '#37474F' },
    'Reshiram': { gen: 5, catchRate: 0.02, hp: 100, baseAtk: 120, evolvesTo: null, megaTo: null, color: '#ECEFF1' },
    // GEN 6
    'Chespin': { gen: 6, catchRate: 0.60, hp: 56, baseAtk: 61, evolvesTo: 'Quilladin', megaTo: null, color: '#A5D6A7' },
    'Quilladin': { gen: 6, catchRate: 0.35, hp: 61, baseAtk: 78, evolvesTo: 'Chesnaught', megaTo: null, color: '#66BB6A' },
    'Chesnaught': { gen: 6, catchRate: 0.15, hp: 88, baseAtk: 107, evolvesTo: null, megaTo: null, color: '#388E3C' },
    'Fennekin': { gen: 6, catchRate: 0.60, hp: 40, baseAtk: 45, evolvesTo: 'Braixen', megaTo: null, color: '#FFAB91' },
    'Braixen': { gen: 6, catchRate: 0.35, hp: 59, baseAtk: 59, evolvesTo: 'Delphox', megaTo: null, color: '#FF7043' },
    'Delphox': { gen: 6, catchRate: 0.15, hp: 75, baseAtk: 69, evolvesTo: null, megaTo: null, color: '#F4511E' },
    'Froakie': { gen: 6, catchRate: 0.60, hp: 41, baseAtk: 56, evolvesTo: 'Frogadier', megaTo: null, color: '#90CAF9' },
    'Frogadier': { gen: 6, catchRate: 0.35, hp: 54, baseAtk: 63, evolvesTo: 'Greninja', megaTo: null, color: '#42A5F5' },
    'Greninja': { gen: 6, catchRate: 0.15, hp: 72, baseAtk: 95, evolvesTo: null, megaTo: null, color: '#1E88E5' },
    'Xerneas': { gen: 6, catchRate: 0.02, hp: 126, baseAtk: 131, evolvesTo: null, megaTo: null, color: '#F48FB1' },
    'Yveltal': { gen: 6, catchRate: 0.02, hp: 126, baseAtk: 131, evolvesTo: null, megaTo: null, color: '#E91E63' },
    // GEN 7
    'Rowlet': { gen: 7, catchRate: 0.60, hp: 68, baseAtk: 55, evolvesTo: 'Dartrix', megaTo: null, color: '#C8E6C9' },
    'Dartrix': { gen: 7, catchRate: 0.35, hp: 78, baseAtk: 75, evolvesTo: 'Decidueye', megaTo: null, color: '#81C784' },
    'Decidueye': { gen: 7, catchRate: 0.15, hp: 78, baseAtk: 107, evolvesTo: null, megaTo: null, color: '#2E7D32' },
    'Litten': { gen: 7, catchRate: 0.60, hp: 45, baseAtk: 65, evolvesTo: 'Torracat', megaTo: null, color: '#FF8A80' },
    'Torracat': { gen: 7, catchRate: 0.35, hp: 65, baseAtk: 85, evolvesTo: 'Incineroar', megaTo: null, color: '#FF5252' },
    'Incineroar': { gen: 7, catchRate: 0.15, hp: 95, baseAtk: 115, evolvesTo: null, megaTo: null, color: '#D50000' },
    'Popplio': { gen: 7, catchRate: 0.60, hp: 50, baseAtk: 54, evolvesTo: 'Brionne', megaTo: null, color: '#80D8FF' },
    'Brionne': { gen: 7, catchRate: 0.35, hp: 60, baseAtk: 69, evolvesTo: 'Primarina', megaTo: null, color: '#40C4FF' },
    'Primarina': { gen: 7, catchRate: 0.15, hp: 80, baseAtk: 74, evolvesTo: null, megaTo: null, color: '#00B0FF' },
    'Solgaleo': { gen: 7, catchRate: 0.02, hp: 137, baseAtk: 137, evolvesTo: null, megaTo: null, color: '#FFF59D' },
    'Lunala': { gen: 7, catchRate: 0.02, hp: 137, baseAtk: 113, evolvesTo: null, megaTo: null, color: '#7E57C2' }
};

const POKEMON_LIST = Object.keys(POKEMON_DB);

const PRICING_AND_ITEMS = {
    pokeballs: { name: '🔴 Pokéball', cost: 50 },
    greatballs: { name: '🔵 Great Ball', cost: 150 },
    ultraballs: { name: '⚫ Ultra Ball', cost: 300 },
    masterballs: { name: '🟡 Master Ball', cost: 1200 },
    berry: { name: '🍏 Oran Berry', cost: 40 },
    potion: { name: '🧪 Potion', cost: 80 },             // Baru
    escaperope: { name: '🪢 Escape Rope', cost: 200 },     // Baru
    rarecandy: { name: '🍬 Rare Candy', cost: 600 },
    megastone: { name: '💎 Mega Stone', cost: 3000 }
};

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildPresences]
});

let wildPokemon = null;

// ==========================================
// 3. AUTOMATED CORE ENGINES
// ==========================================
async function saveSnapshot(userId, profile, transaction) {
    const inv = await Inventory.findAll({ where: { userId }, transaction });
    await TransactionHistory.create({
        userId: userId,
        snapshotCoins: profile.coins,
        snapshotInventory: JSON.stringify(inv || [])
    }, { transaction });
}

async function gantiRole(guild, member, roleName, color) {
    if (!guild || !member) return;
    let role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
        try { role = await guild.roles.create({ name: roleName, color: color, reason: 'Rift Achievement Engine' }); } 
        catch (e) { console.error(e); return; }
    }
    if (!member.roles.cache.has(role.id)) await member.roles.add(role).catch(() => null);
}

// 🔊 ONLINE CHANNELS LOGIC LOOP
async function updateChannelCounters() {
    client.guilds.cache.forEach(async (guild) => {
        try {
            const members = await guild.members.fetch({ withPresences: true });
            const totalMembers = members.size;
            const onlineMembers = members.filter(m => m.presence && m.presence.status !== 'offline').size;

            const onlineChannel = guild.channels.cache.get(CONFIG_SETUP.ONLINE_CHANNEL_ID);
            const totalChannel = guild.channels.cache.get(CONFIG_SETUP.TOTAL_CHANNEL_ID);

            if (onlineChannel) await onlineChannel.setName(`📱 Online: ${onlineMembers}`).catch(() => null);
            if (totalChannel) await totalChannel.setName(`👥 Members: ${totalMembers}`).catch(() => null);
        } catch (e) { console.error(e); }
    });
}

// 📢 AUTO-SPAWN LOOP LOGIC
async function triggerAutoSpawn() {
    try {
        const randomPokemon = POKEMON_LIST[Math.floor(Math.random() * POKEMON_LIST.length)];
        wildPokemon = randomPokemon;

        const channel = await client.channels.fetch(CONFIG_SETUP.SPAWN_CHANNEL_ID).catch(() => null);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('🚨 RADAR ALERT: POKÉMON LIAR MENDUR JALUR!')
                .setDescription(`Aura liar terdeteksi! Seekor **${wildPokemon}** mendekat di zona perburuan.\nGunakan \`/catch\` sekarang sebelum dia melarikan diri!`)
                .setColor(POKEMON_DB[wildPokemon].color)
                .setTimestamp();
            await channel.send({ embeds: [embed] });
        }
    } catch (e) { console.error('Auto spawn eror:', e); }
}

// ==========================================
// 4. CLIENT RUNTIME INITIALIZATION
// ==========================================
client.once('ready', async () => {
    console.log(`[SYS] Pokémon Mega Rift Engine (100+ Pokemon & Auto-Spawn Connected)`);
    await sequelize.sync();
    
    // Jalankan service loop interval
    updateChannelCounters();
    setInterval(updateChannelCounters, CONFIG_SETUP.COUNTER_INTERVAL);
    
    // Mengaktifkan Loop Auto-Spawn otomatis di channel target
    setInterval(triggerAutoSpawn, CONFIG_SETUP.SPAWN_INTERVAL);

    const commands = [
        new SlashCommandBuilder().setName('help').setDescription('📜 Panduan instruksi seluruh Trainer'),
        new SlashCommandBuilder().setName('pokemon').setDescription('Intip radar Pokémon liar saat ini'),
        new SlashCommandBuilder().setName('catch').setDescription('Tangkap target monster liar yang mendekat')
            .addStringOption(o => o.setName('nama').setRequired(true))
            .addStringOption(o => o.setName('ball').setRequired(true).addChoices(
                { name: 'Pokéball', value: 'pokeballs' }, { name: 'Great Ball', value: 'greatballs' },
                { name: 'Ultra Ball', value: 'ultraballs' }, { name: 'Master Ball', value: 'masterballs' }
            )),
        new SlashCommandBuilder().setName('bag').setDescription('🔒 Periksa kantong supply & sabuk Pokémon pribadi (Private)'),
        new SlashCommandBuilder().setName('shop').setDescription('Lihat pasar global Silph Co.'),
        new SlashCommandBuilder().setName('buy').setDescription('Beli pasokan item petualang')
            .addStringOption(o => o.setName('item').setRequired(true).addChoices(
                { name: 'Pokéball', value: 'pokeballs' }, { name: 'Great Ball', value: 'greatballs' },
                { name: 'Ultra Ball', value: 'ultraballs' }, { name: 'Master Ball', value: 'masterballs' },
                { name: 'Oran Berry', value: 'berry' }, { name: 'Potion', value: 'potion' }, 
                { name: 'Escape Rope', value: 'escaperope' }, { name: 'Rare Candy', value: 'rarecandy' }, { name: 'Mega Stone', value: 'megastone' }
            ))
            .addIntegerOption(o => o.setName('jumlah').setRequired(true)),
        new SlashCommandBuilder().setName('feed').setDescription('Beri makan Pokémon kesayanganmu')
            .addIntegerOption(o => o.setName('id').setRequired(true))
            .addStringOption(o => o.setName('makanan').setRequired(true).addChoices({ name: 'Rare Candy', value: 'rarecandy' }, { name: 'Oran Berry', value: 'berry' })),
        new SlashCommandBuilder().setName('evolve').setDescription('Evolusikan wujud Pokémon standar (Lv. 50+)').addIntegerOption(o => o.setName('id').setRequired(true)),
        new SlashCommandBuilder().setName('mega-evolve').setDescription('🧬 Sinkronisasi wujud Mega Purba (Lv. 75+)').addIntegerOption(o => o.setName('id').setRequired(true)),
        new SlashCommandBuilder().setName('daily').setDescription('Ambil koin tunjangan harian dari Aliansi'),
        // Admin Command Secures (EPHEMERAL SAFE)
        new SlashCommandBuilder().setName('spawn-admin').setDescription('👑 [ADMIN] Tarik paksa entitas Pokémon keluar').addStringOption(o => o.setName('nama').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
        new SlashCommandBuilder().setName('admin-restock').setDescription('👑 [ADMIN] Berikan koin subsidi massal').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
        new SlashCommandBuilder().setName('reset-data').setDescription('👑 [ADMIN] Reset / Rollback presisi data akun pemain')
            .addUserOption(o => o.setName('player').setRequired(true))
            .addIntegerOption(o => o.setName('jam').setDescription('Mundur berapa jam?'))
            .addIntegerOption(o => o.setName('menit').setDescription('Mundur berapa menit?'))
            .addIntegerOption(o => o.setName('detik').setDescription('Mundur berapa detik?'))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ];

    const rest = new (require('@discordjs/rest').REST)({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
});

// ==========================================
// 5. INTERACTION ENGINE WITH ROLLBACK & ROLES
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, user, options, guild, member } = interaction;

    if (commandName === 'help') {
        return interaction.reply({ content: '📜 **Daftar Command:** `/pokemon`, `/catch`, `/bag` (Privat), `/shop`, `/buy`, `/feed`, `/evolve`, `/mega-evolve`, `/daily`' });
    }

    const t = await sequelize.transaction();

    try {
        const profile = await Profile.findOne({ where: { userId: user.id }, transaction: t, lock: t.LOCK.UPDATE });
        if (!profile && commandName !== 'reset-data') {
            await Profile.create({ userId: user.id }, { transaction: t });
            await t.commit();
            return interaction.reply({ content: 'Akun baru berhasil di-inkubasi! Ulangi perintah kembali.', ephemeral: true });
        }

        // --- /bag (🔒 EPHEMERAL PRIVACY MODE) ---
        if (commandName === 'bag') {
            const bag = await Inventory.findAll({ where: { userId: user.id }, transaction: t });
            await t.commit();

            let invText = bag.length === 0 ? '*Kosong*' : bag.map(p => {
                return `• 🆔 \`${p.id}\` - ${p.isShiny ? '✨ **SHINY** ' : ''}**${p.pokemonName}** (${p.gender === 'Male' ? '♂️' : '♀️'}) [Lv. ${p.level}] [Nature: *${p.nature}*]`;
            }).join('\n');

            const embed = new EmbedBuilder().setTitle(`🎒 PRIVATE LOGISTICS BAG: ${user.username}`).setColor('#0288D1')
                .addFields(
                    { name: '🪙 Finansial', value: `\`${profile.coins} Koin\``, inline: true },
                    { name: '🎒 Amunisi Ball', value: `🔴 Pokéball: ${profile.pokeballs} | 🔵 Great: ${profile.greatballs}\n⚫ Ultra: ${profile.ultraballs} | 🟡 Master: ${profile.masterballs}`, inline: false },
                    { name: '🧪 Medis & Gears', value: `🧪 Potion: ${profile.potion} | 🪢 Escape Rope: ${profile.escaperope}\n🍬 Rare Candy: ${profile.rarecandy} | 💎 Mega Stone: ${profile.megastone}`, inline: false },
                    { name: '🐉 Sabuk Pokémon (${bag.length} Terikat)', value: invText, inline: false }
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // --- /daily WITH BENEFIT Novice Trainer ROLE ---
        if (commandName === 'daily') {
            const bagCount = await Inventory.count({ where: { userId: user.id }, transaction: t });
            if (bagCount < 1) {
                await t.rollback();
                return interaction.reply({ content: '❌ Kamu harus memiliki minimal 1 Pokémon untuk klaim harian! Tangkap dulu.', ephemeral: true });
            }

            profile.coins += 300;
            await profile.save({ transaction: t });
            await saveSnapshot(user.id, profile, t);
            await t.commit();

            await gantiRole(guild, member, 'Novice Trainer', '#81C784');
            return interaction.reply('🪙 Tunjangan harian Aliansi diambil (`+300 Koin`). Role **Novice Trainer** diberikan!');
        }

        // --- /catch WITH BENEFIT DISKON BARU ---
        if (commandName === 'catch') {
            const targetName = options.getString('nama');
            const ball = options.getString('ball');

            if (!wildPokemon) { await t.rollback(); return interaction.reply('Zona sepi, tidak ada radar target aktif.'); }
            if (targetName.toLowerCase() !== wildPokemon.toLowerCase()) { await t.rollback(); return interaction.reply('❌ Nama Pokémon keliru!'); }
            if (profile[ball] <= 0) { await t.rollback(); return interaction.reply('Amunisi bola tersebut kosong.'); }

            profile[ball] -= 1;
            await profile.save({ transaction: t });

            const pData = POKEMON_DB[wildPokemon];
            let bonus = ball === 'greatballs' ? 0.20 : ball === 'ultraballs' ? 0.40 : ball === 'masterballs' ? 1.0 : 0;

            await interaction.reply('⚡ Melempar bola...');

            if (Math.random() <= (pData.catchRate + bonus)) {
                const isShiny = Math.random() <= 0.08; // 8% Peluang Shiny Form
                const randomGender = Math.random() <= 0.5 ? 'Male' : 'Female';
                const nKeys = Object.keys(NATURES);
                const randomNature = nKeys[Math.floor(Math.random() * nKeys.length)];

                await Inventory.create({
                    userId: user.id, pokemonName: wildPokemon,
                    gender: randomGender, nature: randomNature, isShiny: isShiny
                }, { transaction: t });

                profile.coins += 150;
                await profile.save({ transaction: t });
                await saveSnapshot(user.id, profile, t);
                await t.commit();

                await gantiRole(guild, member, 'Wild Catcher', '#29B6F6');
                wildPokemon = null; // Reset spawn area setelah tertangkap
                return interaction.followUp(`🎉 **${user.username}** berhasil mengamankan ${isShiny ? '✨ **SHINY** ' : ''}**${targetName}**! Dapat bonus \`+150 Koin\` & Role **Wild Catcher** (Diskon Toko Aktif!).`);
            } else {
                await saveSnapshot(user.id, profile, t);
                await t.commit();
                return interaction.followUp('💨 Pokémon liar menepis bola dan keluar dari zona jangkauan!');
            }
        }

        // --- /shop ---
        if (commandName === 'shop') {
            await t.commit();
            const embed = new EmbedBuilder().setTitle('🏪 SILPH CO. SELECTION GLOBAL MART').setColor('#37474F');
            const hasCatcherRole = member?.roles.cache.some(r => r.name === 'Wild Catcher');

            for (const k in PRICING_AND_ITEMS) {
                let cost = PRICING_AND_ITEMS[k].cost;
                if (hasCatcherRole && k.includes('balls')) cost = Math.floor(cost * 0.9); // Diskon 10% Khusus Catcher!
                embed.addFields({ name: PRICING_AND_ITEMS[k].name, value: `💳 Biaya: \`${cost} Koin\` ${hasCatcherRole && k.includes('balls') ? '*(Diskon Catcher 10%!)*' : ''}`, inline: true });
            }
            return interaction.reply({ embeds: [embed] });
        }

        // --- /buy ---
        if (commandName === 'buy') {
            const item = options.getString('item');
            const qty = options.getInteger('jumlah');
            if (qty <= 0) { await t.rollback(); return interaction.reply('Jumlah pembelian tidak valid.'); }

            let priceUnit = PRICING_AND_ITEMS[item].cost;
            const hasCatcherRole = member?.roles.cache.some(r => r.name === 'Wild Catcher');
            if (hasCatcherRole && item.includes('balls')) priceUnit = Math.floor(priceUnit * 0.9);

            const totalCost = priceUnit * qty;
            if (profile.coins < totalCost) { await t.rollback(); return interaction.reply('Finansial koin Anda menipis.'); }

            profile.coins -= totalCost;
            profile[item] += qty;
            await profile.save({ transaction: t });
            await saveSnapshot(user.id, profile, t);
            await t.commit();

            return interaction.reply(`🛍️ Berhasil memborong ${qty}x ${PRICING_AND_ITEMS[item].name} senilai \`${totalCost} koin\`.`);
        }

        // --- /feed ---
        if (commandName === 'feed') {
            const id = options.getInteger('id');
            const food = options.getString('makanan');

            if (profile[food] <= 0) { await t.rollback(); return interaction.reply('Stok makanan tersebut habis.'); }
            const pk = await Inventory.findOne({ where: { id, userId: user.id }, transaction: t, lock: t.LOCK.UPDATE });
            if (!pk) { await t.rollback(); return interaction.reply('Pokémon tidak terdaftar di sabuk belt Anda.'); }

            profile[food] -= 1;
            pk.level += food === 'rarecandy' ? 5 : 1; // Rare candy memberikan 5 level langsung ala film!

            await profile.save({ transaction: t });
            await pk.save({ transaction: t });
            await saveSnapshot(user.id, profile, t);
            await t.commit();
            return interaction.reply(`🍬 **${pk.pokemonName}** lahap memakan ${food}! Status melonjak naik ke: \`Lv. ${pk.level}\`.`);
        }

        // --- /evolve ---
        if (commandName === 'evolve') {
            const id = options.getInteger('id');
            const pk = await Inventory.findOne({ where: { id, userId: user.id }, transaction: t, lock: t.LOCK.UPDATE });

            if (!pk || pk.level < 50) { await t.rollback(); return interaction.reply('Syarat tidak cukup (Minimal Pokémon harus Lv. 50).'); }
            const targetEvol = POKEMON_DB[pk.pokemonName]?.evolvesTo;
            if (!targetEvol) { await t.rollback(); return interaction.reply('Pokémon ini sudah berada di wujud puncaknya.'); }

            const oldName = pk.pokemonName;
            pk.pokemonName = targetEvol;
            await pk.save({ transaction: t });
            await saveSnapshot(user.id, profile, t);
            await t.commit();
            return interaction.reply(`✨ **EVOLUSI!** Sinar kosmik membungkus tubuh **${oldName}** dan berevolusi menjadi **${pk.pokemonName}**!`);
        }

        // --- /mega-evolve ---
        if (commandName === 'mega-evolve') {
            const id = options.getInteger('id');
            const pk = await Inventory.findOne({ where: { id, userId: user.id }, transaction: t, lock: t.LOCK.UPDATE });

            if (!pk || pk.level < 75) { await t.rollback(); return interaction.reply('Ikatan batin belum kuat (Minimal Lv. 75).'); }
            const megaTarget = POKEMON_DB[pk.pokemonName]?.megaTo;
            if (!megaTarget) { await t.rollback(); return interaction.reply('Pokémon jenis ini tidak memiliki struktur cetak wujud Mega.'); }

            if (profile.megastone <= 0) { await t.rollback(); return interaction.reply('Kamu tidak memiliki material Mega Stone.'); }
            profile.megastone -= 1;

            pk.pokemonName = megaTarget;
            await profile.save({ transaction: t });
            await pk.save({ transaction: t });
            await saveSnapshot(user.id, profile, t);
            await t.commit();

            await gantiRole(guild, member, 'Mega Master', '#FFD54F');
            return interaction.reply(`🧬 **SYNCHRONIZATION APEX!** **${pk.pokemonName}** terbangkitkan! Role **Mega Master** disematkan.`);
        }

        // --- /pokemon ---
        if (commandName === 'pokemon') {
            await t.commit();
            if (!wildPokemon) return interaction.reply('Radar sunyi, tidak ada entitas liar mendekat.');
            return interaction.reply(`🚨 Radar aktif! Seekor **${wildPokemon}** berkeliaran di dekat area ini!`);
        }

        // ==========================================
        // 6. ADMIN SYSTEM SECURE CODES (🔒 EPHEMERAL)
        // ==========================================
        if (commandName === 'spawn-admin') {
            const name = options.getString('nama');
            const match = POKEMON_LIST.find(p => p.toLowerCase() === name.toLowerCase());
            if (!match) { await t.rollback(); return interaction.reply({ content: 'Spesies di luar database Gen 1-7.', ephemeral: true }); }

            wildPokemon = match;
            await t.commit();
            await interaction.reply({ content: 'Sukses dipicu.', ephemeral: true });
            return interaction.channel.send(`👑 **Admin Command Spawner:** Seekor **${wildPokemon}** dipaksa keluar ke area chat!`);
        }

        if (commandName === 'admin-restock') {
            profile.coins += 5000;
            await profile.save({ transaction: t });
            await t.commit();
            return interaction.reply({ content: '👑 Subsidi darurat senilai `+5000 Koin` dimasukkan ke dompetmu.', ephemeral: true });
        }

        // --- /reset-data (DYNAMICS TIME ROLLBACK SYSTEM CLOCK) ---
        if (commandName === 'reset-data') {
            const target = options.getUser('player');
            const rJam = options.getInteger('jam') || 0;
            const rMenit = options.getInteger('menit') || 0;
            const rDetik = options.getInteger('detik') || 0;

            const timeMundurMs = ((rJam * 3600) + (rMenit * 60) + rDetik) * 1000;

            if (timeMundurMs === 0) {
                // Hard reset total
                await Profile.destroy({ where: { userId: target.id }, transaction: t });
                await Inventory.destroy({ where: { userId: target.id }, transaction: t });
                await TransactionHistory.destroy({ where: { userId: target.id }, transaction: t });
                await t.commit();
                return interaction.reply({ content: `👑 **WIPE DATA SUCCESS:** Seluruh progress ${target.username} dibersihkan permanen.`, ephemeral: true });
            } else {
                // Rollback dinamis presisi ke jam, menit, atau detik lalu
                const targetTime = new Date(Date.now() - timeMundurMs);
                const pastLog = await TransactionHistory.findOne({
                    where: { userId: target.id, timestamp: { [Op.lte]: targetTime } },
                    order: [['timestamp', 'DESC']], transaction: t
                });

                if (!pastLog) {
                    await t.rollback();
                    return interaction.reply({ content: '❌ Data log transaksi pada waktu tersebut tidak ditemukan.', ephemeral: true });
                }

                const pTarget = await Profile.findOne({ where: { userId: target.id }, transaction: t, lock: t.LOCK.UPDATE });
                if (pTarget) {
                    pTarget.coins = pastLog.snapshotCoins;
                    await pTarget.save({ transaction: t });
                }

                await Inventory.destroy({ where: { userId: target.id }, transaction: t });
                const oldItems = JSON.parse(pastLog.snapshotInventory);
                for (const item of oldItems) {
                    delete item.id;
                    await Inventory.create(item, { transaction: t });
                }

                await t.commit();
                return interaction.reply({ content: `⏳ **ROLLBACK BERHASIL:** Akun ${target.username} dikembalikan ke status \`${rJam}j ${rMenit}m ${rDetik}d\` yang lalu.`, ephemeral: true });
            }
        }

    } catch (e) {
        console.error("CRITICAL ENGINE ERROR:", e);
        if (t) await t.rollback();
        return interaction.reply({ content: '⚠️ Antrean data terlalu padat, tindakanmu digagalkan sistem keamanan.', ephemeral: true }).catch(() => null);
    }
});

client.login(process.env.DISCORD_TOKEN);
