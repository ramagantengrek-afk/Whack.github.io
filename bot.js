const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType 
} = require('discord.js');
const { Sequelize, DataTypes, Op } = require('sequelize');
const crypto = require('crypto');
require('dotenv').config();

// =========================================================================
// 🎛️ GLOBAL CONFIGURATION MATRIX
// =========================================================================
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID || '123456789012345678', // Ganti dengan Application ID bot kamu
    COOLDOWN_TIME: 15000, // Cooldown hunt: 15 detik
    // 🎭 PROGRESSIVE ROLE ENGINE MATRIX (Ganti dengan ID Role asli Servermu)
    ROLE_TIERS: [
        { min: 1, max: 9, roleId: '1521411480942018621', name: '🎒 Route One Wanderer' },
        { min: 10, max: 29, roleId: '1521411859171774488', name: '⚔️ Gym Challenger' },
        { min: 30, max: 74, roleId: '1521412227268345896', name: '🛡️ Elite Frontier' },
        { min: 75, max: 149, roleId: '1521412497104703581', name: '👑 Kanto Vanguard' },
        { min: 150, max: Infinity, roleId: '1521758737424056413', name: '🧬 Eternal Mythical Master' }
    ]
};

// =========================================================================
// 🗄️ HIGH-AVAILABILITY DATABASE ENGINE (Railway Safe Guard)
// =========================================================================
let sequelize;
if (process.env.DATABASE_URL) {
    console.log('[DB ENGINE] Menginisialisasi PostgreSQL Cloud...');
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
        pool: { max: 15, min: 2, acquire: 30000, idle: 10000 }
    });
} else {
    console.log('[DB ENGINE] DATABASE_URL undefined. Mengaktifkan Fallback SQLite Lokal...');
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: 'database.sqlite',
        logging: false
    });
}

// =========================================================================
// 📊 DATABASE SCHEMAS
// =========================================================================
const UserProfile = sequelize.define('UserProfile', {
    userId: { type: DataTypes.STRING, primaryKey: true, unique: true },
    credits: { type: DataTypes.BIGINT, defaultValue: 1000 },
    exp: { type: DataTypes.BIGINT, defaultValue: 0 },
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    caughtCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    team: { type: DataTypes.STRING, defaultValue: null }, // Menyimpan Aliansi Tim
    lastDaily: { type: DataTypes.DATE, defaultValue: null },
    lastHunt: { type: DataTypes.DATE, defaultValue: null }
});

const PokemonInventory = sequelize.define('PokemonInventory', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false, index: true },
    pokemonId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    level: { type: DataTypes.INTEGER, defaultValue: 5 },
    xp: { type: DataTypes.INTEGER, defaultValue: 0 },
    xpNeeded: { type: DataTypes.INTEGER, defaultValue: 100 },
    gender: { type: DataTypes.STRING, defaultValue: 'Genderless' },
    isShiny: { type: DataTypes.BOOLEAN, defaultValue: false },
    // IV Stats (0 - 31)
    ivHp: { type: DataTypes.INTEGER, defaultValue: () => Math.floor(Math.random() * 32) },
    ivAtk: { type: DataTypes.INTEGER, defaultValue: () => Math.floor(Math.random() * 32) },
    ivDef: { type: DataTypes.INTEGER, defaultValue: () => Math.floor(Math.random() * 32) },
    ivSpAtk: { type: DataTypes.INTEGER, defaultValue: () => Math.floor(Math.random() * 32) },
    ivSpDef: { type: DataTypes.INTEGER, defaultValue: () => Math.floor(Math.random() * 32) },
    ivSpeed: { type: DataTypes.INTEGER, defaultValue: () => Math.floor(Math.random() * 32) },
    ivTotalPercentage: { type: DataTypes.FLOAT, defaultValue: 0.0 },
    nature: { type: DataTypes.STRING, defaultValue: 'Hardy' }
}, {
    hooks: {
        beforeSave: (pokemon) => {
            const totalIv = pokemon.ivHp + pokemon.ivAtk + pokemon.ivDef + pokemon.ivSpAtk + pokemon.ivSpDef + pokemon.ivSpeed;
            pokemon.ivTotalPercentage = parseFloat(((totalIv / 186) * 100).toFixed(2));
        }
    }
});

