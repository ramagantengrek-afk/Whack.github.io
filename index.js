const { 
    Client, GatewayIntentBits, Routes, SlashCommandBuilder, 
    PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder 
} = require('discord.js');
const { Sequelize, DataTypes, Op } = require('sequelize');
require('dotenv').config();

// ==========================================
// 0. CONFIGURASI & SETUP ID CHANNEL
// ==========================================
const CONFIG_SETUP = {
    ONLINE_CHANNEL_ID: '1517425669607260220',
    TOTAL_CHANNEL_ID: '1517424744251658260',
    SPAWN_CHANNEL_ID: process.env.SPAWN_CHANNEL_ID || 'ID_TEXT_CHANNEL_SPAWN_ZONE',
    COUNTER_INTERVAL: 5 * 60 * 1000, 
    SPAWN_INTERVAL: 10 * 60 * 1000   
};

const NATURES = {
    'Adamant': { buff: 'baseAtk', nerf: 'baseDef', multiplier: 1.1 },
    'Modest': { buff: 'baseAtk', nerf: 'hp', multiplier: 1.05 },
    'Timid': { buff: 'hp', nerf: 'baseDef', multiplier: 1.05 },
    'Jolly': { buff: 'baseAtk', nerf: null, multiplier: 1.1 },
    'Hardy': { buff: null, nerf: null, multiplier: 1.0 }
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
    potion: { type: DataTypes.INTEGER, defaultValue: 2 },        
    escaperope: { type: DataTypes.INTEGER, defaultValue: 1 }     
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
// 2. DATA 100+ POKÉMON DATABASE (COMPACT MAP GEN 1-7)
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
    'Pikachu': { gen: 1, catchRate: 0.50, hp: 35, baseAtk: 55, evolvesTo: 'Raichu', megaTo: null, color: '#FFEB3B' },
    'Raichu': { gen: 1, catchRate: 0.20, hp: 60, baseAtk: 90, evolvesTo: null, megaTo: null, color: '#F57F17' },
    'Mewtwo': { gen: 1, catchRate: 0.02, hp: 106, baseAtk: 110, evolvesTo: null, megaTo: null, color: '#E040FB' },
    // GEN 2
    'Chikorita': { gen: 2, catchRate: 0.60, hp: 45, baseAtk: 49, evolvesTo: 'Bayleef', megaTo: null, color: '#CCFF90' },
    'Bayleef': { gen: 2, catchRate: 0.35, hp: 60, baseAtk: 62, evolvesTo: 'Meganium', megaTo: null, color: '#B2FF59' },
    'Meganium': { gen: 2, catchRate: 0.15, hp: 80, baseAtk: 82, evolvesTo: null, megaTo: null, color: '#76FF03' },
    'Cyndaquil': { gen: 2, catchRate: 0.60, hp: 39, baseAtk: 52, evolvesTo: 'Quilava', megaTo: null, color: '#FFAB40' },
    'Quilava': { gen: 2, catchRate: 0.35, hp: 58, baseAtk: 64, evolvesTo: 'Typhlosion', megaTo: null, color: '#FF9100' },
    'Typhlosion': { gen: 2, catchRate: 0.15, hp: 78, baseAtk: 84, evolvesTo: null, megaTo: null, color: '#FF6D00' },
    'Lugia': { gen: 2, catchRate: 0.02, hp: 106, baseAtk: 90, evolvesTo: null, megaTo: null, color: '#B39DDB' },
    'Ho-Oh': { gen: 2, catchRate: 0.02, hp: 106, baseAtk: 130, evolvesTo: null, megaTo: null, color: '#FF5252' },
    // GEN 3
    'Treecko': { gen: 3, catchRate: 0.60, hp: 40, baseAtk: 45, evolvesTo: 'Grovyle', megaTo: null, color: '#00E676' },
    'Grovyle': { gen: 3, catchRate: 0.35, hp: 50, baseAtk: 65, evolvesTo: 'Sceptile', megaTo: null, color: '#00C853' },
    'Sceptile': { gen: 3, catchRate: 0.15, hp: 70, baseAtk: 85, evolvesTo: null, megaTo: 'Mega Sceptile', color: '#1B5E20' },
    'Mega Sceptile': { gen: 3, catchRate: 0.00, hp: 120, baseAtk: 135, evolvesTo: null, megaTo: null, color: '#004D40' },
    'Torchic': { gen: 3, catchRate: 0.60, hp: 45, baseAtk: 60, evolvesTo: 'Combusken', megaTo: null, color: '#FF6E40' },
    'Combusken': { gen: 3, catchRate: 0.35, hp: 60, baseAtk: 85, evolvesTo: 'Blaziken', megaTo: null, color: '#FF3D00' },
    'Blaziken': { gen: 3, catchRate: 0.15, hp: 80, baseAtk: 120, evolvesTo: null, megaTo: 'Mega Blaziken', color: '#D50000' },
    'Mega Blaziken': { gen: 3, catchRate: 0.00, hp: 130, baseAtk: 160, evolvesTo: null, megaTo: null, color: '#800000' },
    'Rayquaza': { gen: 3, catchRate: 0.02, hp: 105, baseAtk: 150, evolvesTo: null, megaTo: 'Mega Rayquaza', color: '#00C853' },
    // GEN 4
    'Lucario': { gen: 4, catchRate: 0.10, hp: 70, baseAtk: 110, evolvesTo: null, megaTo: 'Mega Lucario', color: '#303F9F' },
    'Arceus': { gen: 4, catchRate: 0.01, hp: 120, baseAtk: 120, evolvesTo: null, megaTo: null, color: '#FFFFFF' },
    // GEN 5
    'Snivy': { gen: 5, catchRate: 0.60, hp: 45, baseAtk: 45, evolvesTo: 'Servine', megaTo: null, color: '#81C784' },
    'Zekrom': { gen: 5, catchRate: 0.02, hp: 100, baseAtk: 150, evolvesTo: null, megaTo: null, color: '#37474F' },
    // GEN 6
    'Froakie': { gen: 6, catchRate: 0.60, hp: 41, baseAtk: 56, evolvesTo: 'Frogadier', megaTo: null, color: '#90CAF9' },
    'Frogadier': { gen: 6, catchRate: 0.35, hp: 54, baseAtk: 63, evolvesTo: 'Greninja', megaTo: null, color: '#42A5F5' },
    'Greninja': { gen: 6, catchRate: 0.15, hp: 72, baseAtk: 95, evolvesTo: null, megaTo: null, color: '#1E88E5' },
    // GEN 7
    'Litten': { gen: 7, catchRate: 0.60, hp: 45, baseAtk: 65, evolvesTo: 'Torracat', megaTo: null, color: '#FF8A80' },
    'Incineroar': { gen: 7, catchRate: 0.15, hp: 95, baseAtk: 115, evolvesTo: null, megaTo: null, color: '#D50000' },
    'Solgaleo': { gen: 7, catchRate: 0.02, hp: 137, baseAtk: 137, evolvesTo: null, megaTo: null, color: '#FFF59D' }
};
// Catatan: Isilah sisa list lengkap database 100+ Pokémon di objek POKEMON_DB ini.
const POKEMON_LIST = Object.keys(POKEMON_DB);

