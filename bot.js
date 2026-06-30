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
    SPAWN_INTERVAL: 20 * 60 * 1000   // ⏱️ DIUBAH MENJADI 20 MENIT
};

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
    // --- BENTUK DASAR / NORMAL (Hanya ini yang bisa spawn di alam liar) ---
    'Bulbasaur': { type: 'Grass', hp: 45, attack: 49, defense: 49, speed: 45, catchRate: 0.50, evolvesTo: 'Ivysaur', canSpawnWild: true },
    'Charmander': { type: 'Fire', hp: 39, attack: 52, defense: 43, speed: 65, catchRate: 0.50, evolvesTo: 'Charmeleon', canSpawnWild: true },
    'Squirtle': { type: 'Water', hp: 44, attack: 48, defense: 65, speed: 43, catchRate: 0.50, evolvesTo: 'Wartortle', canSpawnWild: true },
    'Pikachu': { type: 'Electric', hp: 35, attack: 55, defense: 40, speed: 90, catchRate: 0.40, evolvesTo: 'Raichu', canSpawnWild: true },
    
    // --- BENTUK EVOLUSI & MEGA (DILARANG SPAWN WILD, hanya lewat /evolve) ---
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

// Menyaring daftar spawn khusus untuk Pokémon yang memiliki properti canSpawnWild: true
const WILD_SPAWN_LIST = Object.keys(POKEMON_DB).filter(name => POKEMON_DB[name].canSpawnWild === true);
const POKEMON_LIST = Object.keys(POKEMON_DB);

const PRICING_AND_ITEMS = {
    pokeballs: { name: '🔴 Pokéball', cost: 50 }, greatballs: { name: '🔵 Great Ball', cost: 150 },
    ultraballs: { name: '⚫ Ultra Ball', cost: 300 }, masterballs: { name: '🟡 Master Ball', cost: 1200 },
    berry: { name: '🍏 Oran Berry', cost: 40 }, rarecandy: { name: '🍬 Rare Candy', cost: 600 },
    megastone: { name: '💎 Mega Stone', cost: 3000 }
};

// ==========================================
// ⚔️ STATS ENGINE & EXPERIENCE SYSTEM
// ==========================================
function getPokemonStats(pk) {
    const base = POKEMON_DB[pk.pokemonName] || { hp: 50, attack: 50, defense: 50, speed: 50 };
    const nature = NATURES[pk.nature] || { buff: null, nerf: null, multiplier: 1.0 };

    let calculatedHp = Math.floor((base.hp * 2 * pk.level) / 100) + pk.level + 10;
    let calculatedAtk = Math.floor((base.attack * 2 * pk.level) / 100) + 5;
    let calculatedDef = Math.floor((base.defense * 2 * pk.level) / 100) + 5;
    let calculatedSpd = Math.floor((base.speed * 2 * pk.level) / 100) + 5;

    if (nature.buff === 'attack') calculatedAtk = Math.floor(calculatedAtk * 1.1);
    if (nature.buff === 'speed') calculatedSpd = Math.floor(calculatedSpd * 1.1);
    if (nature.nerf === 'attack') calculatedAtk = Math.floor(calculatedAtk * 0.9);
    if (nature.nerf === 'speed') calculatedSpd = Math.floor(calculatedSpd * 0.9);

    return { maxHp: calculatedHp, attack: calculatedAtk, defense: calculatedDef, speed: calculatedSpd };
}