// =========================================================================
// 🧬 ENCYCLOPEDIA POKEDEX DATA
// =========================================================================
const POKEDEX = {
    1: { name: 'Bulbasaur', catchRate: 45, evo: { level: 16, to: 2 } },
    2: { name: 'Ivysaur', catchRate: 45, evo: { level: 32, to: 3 } },
    3: { name: 'Venusaur', catchRate: 45, evo: null },
    4: { name: 'Charmander', catchRate: 45, evo: { level: 16, to: 5 } },
    5: { name: 'Charmeleon', catchRate: 45, evo: { level: 36, to: 6 } },
    6: { name: 'Charizard', catchRate: 45, evo: null },
    7: { name: 'Squirtle', catchRate: 45, evo: { level: 16, to: 8 } },
    8: { name: 'Wartortle', catchRate: 45, evo: { level: 36, to: 9 } },
    9: { name: 'Blastoise', catchRate: 45, evo: null },
    25: { name: 'Pikachu', catchRate: 190, evo: null }
};

const NATURES = ['Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty', 'Bold', 'Docile', 'Relaxed', 'Impish'];
const ACTIVE_SPAWNS = new Map();
const TRANSACTION_LOCKS = new Set();

function acquireLock(userId) {
    if (TRANSACTION_LOCKS.has(userId)) return false;
    TRANSACTION_LOCKS.add(userId);
    return true;
}
function releaseLock(userId) {
    TRANSACTION_LOCKS.delete(userId);
}

// 🎭 AUTOMATIC SWAP ROLE ENGINE (Anti-Double Role)
async function executeDynamicRoleEngine(member) {
    try {
        const totalPokemon = await PokemonInventory.count({ where: { userId: member.id } });
        const currentRoleIds = member.roles.cache.map(r => r.id);
        
        let targetTier = null;
        for (const tier of CONFIG.ROLE_TIERS) {
            if (totalPokemon >= tier.min && totalPokemon <= tier.max) {
                targetTier = tier;
                break;
            }
        }
        if (!targetTier) return;

        const allSystemRoleIds = CONFIG.ROLE_TIERS.map(t => t.roleId);
        
        for (const roleId of allSystemRoleIds) {
            if (roleId === targetTier.roleId) {
                if (!currentRoleIds.includes(roleId)) await member.roles.add(roleId);
            } else {
                if (currentRoleIds.includes(roleId)) await member.roles.remove(roleId);
            }
        }
    } catch (error) {
        console.error('[ROLE LOGIC ERROR]', error);
    }
}

// =========================================================================
// 🚀 BOT ENTRYPOINT & COMMAND DEPLOYER
// =========================================================================
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const commandsArray = [
    new SlashCommandBuilder().setName('starter').setDescription('Pilih Pokemon starter pertamamu')
        .addStringOption(opt => opt.setName('pokemon').setDescription('Pilihan').setRequired(true)
            .addChoices({ name: 'Bulbasaur', value: '1' }, { name: 'Charmander', value: '4' }, { name: 'Squirtle', value: '7' })),
    new SlashCommandBuilder().setName('team').setDescription('Pilih faksi aliansi tim kamu'),
    new SlashCommandBuilder().setName('bag').setDescription('Buka tas inventaris Pokémon kamu')
        .addUserOption(opt => opt.setName('target').setDescription('Intip tas trainer lain')),
    new SlashCommandBuilder().setName('info').setDescription('Lihat status detail dari satu Pokémon')
        .addIntegerOption(opt => opt.setName('id_unik').setDescription('Masukkan Unique ID Pokémon').setRequired(true)),
    new SlashCommandBuilder().setName('evolve').setDescription('Evolusikan Pokémon milikmu')
        .addIntegerOption(opt => opt.setName('id_unik').setDescription('Masukkan Unique ID Pokémon').setRequired(true)),
    new SlashCommandBuilder().setName('daily').setDescription('Klaim koin harian'),
    new SlashCommandBuilder().setName('hunt').setDescription('Berburu Pokémon liar di rumput'),
    new SlashCommandBuilder().setName('trade').setDescription('Barter Pokémon aman antar-pemain')
        .addUserOption(opt => opt.setName('partner').setDescription('Trainer tujuan').setRequired(true))
        .addIntegerOption(opt => opt.setName('id_kamu').setDescription('ID Pokémon milikmu').setRequired(true)),
    new SlashCommandBuilder().setName('battle').setDescription('Sistem Pertarungan Pokémon')
        .addSubcommand(sub => sub.setName('single').setDescription('PvP 1v1 melawan trainer lain')
            .addUserOption(opt => opt.setName('lawan').setDescription('Pilih lawan').setRequired(true))
            .addIntegerOption(opt => opt.setName('id_poke').setDescription('ID Pokémon andalanmu').setRequired(true)))
        .addSubcommand(sub => sub.setName('boss').setDescription('Ikut Raid Boss Co-Op Server')
            .addIntegerOption(opt => opt.setName('id_poke').setDescription('ID Pokémon andalanmu').setRequired(true)))
];