const PRICING_AND_ITEMS = {
    pokeballs: { name: '🔴 Pokéball', cost: 50 },
    greatballs: { name: '🔵 Great Ball', cost: 150 },
    ultraballs: { name: '⚫ Ultra Ball', cost: 300 },
    masterballs: { name: '🟡 Master Ball', cost: 1200 },
    berry: { name: '🍏 Oran Berry', cost: 40 },
    potion: { name: '🧪 Potion', cost: 80 },             
    escaperope: { name: '🪢 Escape Rope', cost: 200 },     
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

// Perhitungan stat tempur kalkulasi level & nature
function hitungCombatPower(pk) {
    const base = POKEMON_DB[pk.pokemonName] || { hp: 50, baseAtk: 50 };
    const natureMod = NATURES[pk.nature]?.multiplier || 1.0;
    
    const maxHp = Math.floor((base.hp * 2 * pk.level) / 100) + pk.level + 10;
    const attack = Math.floor(((base.baseAtk * 2 * pk.level) / 100) + 5) * natureMod;
    
    return { maxHp, attack };
}

// ==========================================
// 4. CLIENT RUNTIME INITIALIZATION
// ==========================================
client.once('ready', async () => {
    console.log(`[SYS] Pokémon Mega Rift Engine (Fitur PvP & Trade Aktif!)`);
    await sequelize.sync();
    
    updateChannelCounters();
    setInterval(updateChannelCounters, CONFIG_SETUP.COUNTER_INTERVAL);
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
        
        // FITUR BARU: TRADE INTER-PLAYER
        new SlashCommandBuilder().setName('trade').setDescription('🤝 Tukarkan Pokémon kamu dengan koin pemain lain')
            .addUserOption(o => o.setName('pembeli').setDescription('Pemain yang ingin membeli Pokémonmu').setRequired(true))
            .addIntegerOption(o => o.setName('id_pokemon').setDescription('ID Pokémon milikmu yang ingin dijual').setRequired(true))
            .addIntegerOption(o => o.setName('harga_koin').setDescription('Harga koin yang diminta').setRequired(true)),
            
        // FITUR BARU: PVP BATTLE ENGINES
        new SlashCommandBuilder().setName('battle').setDescription('⚔️ Tantang duel pemain lain dalam pertarungan Pokémon 1v1')
            .addUserOption(o => o.setName('lawan').setDescription('Pemain yang ingin kamu tantang').setRequired(true))
            .addIntegerOption(o => o.setName('id_pokemon').setDescription('ID Pokémon andalanmu untuk bertarung').setRequired(true)),

        // Admin Commands
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
// 5. INTERACTION ENGINE WITH ROLLBACK & PVP
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, user, options, guild, member } = interaction;

    if (commandName === 'help') {
        return interaction.reply({ content: '📜 **Daftar Command:** `/pokemon`, `/catch`, `/bag`, `/shop`, `/buy`, `/feed`, `/evolve`, `/mega-evolve`, `/daily`, `/trade`, `/battle`' });
    }

    const t = await sequelize.transaction();

    try {
        const profile = await Profile.findOne({ where: { userId: user.id }, transaction: t, lock: t.LOCK.UPDATE });
        if (!profile && commandName !== 'reset-data') {
            await Profile.create({ userId: user.id }, { transaction: t });
            await t.commit();
            return interaction.reply({ content: 'Akun baru berhasil di-inkubasi! Ulangi perintah kembali.', ephemeral: true });
        }

        // --- CODE /BAG ---
        if (commandName === 'bag') {
            const bag = await Inventory.findAll({ where: { userId: user.id }, transaction: t });
            await t.commit();
            let invText = bag.length === 0 ? '*Kosong*' : bag.map(p => `• 🆔 \`${p.id}\` - ${p.isShiny ? '✨ ' : ''}**${p.pokemonName}** [Lv. ${p.level}] (*${p.nature}*)`).join('\n');
            const embed = new EmbedBuilder().setTitle(`🎒 BACKPACK: ${user.username}`).setColor('#0288D1')
                .addFields(
                    { name: '🪙 Finansial', value: `\`${profile.coins} Koin\``, inline: true },
                    { name: '🎒 Amunisi Ball', value: `🔴 Pokéball: ${profile.pokeballs} | 🔵 Great: ${profile.greatballs}\n⚫ Ultra: ${profile.ultraballs} | 🟡 Master: ${profile.masterballs}`, inline: false },
                    { name: '🐉 Pokémon Sabuk', value: invText, inline: false }
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // --- CODE /DAILY ---
        if (commandName === 'daily') {
            const bagCount = await Inventory.count({ where: { userId: user.id }, transaction: t });
            if (bagCount < 1) { await t.rollback(); return interaction.reply({ content: '❌ Minimal punya 1 Pokémon untuk klaim.', ephemeral: true }); }
            profile.coins += 300;
            await profile.save({ transaction: t });
            await saveSnapshot(user.id, profile, t);
            await t.commit();
            await gantiRole(guild, member, '🔰 ┃ Novice Trainer', '#81C784');
            return interaction.reply('🪙 Tunjangan harian diambil (`+300 Koin`). Role **Novice Trainer** aktif!');
        }

        // --- CODE /CATCH ---
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
                const isShiny = Math.random() <= 0.08;
                const randomNature = Object.keys(NATURES)[Math.floor(Math.random() * Object.keys(NATURES).length)];
                await Inventory.create({ userId: user.id, pokemonName: wildPokemon, nature: randomNature, isShiny }, { transaction: t });
                profile.coins += 150;
                await profile.save({ transaction: t });
                await saveSnapshot(user.id, profile, t);
                await t.commit();
                await gantiRole(guild, member, '🏹 ┃ Wild Catcher', '#29B6F6');
                wildPokemon = null;
                return interaction.followUp(`🎉 **${user.username}** menangkap ${isShiny ? '✨ ' : ''}**${targetName}**! \`+150 Koin\` & Role **Wild Catcher** didapat.`);
            } else {
                await saveSnapshot(user.id, profile, t);
                await t.commit();
                return interaction.followUp('💨 Pokémon liar menepis bola dan kabur!');
            }
        }

        // --- CODE /SHOP ---
        if (commandName === 'shop') {
            await t.commit();
            const embed = new EmbedBuilder().setTitle('🏪 MART').setColor('#37474F');
            const hasCatcherRole = member?.roles.cache.some(r => r.name.includes('Wild Catcher'));
            for (const k in PRICING_AND_ITEMS) {
                let cost = PRICING_AND_ITEMS[k].cost;
                if (hasCatcherRole && k.includes('balls')) cost = Math.floor(cost * 0.9);
                embed.addFields({ name: PRICING_AND_ITEMS[k].name, value: `💳 Biaya: \`${cost} Koin\``, inline: true });
            }
            return interaction.reply({ embeds: [embed] });
        }

        // --- CODE /BUY ---
        if (commandName === 'buy') {
            const item = options.getString('item');
            const qty = options.getInteger('jumlah');
            if (qty <= 0) { await t.rollback(); return interaction.reply('Jumlah tidak valid.'); }
            let priceUnit = PRICING_AND_ITEMS[item].cost;
            if (member?.roles.cache.some(r => r.name.includes('Wild Catcher')) && item.includes('balls')) priceUnit = Math.floor(priceUnit * 0.9);
            const totalCost = priceUnit * qty;
            if (profile.coins < totalCost) { await t.rollback(); return interaction.reply('Koin tidak cukup.'); }
            profile.coins -= totalCost;
            profile[item] += qty;
            await profile.save({ transaction: t });
            await saveSnapshot(user.id, profile, t);
            await t.commit();
            return interaction.reply(`🛍️ Membeli ${qty}x ${PRICING_AND_ITEMS[item].name} senilai \`${totalCost} koin\`.`);
        }

        // --- CODE /FEED ---
        if (commandName === 'feed') {
            const id = options.getInteger('id');
            const food = options.getString('makanan');
            if (profile[food] <= 0) { await t.rollback(); return interaction.reply('Stok makanan habis.'); }
            const pk = await Inventory.findOne({ where: { id, userId: user.id }, transaction: t, lock: t.LOCK.UPDATE });
            if (!pk) { await t.rollback(); return interaction.reply('Pokémon tidak ditemukan.'); }
            profile[food] -= 1;
            pk.level += food === 'rarecandy' ? 5 : 1;
            await profile.save({ transaction: t });
            await pk.save({ transaction: t });
            await saveSnapshot(user.id, profile, t);
            await t.commit();
            return interaction.reply(`🍬 **${pk.pokemonName}** naik ke \`Lv. ${pk.level}\`.`);
        }

        // --- CODE /EVOLVE ---
        if (commandName === 'evolve') {
            const id = options.getInteger('id');
            const pk = await Inventory.findOne({ where: { id, userId: user.id }, transaction: t, lock: t.LOCK.UPDATE });
            if (!pk || pk.level < 50) { await t.rollback(); return interaction.reply('Syarat minimal Lv. 50.'); }
            const targetEvol = POKEMON_DB[pk.pokemonName]?.evolvesTo;
            if (!targetEvol) { await t.rollback(); return interaction.reply('Sudah wujud maksimal.'); }
            const oldName = pk.pokemonName;
            pk.pokemonName = targetEvol;
            await pk.save({ transaction: t });
            await saveSnapshot(user.id, profile, t);
            await t.commit();
            return interaction.reply(`✨ **EVOLUSI!** **${oldName}** berevolusi menjadi **${pk.pokemonName}**!`);
        }

        // --- CODE /MEGA-EVOLVE ---
        if (commandName === 'mega-evolve') {
            const id = options.getInteger('id');
            const pk = await Inventory.findOne({ where: { id, userId: user.id }, transaction: t, lock: t.LOCK.UPDATE });
            if (!pk || pk.level < 75) { await t.rollback(); return interaction.reply('Syarat minimal Lv. 75.'); }
            const megaTarget = POKEMON_DB[pk.pokemonName]?.megaTo;
            if (!megaTarget) { await t.rollback(); return interaction.reply('Tidak punya wujud Mega.'); }
            if (profile.megastone <= 0) { await t.rollback(); return interaction.reply('Butuh Mega Stone.'); }
            profile.megastone -= 1;
            pk.pokemonName = megaTarget;
            await profile.save({ transaction: t });
            await pk.save({ transaction: t });
            await saveSnapshot(user.id, profile, t);
            await t.commit();
            await gantiRole(guild, member, '🧬 ┃ Mega Master', '#FFD54F');
            return interaction.reply(`🧬 **MEGA EVOLUSI!** **${pk.pokemonName}** bangkit! Role **Mega Master** diberikan.`);
        }

        // --- CODE /POKEMON ---
        if (commandName === 'pokemon') {
            await t.commit();
            if (!wildPokemon) return interaction.reply('Radar sunyi.');
            return interaction.reply(`🚨 Seekor **${wildPokemon}** berkeliaran di dekat sini!`);
        }

        // ==========================================
        // FITUR BARU: SYSTEM IMPLEMENTASI /TRADE
        // ==========================================
        if (commandName === 'trade') {
            const buyerUser = options.getUser('pembeli');
            const pokemonId = options.getInteger('id_pokemon');
            const price = options.getInteger('harga_koin');

            if (buyerUser.id === user.id) { await t.rollback(); return interaction.reply('❌ Kamu tidak bisa menjual ke dirimu sendiri.'); }
            if (price < 0) { await t.rollback(); return interaction.reply('❌ Harga koin tidak valid.'); }

            const pokemon = await Inventory.findOne({ where: { id: pokemonId, userId: user.id }, transaction: t });
            if (!pokemon) { await t.rollback(); return interaction.reply('❌ Pokémon dengan ID tersebut tidak ditemukan di bag-mu.'); }

            await t.commit(); // Bebaskan transaksi awal agar button tidak macet deadlock

            const embed = new EmbedBuilder()
                .setTitle('🤝 PENAWARAN TRADE POKÉMON')
                .setDescription(`**${user.username}** menawarkan **${pokemon.pokemonName}** [Lv. ${pokemon.level}] kepada **${buyerUser.username}** seharga 🪙 \`${price} Koin\`.\n\nApakah **${buyerUser.username}** setuju?`)
                .setColor('#FF9100');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`trade_accept_${pokemonId}_${price}_${user.id}_${buyerUser.id}`).setLabel('Setuju & Bayar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`trade_deny_${user.id}_${buyerUser.id}`).setLabel('Tolak').setStyle(ButtonStyle.Danger)
            );

            const msg = await interaction.reply({ content: `${buyerUser}`, embeds: [embed], components: [row] });

            const collector = msg.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async btn => {
                if (btn.user.id !== buyerUser.id && btn.user.id !== user.id) {
                    return btn.reply({ content: 'Bukan urusanmu.', ephemeral: true });
                }

                if (btn.customId.startsWith('trade_deny')) {
                    row.components.forEach(c => c.setDisabled(true));
                    await btn.update({ content: '❌ Transaksi Trade dibatalkan.', components: [row] });
                    return collector.stop();
                }

                const internalT = await sequelize.transaction();
                try {
                    // Lock kedua profile akun
                    const sellerProf = await Profile.findOne({ where: { userId: user.id }, transaction: internalT, lock: internalT.LOCK.UPDATE });
                    const buyerProf = await Profile.findOne({ where: { userId: buyerUser.id }, transaction: internalT, lock: internalT.LOCK.UPDATE });
                    const pkToSwap = await Inventory.findOne({ where: { id: pokemonId, userId: user.id }, transaction: internalT, lock: internalT.LOCK.UPDATE });

                    if (!pkToSwap || buyerProf.coins < price) {
                        await internalT.rollback();
                        return btn.reply({ content: '❌ Transaksi gagal. Pokémon sudah tidak ada atau koin pembeli tidak cukup.', ephemeral: true });
                    }

                    // Eksekusi pertukaran aset secara aman
                    buyerProf.coins -= price;
                    sellerProf.coins += price;
                    pkToSwap.userId = buyerUser.id; // Ganti hak milik kepemilikan

                    await buyerProf.save({ transaction: internalT });
                    await sellerProf.save({ transaction: internalT });
                    await pkToSwap.save({ transaction: internalT });

                    await saveSnapshot(user.id, sellerProf, internalT);
                    await saveSnapshot(buyerUser.id, buyerProf, internalT);
                    await internalT.commit();

                    row.components.forEach(c => c.setDisabled(true));
                    await btn.update({ content: `🎉 **SUKSES TRADE!** **${buyerUser.username}** resmi membeli **${pkToSwap.pokemonName}** dari **${user.username}**!`, components: [row] });
                    collector.stop();
                } catch (err) {
                    if (internalT) await internalT.rollback();
                    console.error(err);
                }
            });
            return;
        }

        // ==========================================
        // FITUR BARU: SYSTEM IMPLEMENTASI /BATTLE PvP
        // ==========================================
        if (commandName === 'battle') {
            const targetLawan = options.getUser('lawan');
            const myPokemonId = options.getInteger('id_pokemon');

            if (targetLawan.id === user.id) { await t.rollback(); return interaction.reply('❌ Kamu tidak bisa bertarung melawan bayanganmu sendiri.'); }

            const myPokemon = await Inventory.findOne({ where: { id: myPokemonId, userId: user.id }, transaction: t });
            if (!myPokemon) { await t.rollback(); return interaction.reply('❌ Pokémon penantang tidak valid.'); }

            const lawanPokemonList = await Inventory.findAll({ where: { userId: targetLawan.id }, transaction: t });
            if (lawanPokemonList.length === 0) { await t.rollback(); return interaction.reply('❌ Lawanmu tidak memiliki Pokémon di dalam sabuknya.'); }

            await t.commit(); // Selesai cek data awal, commit transaksi utama.

            // Membuat Menu Dropdown Pilihan untuk Lawan memilih Pokémon tempurnya
            const selectOptions = lawanPokemonList.slice(0, 25).map(p => ({
                label: `${p.pokemonName} (Lv. ${p.level})`,
                description: `Nature: ${p.nature} | ID: ${p.id}`,
                value: `target_pk_${p.id}`
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`battle_select_${user.id}_${targetLawan.id}_${myPokemonId}`)
                .setPlaceholder('Lawan: Pilih Pokémon andalanmu untuk bertarung!')
                .addOptions(selectOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            const msg = await interaction.reply({ 
                content: `⚔️ **TANTANGAN DUEL!** ${targetLawan}, kamu ditantang bertarung oleh **${user.username}** yang menggunakan **${myPokemon.pokemonName}** [Lv. ${myPokemon.level}].`, 
                components: [row] 
            });

            const collector = msg.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async selectInter => {
                if (selectInter.user.id !== targetLawan.id) return selectInter.reply({ content: 'Kamu bukan target tantangan!', ephemeral: true });

                const chosenPkId = selectInter.values[0].replace('target_pk_', '');
                
                // Cari data Pokémon pertarungan akhir
                const p1 = await Inventory.findByPk(myPokemonId);
                const p2 = await Inventory.findByPk(chosenPkId);

                if (!p1 || !p2 || p2.userId !== targetLawan.id) {
                    return selectInter.update({ content: '⚠️ Gagal bertarung. Salah satu Pokémon tidak valid.', components: [] });
                }

                // Kalkulasi Stat Tempur Kedua Pokémon
                let stat1 = hitungCombatPower(p1);
                let stat2 = hitungCombatPower(p2);

                // Simulasi pertempuran berbasis giliran cepat
                let turnLog = `🥊 **${p1.pokemonName}** (Lv. ${p1.level}) VS **${p2.pokemonName}** (Lv. ${p2.level})\n`;
                let hp1 = stat1.maxHp;
                let hp2 = stat2.maxHp;

                while (hp1 > 0 && hp2 > 0) {
                    // Turn P1 menyerang P2
                    let dmg1 = Math.floor(stat1.attack * (0.85 + Math.random() * 0.3));
                    hp2 -= dmg1;
                    if (hp2 <= 0) break;

                    // Turn P2 menyerang P1
                    let dmg2 = Math.floor(stat2.attack * (0.85 + Math.random() * 0.3));
                    hp1 -= dmg2;
                }

                let pemenangUser = hp1 > 0 ? user : targetLawan;
                let pokemonPemenang = hp1 > 0 ? p1.pokemonName : p2.pokemonName;

                // Tambahkan hadiah koin bagi pemenang duel secara aman
                const transReward = await sequelize.transaction();
                const pemenangProfile = await Profile.findOne({ where: { userId: pemenangUser.id }, transaction: transReward });
                pemenangProfile.coins += 200;
                await pemenangProfile.save({ transaction: transReward });
                await transReward.commit();

                const embedHasil = new EmbedBuilder()
                    .setTitle('⚔️ HASIL DUEL MAHA RIFT')
                    .setDescription(`${turnLog}\n💥 **Kemenangan Mutlak!**\nPokémon **${pokemonPemenang}** berhasil menumbangkan lawannya!\n🏆 **Selamat ${pemenangUser.username}**, kamu memenangkan duel dan mendapatkan 🪙 \`+200 Koin\`!`)
                    .setColor('#E53935');

                await selectInter.update({ content: '👑 Pertempuran Selesai!', embeds: [embedHasil], components: [] });
                collector.stop();
            });
            return;
        }

        // --- CODE ADMIN-SPAWN ---
        if (commandName === 'spawn-admin') {
            const name = options.getString('nama');
            const match = POKEMON_LIST.find(p => p.toLowerCase() === name.toLowerCase());
            if (!match) { await t.rollback(); return interaction.reply({ content: 'Tidak ada di DB.', ephemeral: true }); }
            wildPokemon = match; await t.commit();
            await interaction.reply({ content: 'Dipicu.', ephemeral: true });
            return interaction.channel.send(`👑 **Admin Spawner:** Seekor **${wildPokemon}** dipaksa muncul!`);
        }

        if (commandName === 'admin-restock') {
            profile.coins += 5000; await profile.save({ transaction: t }); await t.commit();
            return interaction.reply({ content: '👑 Subsidi `+5000 Koin` masuk.', ephemeral: true });
        }

        // --- CODE RESET-DATA / ROLLBACK TIME ---
        if (commandName === 'reset-data') {
            const target = options.getUser('player');
            const rJam = options.getInteger('jam') || 0;
            const rMenit = options.getInteger('menit') || 0;
            const rDetik = options.getInteger('detik') || 0;
            const timeMundurMs = ((rJam * 3600) + (rMenit * 60) + rDetik) * 1000;

            if (timeMundurMs === 0) {
                await Profile.destroy({ where: { userId: target.id }, transaction: t });
                await Inventory.destroy({ where: { userId: target.id }, transaction: t });
                await TransactionHistory.destroy({ where: { userId: target.id }, transaction: t });
                await t.commit();
                return interaction.reply({ content: `👑 Wipe data ${target.username} berhasil.`, ephemeral: true });
            } else {
                const targetTime = new Date(Date.now() - timeMundurMs);
                const pastLog = await TransactionHistory.findOne({
                    where: { userId: target.id, timestamp: { [Op.lte]: targetTime } },
                    order: [['timestamp', 'DESC']], transaction: t
                });
                if (!pastLog) { await t.rollback(); return interaction.reply({ content: '❌ Log tidak ada.', ephemeral: true }); }
                const pTarget = await Profile.findOne({ where: { userId: target.id }, transaction: t });
                if (pTarget) { pTarget.coins = pastLog.snapshotCoins; await pTarget.save({ transaction: t }); }
                await Inventory.destroy({ where: { userId: target.id }, transaction: t });
                const oldItems = JSON.parse(pastLog.snapshotInventory);
                for (const item of oldItems) { delete item.id; await Inventory.create(item, { transaction: t }); }
                await t.commit();
                return interaction.reply({ content: `⏳ Akun ${target.username} di-rollback ke masa lalu.`, ephemeral: true });
            }
        }

    } catch (e) {
        console.error("CRITICAL ERROR:", e);
        if (t) await t.rollback();
        return interaction.reply({ content: '⚠️ Terjadi kendala sistem keamanan.', ephemeral: true }).catch(() => null);
    }
});

client.login(process.env.DISCORD_TOKEN);