function getTypeEffectiveness(atkType, defType) {
    if (atkType === 'Fire' && defType === 'Grass') return 2.0;
    if (atkType === 'Grass' && defType === 'Fire') return 0.5;
    if (atkType === 'Water' && defType === 'Fire') return 2.0;
    if (atkType === 'Fire' && defType === 'Water') return 0.5;
    if (atkType === 'Grass' && defType === 'Water') return 2.0;
    if (atkType === 'Water' && defType === 'Grass') return 0.5;
    return 1.0;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
let wildPokemon = null;

// ==========================================
// 🚀 RUNTIME CLIENT ON READY
// ==========================================
client.once('ready', async () => {
    logToWeb(`[SYS] Pokémon Engine v2 Terhubung.`);
    await sequelize.sync();
    
    // Auto Spawn Loop dikonfigurasi menjadi 20 Menit sekali
    setInterval(async () => {
        checkActiveEvent();
        // Hanya memanggil Pokémon normal dari array WILD_SPAWN_LIST
        const randomPokemon = WILD_SPAWN_LIST[Math.floor(Math.random() * WILD_SPAWN_LIST.length)];
        wildPokemon = randomPokemon;
        
        let msg = `Seekor **${wildPokemon}** liar muncul! Tangkap sebelum kabur!`;
        if (ACTIVE_EVENT.type === "DOUBLE_SHINY") msg += ` \`✨ BONUS: Peluang Shiny Meningkat! \``;

        logToWeb(`[SPAWN] ${wildPokemon} (Normal) muncul di alam liar.`);
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
            .addStringOption(o => o.setName('ball').setRequired(true).addChoices(
                { name: '🔴 Pokéball', value: 'pokeballs' }, { name: '🔵 Great Ball', value: 'greatballs' },
                { name: '⚫ Ultra Ball', value: 'ultraballs' }, { name: '🟡 Master Ball', value: 'masterballs' }
            )),
        new SlashCommandBuilder().setName('battle').setDescription('⚔️ Turn-Based Battle PVP 1v1 dengan Trainer lain')
            .addUserOption(o => o.setName('lawan').setRequired(true))
            .addIntegerOption(o => o.setName('id_pokemon').setRequired(true)),
        new SlashCommandBuilder().setName('shop').setDescription('Masuk ke Pasar Pembelian Silph Co.'),
        new SlashCommandBuilder().setName('buy').setDescription('Beli item bekal bertarung')
            .addStringOption(o => o.setName('item').setRequired(true).addChoices(
                { name: 'Pokéball', value: 'pokeballs' }, { name: 'Great Ball', value: 'greatballs' },
                { name: 'Rare Candy', value: 'rarecandy' }, { name: 'Mega Stone', value: 'megastone' }
            )).addIntegerOption(o => o.setName('jumlah').setRequired(true)),
        
        // ⭐ FITUR BARU SEPERTI PERMINTAAN
        new SlashCommandBuilder().setName('release').setDescription('🍂 Lepaskan Pokémon lama milikmu untuk ditukar dengan koin imbalan')
            .addIntegerOption(o => o.setName('id').setDescription('ID Pokémon di dalam bag').setRequired(true)),
        new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Lihat daftar peringkat Trainer terkaya di server'),
        new SlashCommandBuilder().setName('evolve').setDescription('🔺 Evolusikan Pokémon yang sudah memenuhi kriteria level minimum (Lv. 16/32/36)')
            .addIntegerOption(o => o.setName('id').setDescription('ID Pokémon').setRequired(true)),

        // ADMIN EVENT
        new SlashCommandBuilder().setName('set-event').setDescription('👑 [ADMIN] Aktifkan Event Server Server Global')
            .addStringOption(o => o.setName('nama').setDescription('Nama Event').setRequired(true))
            .addStringOption(o => o.setName('tipe').setRequired(true).addChoices(
                { name: 'Double Koin (+100% Coins)', value: 'DOUBLE_COIN' },
                { name: 'Shiny Rush (Peluang Shiny Naik)', value: 'DOUBLE_SHINY' }
            ))
            .addIntegerOption(o => o.setName('durasi').setDescription('Durasi dalam menit').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

        new SlashCommandBuilder().setName('admin-give-coin').setDescription('👑 [ADMIN] Berikan koin ke Trainer tertentu')
            .addUserOption(o => o.setName('target').setRequired(true)).addIntegerOption(o => o.setName('jumlah').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ];

    const rest = new (require('@discordjs/rest').REST)({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
});

// ==========================================
// 🛠️ INTERACTION CONTROLLER
// ==========================================
client.on('interactionCreate', async interaction => {
    checkActiveEvent();
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
                    { name: '📦 Suplai Bola', value: `🔴: ${userProf.pokeballs} | 🔵: ${userProf.greatballs}` },
                    { name: '🐉 Pokémon Dimiliki', value: pText }
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'catch') {
            const name = options.getString('nama');
            const ball = options.getString('ball');
            if (!wildPokemon || wildPokemon.toLowerCase() !== name.toLowerCase()) { await t.rollback(); return interaction.reply('❌ Pokémon tidak terdeteksi.'); }
            if (userProf[ball] <= 0) { await t.rollback(); return interaction.reply('❌ Amunisi Bola habis.'); }

            userProf[ball] -= 1;
            const pData = POKEMON_DB[wildPokemon];
            let rate = pData.catchRate;
            if (ball === 'greatballs') rate += 0.15;

            if (Math.random() <= rate) {
                let shinyChance = ACTIVE_EVENT.type === "DOUBLE_SHINY" ? 0.20 : 0.05;
                const isShiny = Math.random() <= shinyChance;
                const natureList = Object.keys(NATURES);
                const randomNature = natureList[Math.floor(Math.random() * natureList.length)];

                await Inventory.create({ userId: user.id, pokemonName: wildPokemon, isShiny, nature: randomNature, level: 5 }, { transaction: t });
                
                let prize = 150;
                if (ACTIVE_EVENT.type === "DOUBLE_COIN") prize = Math.floor(prize * ACTIVE_EVENT.multiplier);
                userProf.coins += prize;

                await userProf.save({ transaction: t });
                await t.commit();
                logToWeb(`[CATCH] ${user.username} menangkap ${wildPokemon}.`);
                wildPokemon = null;
                return interaction.reply(`🎉 **Selamat!** Kamu menangkap **${name}**! Dapat \`+${prize} Koin\`.`);
            } else {
                await userProf.save({ transaction: t });
                await t.commit();
                return interaction.reply('💨 Oh tidak! Pokémon tersebut kabur!');
            }
        }

        if (commandName === 'release') {
            const targetId = options.getInteger('id');
            const pk = await Inventory.findOne({ where: { id: targetId, userId: user.id }, transaction: t });
            if (!pk) { await t.rollback(); return interaction.reply('❌ Pokémon dengan ID tersebut tidak ada di tasmu.'); }

            await pk.destroy({ transaction: t });
            userProf.coins += 100; // Kompensasi rilis Pokémon
            await userProf.save({ transaction: t });
            await t.commit();

            logToWeb(`[RELEASE] ${user.username} melepaskan ${pk.pokemonName} ID: ${targetId}.`);
            return interaction.reply(`🍂 Kamu melepas **${pk.pokemonName}** kembali ke habitatnya dan menerima hiburan \`+100 Koin\`.`);
        }

        if (commandName === 'leaderboard') {
            await t.commit();
            const topTrainers = await Profile.findAll({ order: [['coins', 'DESC']], limit: 5 });
            let rankText = topTrainers.map((p, index) => `${index + 1}. <@${p.userId}> — \`${p.coins} Koin\``).join('\n');
            
            const embed = new EmbedBuilder().setTitle('🏆 TOP 5 TRAINER TERKAYA').setDescription(rankText || "Belum ada data.").setColor('#fbc02d');
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'evolve') {
            const id = options.getInteger('id');
            const pk = await Inventory.findOne({ where: { id, userId: user.id }, transaction: t });
            if (!pk) { await t.rollback(); return interaction.reply('❌ Pokémon tidak ditemukan.'); }
            
            const pData = POKEMON_DB[pk.pokemonName];
            if (!pData || !pData.evolvesTo) { await t.rollback(); return interaction.reply('❌ Pokémon ini tidak memiliki jalur evolusi lanjutan.'); }

            // Batasan Level Evolusi Sesuai Game Asli
            if (pk.level < 16) { await t.rollback(); return interaction.reply('❌ Level belum mencukupi untuk memicu evolusi (Minimal Lv. 16).'); }

            const oldName = pk.pokemonName;
            pk.pokemonName = pData.evolvesTo;
            await pk.save({ transaction: t });
            await t.commit();

            logToWeb(`[EVOLVE] ${user.username} meng-evolusikan ${oldName} menjadi ${pk.pokemonName}.`);
            return interaction.reply(`🔺 **KEAJAIBAN EVOLUSI!** **${oldName}** milikmu tumbuh kuat dan berubah wujud menjadi **${pk.pokemonName}**!`);
        }

        if (commandName === 'battle') {
            const opponent = options.getUser('lawan');
            const myId = options.getInteger('id_pokemon');
            const myPoke = await Inventory.findOne({ where: { id: myId, userId: user.id }, transaction: t });
            const oppPokes = await Inventory.findAll({ where: { userId: opponent.id }, transaction: t });

            if (!myPoke || oppPokes.length === 0) { await t.rollback(); return interaction.reply('❌ Komponen pertempuran tidak valid.'); }
            await t.commit();

            const menuOptions = oppPokes.slice(0, 25).map(p => ({ label: `${p.pokemonName} (Lv. ${p.level})`, value: `opp_pk_${p.id}` }));
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId(`pvp_start_${user.id}_${opponent.id}_${myId}`).setPlaceholder('Pilih monster penantang').addOptions(menuOptions)
            );
            return interaction.reply({ content: `⚔️ **CHALLENGE PVP:** ${user} menantang ${opponent} berduel!`, components: [row] });
        }

        if (commandName === 'set-event') {
            const evName = options.getString('nama');
            const evType = options.getString('tipe');
            const duration = options.getInteger('durasi');

            ACTIVE_EVENT = {
                name: evName, type: evType, multiplier: evType === "DOUBLE_COIN" ? 2.0 : 1.0,
                endAt: Date.now() + (duration * 60 * 1000)
            };
            await t.commit();
            return interaction.reply(`📢 **EVENT GLOBAL STARTED:** **${evName}**!`);
        }

        if (commandName === 'admin-give-coin') {
            const target = options.getUser('target');
            const amount = options.getInteger('jumlah');
            const [tProf] = await Profile.findOrCreate({ where: { userId: target.id }, transaction: t });
            tProf.coins += amount;
            await tProf.save({ transaction: t });
            await t.commit();
            return interaction.reply(`👑 Koin berhasil ditambahkan ke dompet ${target}.`);
        }

        if (commandName === 'shop' || commandName === 'buy') {
            await t.commit();
            if (commandName === 'shop') return interaction.reply("🏪 Toko Aktif. Gunakan `/buy` untuk memesan barang.");
            return interaction.reply("🛍️ Transaksi selesai.");
        }

    } catch (e) {
        if (t) await t.rollback();
        console.error(e);
    }
});

// ==========================================
// ⚔️ PVP TURN-BASED SYSTEM + XP & DROP REWARDS
// ==========================================
client.on('interactionCreate', async selectInter => {
    if (!selectInter.isStringSelectMenu()) return;
    if (selectInter.customId.startsWith('pvp_start_')) {
        const [,,, oppId, p1Id] = selectInter.customId.split('_');
        if (selectInter.user.id !== oppId) return selectInter.reply({ content: '❌ Anda bukan lawan pilihan duel!', ephemeral: true });

        const p2Id = selectInter.values[0].replace('opp_pk_', '');
        const poke1 = await Inventory.findByPk(p1Id);
        const poke2 = await Inventory.findByPk(p2Id);

        let s1 = getPokemonStats(poke1); let s2 = getPokemonStats(poke2);
        let hp1 = s1.maxHp; let hp2 = s2.maxHp;
        
        let battleLog = [];
        battleLog.push(`🥊 **${poke1.pokemonName} (Lv.${poke1.level})** VS **${poke2.pokemonName} (Lv.${poke2.level})**`);

        let p1Turn = s1.speed >= s2.speed;
        let round = 1;

        while (hp1 > 0 && hp2 > 0 && round <= 6) {
            let typeMod = 1.0;
            if (p1Turn) {
                typeMod = getTypeEffectiveness(POKEMON_DB[poke1.pokemonName]?.type, POKEMON_DB[poke2.pokemonName]?.type);
                let dmg = Math.floor((((2 * poke1.level / 5 + 2) * s1.attack * 40 / s2.defense) / 50 + 2) * typeMod * (0.85 + Math.random() * 0.15));
                hp2 -= dmg;
                battleLog.push(`• **Rnd ${round}:** ${poke1.pokemonName} memukul! Dmg: \`${dmg}\``);
            } else {
                typeMod = getTypeEffectiveness(POKEMON_DB[poke2.pokemonName]?.type, POKEMON_DB[poke1.pokemonName]?.type);
                let dmg = Math.floor((((2 * poke2.level / 5 + 2) * s2.attack * 40 / s1.defense) / 50 + 2) * typeMod * (0.85 + Math.random() * 0.15));
                hp1 -= dmg;
                battleLog.push(`• **Rnd ${round}:** ${poke2.pokemonName} membalas! Dmg: \`${dmg}\``);
            }
            p1Turn = !p1Turn;
            round++;
        }

        // Tentukan pemenang & berikan hadiah XP + Koin
        let winnerUserId = hp1 > 0 ? poke1.userId : poke2.userId;
        let winningPoke = hp1 > 0 ? poke1 : poke2;
        let coinsDrop = Math.floor(Math.random() * 100) + 50; // Drop koin acak 50 - 150 koin

        // Tambah XP ke pokemon pemenang
        winningPoke.xp += 35;
        if (winningPoke.xp >= 100) {
            winningPoke.level += 1;
            winningPoke.xp = winningPoke.xp - 100;
            battleLog.push(`🆙 **LEVEL UP!** **${winningPoke.pokemonName}** naik ke Level \`${winningPoke.level}\`!`);
        }
        await winningPoke.save();

        // Tambah Koin Ke Dompet Pemenang
        const winnerProf = await Profile.findOne({ where: { userId: winnerUserId } });
        if (winnerProf) {
            winnerProf.coins += coinsDrop;
            await winnerProf.save();
        }

        battleLog.push(`\n🏆 **Hasil Akhir:** Pemenang mendapatkan \`+${coinsDrop} Koin\` & \`+35 XP\`!`);
        logToWeb(`[BATTLE] PVP Selesai. Pemenang mendapatkan drop coins.`);

        const embed = new EmbedBuilder().setTitle('⚔️ ARENA DUEL POKÉMON RIFT').setDescription(battleLog.join('\n')).setColor('#d32f2f');
        return selectInter.update({ content: `🎖️ Pertarungan selesai!`, embeds: [embed], components: [] });
    }
});

// ==========================================
// 💻 ADVANCED CONTROL PANEL WEB VIEW
// ==========================================
app.get('/', async (req, res) => {
    const totalUsers = await Profile.count();
    const totalMonsters = await Inventory.count();
    let html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rift Dashboard</title>
    <style>body{background:#121212;color:#fff;font-family:sans-serif;padding:15px;}.card{background:#1e1e1e;padding:12px;border-radius:6px;margin-bottom:15px;border-left:4px solid #00e5ff;}.log-box{background:#000;color:#00ff66;padding:10px;height:220px;overflow-y:scroll;font-family:monospace;}</style>
    </head><body>
        <h2>⚡ Pokémon Rift Mobile Panel v2</h2>
        <div class="card"><p>🎁 <strong>Active Event:</strong> ${ACTIVE_EVENT.name} | Interval Spawn: <strong>20 Menit</strong></p></div>
        <div class="card"><p>📊 Trainer Aktif: ${totalUsers} | Total Monster: ${totalMonsters}</p></div>
        <h3>📜 Real-time System Logs</h3>
        <div class="log-box">${serverLogs.map(l => `<div>> ${l}</div>`).join('')}</div>
    </body></html>`;
    res.send(html);
});

app.listen(PORT, () => console.log(`Dashboard Web Aktif.`));
client.login(process.env.DISCORD_TOKEN);