client.once('ready', async () => {
    console.log(`[CORE] ${client.user.tag} Online.`);
    await sequelize.sync({ alter: true });
    
    try {
        const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
        await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: commandsArray });
        console.log('[SLASH] Pendaftaran seluruh fitur commands sukses!');
    } catch (err) {
        console.error('[DEPLOY ERROR]', err);
    }
});

// =========================================================================
// 📥 MASTER CORE CORE EXECUTIVE HANDLING INTERACTION
// =========================================================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, user, guild, options } = interaction;
    if (!guild) return interaction.reply({ content: 'Gunakan di dalam server!', ephemeral: true });

    if (!acquireLock(user.id)) return interaction.reply({ content: '⏳ Selesaikan aksi sebelumnya terlebih dahulu!', ephemeral: true });

    const isPrivate = ['bag', 'info'].includes(commandName);
    await interaction.deferReply({ ephemeral: isPrivate });

    const transaction = await sequelize.transaction();

    try {
        const [profile] = await UserProfile.findOrCreate({ where: { userId: user.id }, transaction });

        // 🛡️ SECURITY GUARD LAYER: Kunci seluruh command jika belum klaim starter
        if (commandName !== 'starter') {
            const hasPokemon = await PokemonInventory.findOne({ where: { userId: user.id }, transaction });
            if (!hasPokemon) {
                await transaction.rollback(); releaseLock(user.id);
                return interaction.editReply('❌ **Akses Ditolak!** Kamu wajib mengambil Pokémon starter pertamamu terlebih dahulu via command `/starter`!');
            }
        }

        const member = await guild.members.fetch(user.id);

        // [1] STARTER COMMAND
        if (commandName === 'starter') {
            const checking = await PokemonInventory.findOne({ where: { userId: user.id }, transaction });
            if (checking) {
                await transaction.rollback(); releaseLock(user.id);
                return interaction.editReply('❌ Kamu sudah memiliki Pokémon starter.');
            }

            const pDexId = parseInt(options.getString('pokemon'));
            const dataP = POKEDEX[pDexId];

            const added = await PokemonInventory.create({
                userId: user.id, pokemonId: pDexId, name: dataP.name, level: 5,
                gender: Math.random() > 0.5 ? 'Male' : 'Female', isShiny: Math.random() < 0.01,
                nature: NATURES[Math.floor(Math.random() * NATURES.length)]
            }, { transaction });

            await transaction.commit(); releaseLock(user.id);
            await executeDynamicRoleEngine(member);

            return interaction.editReply(`🎉 Selamat <@${user.id}>! Kamu memulai petualangan bersama **${added.name}** (Lv. 5)!`);
        }

        // [2] TEAM SELECTION COMMAND
        if (commandName === 'team') {
            if (profile.team) {
                await transaction.rollback(); releaseLock(user.id);
                return interaction.editReply(`❌ Kamu sudah bergabung di **Team ${profile.team.toUpperCase()}**.`);
            }
            await transaction.commit(); releaseLock(user.id);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('team_valor').setLabel('🔥 VALOR').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('team_mystic').setLabel('❄️ MYSTIC').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('team_instinct').setLabel('⚡ INSTINCT').setStyle(ButtonStyle.Warning)
            );

            const msg = await interaction.editReply({ content: '📊 **PILIH FRAKSI TIM KAMU**:', components: [row] });
            const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20000 });
            col.on('collect', async b => {
                if (b.user.id !== user.id) return b.reply({ content: 'Bukan pilihanmu', ephemeral: true });
                await b.deferUpdate();
                const selected = b.customId.replace('team_', '');
                await UserProfile.update({ team: selected }, { where: { userId: user.id } });
                col.stop();
                return interaction.editReply({ content: `🎉 Kamu resmi bergabung dengan **TEAM ${selected.toUpperCase()}**!`, components: [] });
            });
        }

        // [3] BAG COMMAND
        if (commandName === 'bag') {
            const target = options.getUser('target') || user;
            const targetProfile = await UserProfile.findOne({ where: { userId: target.id }, transaction });
            if (!targetProfile) {
                await transaction.rollback(); releaseLock(user.id);
                return interaction.editReply('❌ Target belum terdaftar.');
            }

            const pokes = await PokemonInventory.findAll({ where: { userId: target.id }, transaction });
            await transaction.commit(); releaseLock(user.id);

            const embed = new EmbedBuilder().setTitle(`💼 Tas Inventaris ${target.username}`).setColor('#3498db');
            let txt = '';
            pokes.forEach(p => { txt += `\`ID: ${p.id}\` — ${p.isShiny ? '✨ ' : ''}**${p.name}** (Lv. ${p.level}) [IV: ${p.ivTotalPercentage}%]\n`; });
            embed.setDescription(txt || 'Tas Kosong.');
            return interaction.editReply({ embeds: [embed] });
        }

        // [4] INFO COMMAND
        if (commandName === 'info') {
            const uid = options.getInteger('id_unik');
            const pk = await PokemonInventory.findOne({ where: { id: uid, userId: user.id }, transaction });
            if (!pk) {
                await transaction.rollback(); releaseLock(user.id);
                return interaction.editReply('❌ Pokémon tidak ditemukan.');
            }
            await transaction.commit(); releaseLock(user.id);

            const embed = new EmbedBuilder().setTitle(`${pk.isShiny ? '✨ ' : ''}${pk.name} (#${pk.id})`).setColor('#2ecc71')
                .addFields(
                    { name: 'Detail', value: `Level: \`${pk.level}\`\nGender: \`${pk.gender}\`\nNature: \`${pk.nature}\``, inline: true },
                    { name: 'Individual Values', value: `HP: \`${pk.ivHp}/31\`\nAtk: \`${pk.ivAtk}/31\`\nDef: \`${pk.ivDef}/31\`\n**Akumulasi:** \`${pk.ivTotalPercentage}%\``, inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }

        // [5] HUNT COMMAND
        if (commandName === 'hunt') {
            const now = new Date();
            if (profile.lastHunt && (now - new Date(profile.lastHunt)) < CONFIG.COOLDOWN_TIME) {
                await transaction.rollback(); releaseLock(user.id);
                return interaction.editReply('❌ Kamu lelah, istirahat sejenak!');
            }

            profile.lastHunt = now; await profile.save({ transaction });
            await transaction.commit(); releaseLock(user.id);

            const pKeys = Object.keys(POKEDEX);
            const rKey = pKeys[Math.floor(Math.random() * pKeys.length)];
            const wild = POKEDEX[rKey];
            const wLv = Math.floor(Math.random() * 20) + 5;
            const isShinyWild = Math.random() < 0.05; // 5% chance hunt shiny

            const token = crypto.randomBytes(3).toString('hex');
            ACTIVE_SPAWNS.set(user.id, { token, pokeId: parseInt(rKey), name: wild.name, level: wLv, isShiny: isShinyWild, catchRate: wild.catchRate });

            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`c_${token}`).setLabel('Lempar Pokeball').setStyle(ButtonStyle.Success));
            const msg = await interaction.editReply({ content: `🌳 Kamu bertemu **${isShinyWild ? '✨ ' : ''}Wild ${wild.name}** (Lv. ${wLv})!`, components: [row] });

            const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 15000 });
            collector.on('collect', async b => {
                if (b.user.id !== user.id) return b.reply({ content: 'Bukan berburumu!', ephemeral: true });
                await b.deferUpdate(); collector.stop();

                const c = ACTIVE_SPAWNS.get(user.id);
                if (!c || c.token !== token) return interaction.followUp('Sesi kadaluwarsa.');
                ACTIVE_SPAWNS.delete(user.id);

                if (Math.random() * 255 <= c.catchRate + 100) {
                    const lTx = await sequelize.transaction();
                    const newPk = await PokemonInventory.create({ userId: user.id, pokemonId: c.pokeId, name: c.name, level: c.level, isShiny: c.isShiny }, { transaction: lTx });
                    await UserProfile.increment({ caughtCount: 1 }, { where: { userId: user.id }, transaction: lTx });
                    await lTx.commit();
                    await executeDynamicRoleEngine(member);
                    return interaction.followUp(`🎉 Berhasil ditangkap! **${c.name}** masuk ke tas dengan database ID: \`#${newPk.id}\`.`);
                } else {
                    return interaction.followUp(`💨 Oh tidak! **${c.name}** melarikan diri!`);
                }
            });
        }

        // [6] EVOLVE COMMAND
        if (commandName === 'evolve') {
            const uid = options.getInteger('id_unik');
            const pk = await PokemonInventory.findOne({ where: { id: uid, userId: user.id }, transaction });
            if (!pk) { await transaction.rollback(); releaseLock(user.id); return interaction.editReply('❌ Pokémon tidak ditemukan.'); }

            const cfg = POKEDEX[pk.pokemonId];
            if (!cfg || !cfg.evo) { await transaction.rollback(); releaseLock(user.id); return interaction.editReply('❌ Pokémon ini tidak bisa berevolusi lagi.'); }
            if (pk.level < cfg.evo.level) { await transaction.rollback(); releaseLock(user.id); return interaction.editReply(`❌ Minimal Level \`${cfg.evo.level}\` untuk evolusi.`); }

            const targetEvo = POKEDEX[cfg.evo.to];
            pk.pokemonId = cfg.evo.to; pk.name = targetEvo.name;
            await pk.save({ transaction });
            await transaction.commit(); releaseLock(user.id);

            return interaction.editReply(`🧬 Wow! Pokémon kamu berevolusi menjadi **${pk.name}**!`);
        }

        // [7] DAILY COMMAND
        if (commandName === 'daily') {
            const now = new Date();
            if (profile.lastDaily && (now - new Date(profile.lastDaily)) < 86400000) {
                await transaction.rollback(); releaseLock(user.id);
                return interaction.editReply('❌ Tunjangan harian sudah kamu ambil hari ini.');
            }
            profile.credits = parseInt(profile.credits) + 1500;
            profile.lastDaily = now;
            await profile.save({ transaction });
            await transaction.commit(); releaseLock(user.id);
            return interaction.editReply('💰 Kamu menerima jatah harian sebesar **1500 Credits**!');
        }

        // [8] TRADE COMMAND
        if (commandName === 'trade') {
            const partner = options.getUser('partner');
            const myId = options.getInteger('id_kamu');
            if (partner.id === user.id) { await transaction.rollback(); releaseLock(user.id); return interaction.editReply('❌ Tidak bisa trade mandiri.'); }

            const myPk = await PokemonInventory.findOne({ where: { id: myId, userId: user.id }, transaction });
            if (!myPk) { await transaction.rollback(); releaseLock(user.id); return interaction.editReply('❌ ID Pokémon kamu salah.'); }
            await transaction.commit(); releaseLock(user.id);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ta_${user.id}`).setLabel('Terima Barter').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`td_${user.id}`).setLabel('Tolak').setStyle(ButtonStyle.Danger)
            );
            const msg = await interaction.editReply({ content: `🤝 <@${partner.id}>, <@${user.id}> mengajak barter **${myPk.name}** (Lv. ${myPk.level}). Ambil?`, components: [row] });

            const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });
            col.on('collect', async b => {
                if (b.user.id !== partner.id) return b.reply({ content: 'Bukan partner terpilih!', ephemeral: true });
                await b.deferUpdate(); col.stop();
                if (b.customId.startsWith('ta')) {
                    await PokemonInventory.update({ userId: partner.id }, { where: { id: myId } });
                    const pMem = await guild.members.fetch(partner.id);
                    await executeDynamicRoleEngine(member); await executeDynamicRoleEngine(pMem);
                    return interaction.editReply({ content: `🎉 Barter sukses! **${myPk.name}** dikirim ke <@${partner.id}>!`, components: [] });
                } else {
                    return interaction.editReply({ content: '❌ Barter ditolak.', components: [] });
                }
            });
        }

        // [9] BATTLE ENGINE COMMAND (PvP & Raid Boss)
        if (commandName === 'battle') {
            const sub = options.getSubcommand();
            const id_p = options.getInteger('id_poke');
            const pk = await PokemonInventory.findOne({ where: { id: id_p, userId: user.id }, transaction });
            if (!pk) { await transaction.rollback(); releaseLock(user.id); return interaction.editReply('❌ Pokémon tidak ditemukan.'); }

            if (sub === 'single') {
                const lawan = options.getUser('lawan');
                if (lawan.id === user.id) { await transaction.rollback(); releaseLock(user.id); return interaction.editReply('❌ Tidak bisa melawan diri sendiri.'); }
                const lawPk = await PokemonInventory.findOne({ where: { userId: lawan.id }, order: [['level', 'DESC']], transaction });
                if (!lawPk) { await transaction.rollback(); releaseLock(user.id); return interaction.editReply('❌ Lawan belum punya Pokémon.'); }
                await transaction.commit(); releaseLock(user.id);

                let p1Hp = pk.level * 20 + pk.ivHp, p2Hp = lawPk.level * 20 + lawPk.ivHp;
                let log = `⚔️ **STADIUM PVP** ⚔️\n\n`;
                while (p1Hp > 0 && p2Hp > 0) {
                    let d1 = Math.floor((pk.level * 4) * (1 + pk.ivAtk / 31)); p2Hp -= d1;
                    log += `💥 **${pk.name}** menyerang! Memukul \`${d1} DMG\` (HP Lawan: ${Math.max(0, p2Hp)})\n`;
                    if (p2Hp <= 0) break;
                    let d2 = Math.floor((lawPk.level * 4) * (1 + lawPk.ivAtk / 31)); p1Hp -= d2;
                    log += `💥 **${lawPk.name}** membalas! Memukul \`${d2} DMG\` (HP Anda: ${Math.max(0, p1Hp)})\n`;
                }
                log += `\n🏆 Juara Arena: <@${p1Hp > 0 ? user.id : lawan.id}>!`;
                return interaction.editReply({ embeds: [new EmbedBuilder().setDescription(log).setColor('#e67e22')] });
            }

            if (sub === 'boss') {
                await transaction.commit(); releaseLock(user.id);
                let bHp = 2500;
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ba').setLabel('SERANG BERSAMA').setStyle(ButtonStyle.Danger));
                const emb = new EmbedBuilder().setTitle('👹 WORLD RAID BOSS: MEWTWO').setDescription(`HP Boss: \`${bHp}/2500\`\n\n*Semua pemain di server bisa menekan tombol di bawah untuk menyerang!*`).setColor('#9b59b6');
                const msg = await interaction.editReply({ embeds: [emb], components: [row] });

                const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 40000 });
                col.on('collect', async b => {
                    await b.deferUpdate();
                    const uTeam = await UserProfile.findOne({ where: { userId: b.user.id } });
                    let bonus = uTeam && uTeam.team === 'valor' ? 1.5 : 1.0; // Bonus attack tim Valor

                    let dmg = Math.floor((Math.random() * 100 + 50) * bonus);
                    bHp -= dmg;
                    if (bHp <= 0) {
                        col.stop(); return interaction.followUp(`🎉 **BOSS KALAH!** <@${b.user.id}> menumbangkan boss dengan damage terakhir \`${dmg} DMG\`!`);
                    } else {
                        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('👹 RAID BOSS IN PROGRESS').setDescription(`HP Boss: \`${bHp}/2500\`\nTerakhir disabet oleh <@${b.user.id}> sebesar \`${dmg} DMG\`!`).setColor('#9b59b6')] });
                    }
                });
            }
        }

    } catch (err) {
        if (transaction.finished !== 'commit') await transaction.rollback();
        releaseLock(user.id);
        console.error(err);
        return interaction.editReply('❌ Kegagalan kueri database internal.');
    }
});

client.login(CONFIG.TOKEN);
