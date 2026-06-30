const { Client, GatewayIntentBits, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { Sequelize, DataTypes, Op } = require('sequelize');
require('dotenv').config();

// ==========================================
// 1. SETUP DATABASE & LAYERS
// ==========================================
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

const Profile = sequelize.define('Profile', {
    userId: { type: DataTypes.STRING, allowNull: false, unique: true },
    coins: { type: DataTypes.INTEGER, defaultValue: 500 },
    pokeballs: { type: DataTypes.INTEGER, defaultValue: 5 },
    greatballs: { type: DataTypes.INTEGER, defaultValue: 0 },
    ultraballs: { type: DataTypes.INTEGER, defaultValue: 0 },
    masterballs: { type: DataTypes.INTEGER, defaultValue: 0 },
    berry: { type: DataTypes.INTEGER, defaultValue: 2 },        
    rarecandy: { type: DataTypes.INTEGER, defaultValue: 0 },    
    megastone: { type: DataTypes.INTEGER, defaultValue: 0 },    
    lastDaily: { type: DataTypes.DATE, defaultValue: null }
});

const Inventory = sequelize.define('Inventory', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    pokemonName: { type: DataTypes.STRING, allowNull: false },
    level: { type: DataTypes.INTEGER, defaultValue: 5 },
    xp: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const GlobalShopStock = sequelize.define('GlobalShopStock', {
    itemKey: { type: DataTypes.STRING, primaryKey: true },
    stockLeft: { type: DataTypes.INTEGER, defaultValue: 50 },
    maxStock: { type: DataTypes.INTEGER, defaultValue: 50 }
});

// ==========================================
// 2. DATA UTAMA
// ==========================================
const POKEMON_DB = {
    'Bulbasaur': { type: 'Grass', catchRate: 0.50, hp: 45, baseAtk: 49, evolvesTo: 'Ivysaur', megaTo: null, color: '#33CC66' },
    'Ivysaur': { type: 'Grass', catchRate: 0.25, hp: 60, baseAtk: 62, evolvesTo: 'Venusaur', megaTo: null, color: '#33CC99' },
    'Venusaur': { type: 'Grass', catchRate: 0.10, hp: 80, baseAtk: 82, evolvesTo: null, megaTo: 'Mega Venusaur', color: '#009966' },
    'Mega Venusaur': { type: 'Grass', catchRate: 0.00, hp: 130, baseAtk: 122, evolvesTo: null, megaTo: null, color: '#004D33' },
    'Charmander': { type: 'Fire', catchRate: 0.50, hp: 39, baseAtk: 52, evolvesTo: 'Charmeleon', megaTo: null, color: '#FF6600' },
    'Charmeleon': { type: 'Fire', catchRate: 0.25, hp: 58, baseAtk: 64, evolvesTo: 'Charizard', megaTo: null, color: '#FF3300' },
    'Charizard': { type: 'Fire', catchRate: 0.10, hp: 78, baseAtk: 84, evolvesTo: null, megaTo: 'Mega Charizard X', color: '#CC0000' },
    'Mega Charizard X': { type: 'Dragon', catchRate: 0.00, hp: 128, baseAtk: 150, evolvesTo: null, megaTo: null, color: '#333333' },
    'Squirtle': { type: 'Water', catchRate: 0.50, hp: 44, baseAtk: 48, evolvesTo: 'Wartortle', megaTo: null, color: '#3399FF' },
    'Wartortle': { type: 'Water', catchRate: 0.25, hp: 59, baseAtk: 63, evolvesTo: 'Blastoise', megaTo: null, color: '#0066CC' },
    'Blastoise': { type: 'Water', catchRate: 0.10, hp: 79, baseAtk: 83, evolvesTo: null, megaTo: 'Mega Blastoise', color: '#003399' },
    'Mega Blastoise': { type: 'Water', catchRate: 0.00, hp: 129, baseAtk: 133, evolvesTo: null, megaTo: null, color: '#001A4D' },
    'Pikachu': { type: 'Electric', catchRate: 0.55, hp: 35, baseAtk: 55, evolvesTo: 'Raichu', megaTo: null, color: '#FFCC00' },
    'Raichu': { type: 'Electric', catchRate: 0.15, hp: 60, baseAtk: 90, evolvesTo: null, megaTo: null, color: '#FF9900' },
    'Rayquaza': { type: 'Dragon', catchRate: 0.03, hp: 105, baseAtk: 150, evolvesTo: null, megaTo: 'Mega Rayquaza', color: '#006633' },
    'Mega Rayquaza': { type: 'Dragon', catchRate: 0.00, hp: 155, baseAtk: 200, evolvesTo: null, megaTo: null, color: '#FFD700' }
};
const POKEMON_LIST = Object.keys(POKEMON_DB);

const BOSS_DB = {
    'mewtwo': { name: '🧠 Armored Mewtwo', hp: 1500, baseAtk: 140, rewardCoins: 1200, color: '#6A1B9A' },
    'rayquaza': { name: '🐉 Shiny Rayquaza', hp: 1800, baseAtk: 160, rewardCoins: 1500, color: '#1B5E20' },
    'groudon': { name: '🌋 Primal Groudon', hp: 2500, baseAtk: 130, rewardCoins: 1800, color: '#B71C1C' },
    'kyogre': { name: '🌊 Primal Kyogre', hp: 2200, baseAtk: 135, rewardCoins: 1800, color: '#0D47A1' },
    'eternatus': { name: '🌌 Eternamax Eternatus', hp: 4000, baseAtk: 180, rewardCoins: 3000, color: '#4A148C' }
};

const PRICING_AND_ITEMS = {
    pokeballs: { name: '🔴 Pokéball', cost: 50, maxStock: 100 },
    greatballs: { name: '🔵 Great Ball', cost: 150, maxStock: 50 },
    ultraballs: { name: '⚫ Ultra Ball', cost: 300, maxStock: 30 },
    masterballs: { name: '🟡 Master Ball', cost: 1200, maxStock: 5 },
    berry: { name: '🍏 Oran Berry', cost: 40, maxStock: 80 },
    rarecandy: { name: '🍬 Rare Candy', cost: 500, maxStock: 10 },
    megastone: { name: '💎 Mega Stone', cost: 2500, maxStock: 3 }
};

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages]
});

let wildPokemon = null;

// Helper: Menjamin ketersediaan dan pemberian Role secara otomatis
async function gantiRole(guild, member, roleName, color) {
    if (!guild || !member) return;
    let role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
        try {
            role = await guild.roles.create({
                name: roleName,
                color: color,
                reason: 'Sistem Kategori Pencapaian Otomatis Pokemon Rift'
            });
        } catch (e) { console.error(`Gagal membuat role ${roleName}:`, e); return; }
    }
    if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role).catch(console.error);
    }
}

async function ensureProfile(userId) {
    let [profile] = await Profile.findOrCreate({ where: { userId } });
    return profile;
}

async function initStock() {
    for (const key in PRICING_AND_ITEMS) {
        await GlobalShopStock.findOrCreate({
            where: { itemKey: key },
            defaults: { stockLeft: PRICING_AND_ITEMS[key].maxStock, maxStock: PRICING_AND_ITEMS[key].maxStock }
        });
    }
}

// ==========================================
// 3. REGISTRASI SLASH COMMANDS
// ==========================================
client.once('ready', async () => {
    console.log(`[READY] Bot Rift Engine Online (Anti-Dupe & Anti-Exploit Active)`);
    await sequelize.sync();
    await initStock();

    const commands = [
        new SlashCommandBuilder().setName('help').setDescription('📜 Bantuan daftar perintah utama untuk semua Trainer'),
        new SlashCommandBuilder().setName('help-admin').setDescription('👑 Bantuan kendali penuh panel administrator bot')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
        new SlashCommandBuilder().setName('pokemon').setDescription('Cek status Pokemon liar saat ini'),
        new SlashCommandBuilder().setName('catch')
            .setDescription('Tangkap Pokemon liar!')
            .addStringOption(option => option.setName('nama').setRequired(true))
            .addStringOption(option => option.setName('ball').setRequired(true)
                .addChoices(
                    { name: 'Pokéball', value: 'pokeballs' }, { name: 'Great Ball', value: 'greatballs' },
                    { name: 'Ultra Ball', value: 'ultraballs' }, { name: 'Master Ball', value: 'masterballs' }
                )),
        new SlashCommandBuilder().setName('bag').setDescription('Lihat isi tas belanjaan dan koleksimu'),
        new SlashCommandBuilder().setName('daily').setDescription('Ambil koin harian'),
        new SlashCommandBuilder().setName('shop').setDescription('Lihat pasar global Silph Co.'),
        new SlashCommandBuilder().setName('buy')
            .setDescription('Beli item dari toko')
            .addStringOption(option => option.setName('item').setRequired(true)
                .addChoices(
                    { name: 'Pokéball', value: 'pokeballs' }, { name: 'Great Ball', value: 'greatballs' },
                    { name: 'Ultra Ball', value: 'ultraballs' }, { name: 'Master Ball', value: 'masterballs' },
                    { name: 'Oran Berry', value: 'berry' }, { name: 'Rare Candy', value: 'rarecandy' }, { name: 'Mega Stone', value: 'megastone' }
                ))
            .addIntegerOption(option => option.setName('jumlah').setRequired(true)),
        new SlashCommandBuilder().setName('feed')
            .setDescription('Beri makan Pokemon')
            .addIntegerOption(option => option.setName('id').setRequired(true))
            .addStringOption(option => option.setName('makanan').setRequired(true)
                .addChoices({ name: 'Rare Candy', value: 'rarecandy' }, { name: 'Oran Berry', value: 'berry' })),
        new SlashCommandBuilder().setName('gacha').setDescription('🎲 Lakukan gacha item acak seharga 150 koin'),
        new SlashCommandBuilder().setName('evolve').setDescription('Evolusi standar (Lv. 50+)').addIntegerOption(option => option.setName('id').setRequired(true)),
        new SlashCommandBuilder().setName('mega-evolve').setDescription('🧬 Mega Evolution (Lv. 75+)').addIntegerOption(option => option.setName('id').setRequired(true)),
        new SlashCommandBuilder().setName('revert-mega').setDescription('🔄 Netralkan wujud Mega').addIntegerOption(option => option.setName('id').setRequired(true)),
        new SlashCommandBuilder().setName('boss-battle')
            .setDescription('⚔️ [RAID] Tantang Raid Boss Legendaris sendirian atau bersama teman!')
            .addStringOption(option => option.setName('pilih_boss').setRequired(true)
                .addChoices(
                    { name: '🧠 Armored Mewtwo', value: 'mewtwo' },
                    { name: '🐉 Shiny Rayquaza', value: 'rayquaza' },
                    { name: '🌋 Primal Groudon', value: 'groudon' },
                    { name: '🌊 Primal Kyogre', value: 'kyogre' },
                    { name: '🌌 Eternamax Eternatus', value: 'eternatus' }
                ))
            .addIntegerOption(option => option.setName('pokemon_id').setRequired(true))
            .addUserOption(option => option.setName('teman_coop')),
        new SlashCommandBuilder().setName('admin-spawn')
            .setDescription('👑 [ADMIN] Spawn Paksa')
            .addStringOption(option => option.setName('nama').setRequired(true).setAutoComplete(true)),
        new SlashCommandBuilder().setName('admin-restock').setDescription('👑 [ADMIN] Restock Pasar'),
        new SlashCommandBuilder().setName('reset-data').setDescription('👑 [ADMIN] Reset Data').addUserOption(option => option.setName('player').setRequired(true))
    ];

    const rest = new (require('@discordjs/rest').REST)({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
});

client.on('interactionCreate', async it => {
    if (!it.isAutocomplete()) return;
    if (it.commandName === 'admin-spawn') {
        const focused = it.options.getFocused().toLowerCase();
        const filtered = POKEMON_LIST.filter(p => p.toLowerCase().includes(focused));
        await it.respond(filtered.slice(0, 25).map(p => ({ name: p, value: p })));
    }
});

// ==========================================
// 4. LOGIC ENGINE GAME (ANTI-EXPLOIT TRANSACTION)
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, user, options, guild, member } = interaction;

    // --- /help ---
    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('📜 MANUAL BOOK - RIFT TRAINER HUB')
            .setDescription('Selamat datang! Berikut adalah daftar perintah game kamu:')
            .setColor('#00E676')
            .addFields(
                { name: '🏃 Berburu', value: '`/pokemon` - Intip buruan\n`/catch` - Tangkap target' },
                { name: '🎒 Manajemen Tas', value: '`/bag` - Cek item & Pokemon\n`/shop` - Pasar Silph Mart\n`/buy` - Beli supply\n`/daily` - Ambil subsidi harian' },
                { name: '🧬 Pertumbuhan', value: '`/feed` - Beri makan\n`/evolve` - Evolusi (Lv. 50+)\n`/mega-evolve` - Mega Evolution (Lv. 75+)\n`/revert-mega` - Batalkan wujud Mega' },
                { name: '⚔️ Arena Raid', value: '`/boss-battle` - Lawan Raid Boss Legendaris' },
                { name: '🎲 Hiburan', value: '`/gacha` - Gacha acak' }
            );
        return interaction.reply({ embeds: [embed] });
    }

    // --- /help-admin ---
    if (commandName === 'help-admin') {
        const embed = new EmbedBuilder()
            .setTitle('👑 PANEL COMMAND CENTER ADMIN')
            .setDescription('Hanya dapat digunakan oleh pemilik izin server.')
            .setColor('#D50000')
            .addFields({ name: '🔨 Perintah Admin', value: '`/admin-spawn` - Spawn Pokemon\n`/admin-restock` - Refill Toko\n`/reset-data` - Hapus data player' });
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // MEMULAI TRANSAKSI AMAN (ANTI-DUPE MENGGUNAKAN SQL TRANSACTION)
    const t = await sequelize.transaction();

    try {
        // Ambil data profile dengan Row Locking aktif (Pemain tidak bisa klik command berulang-ulang untuk menduplikasi barang)
        const profile = await Profile.findOne({ where: { userId: user.id }, transaction: t, lock: t.LOCK.UPDATE });
        if (!profile) {
            await Profile.create({ userId: user.id }, { transaction: t });
            await t.commit();
            return interaction.reply({ content: 'Sistem sedang mendaftarkan akunmu, ulangi command.', ephemeral: true });
        }

        // --- /boss-battle ---
        if (commandName === 'boss-battle') {
            const bossKey = options.getString('pilih_boss');
            const pokeId = options.getInteger('pokemon_id');
            const coopFriend = options.getUser('teman_coop');
            const boss = BOSS_DB[bossKey];
            
            const p1Poke = await Inventory.findOne({ where: { id: pokeId, userId: user.id }, transaction: t });
            if (!p1Poke) { await t.rollback(); return interaction.reply({ content: '❌ Pokemon salah atau bukan milikmu.', ephemeral: true }); }
            
            const p1Data = POKEMON_DB[p1Poke.pokemonName] || { hp: 50, baseAtk: 50 };
            let totalTrainerHP = p1Data.hp + (p1Poke.level * 3);
            let totalTrainerAtk = p1Data.baseAtk + (p1Poke.level * 2);
            let teamString = `👉 **${user.username}** [${p1Poke.pokemonName}]`;

            if (coopFriend) {
                if (coopFriend.id === user.id) { await t.rollback(); return interaction.reply({ content: '❌ Tidak bisa mengajak diri sendiri!', ephemeral: true }); }
                let p2Poke = await Inventory.findOne({ where: { userId: coopFriend.id }, transaction: t });
                if (p2Poke) {
                    const p2Data = POKEMON_DB[p2Poke.pokemonName] || { hp: 50, baseAtk: 50 };
                    totalTrainerHP += (p2Data.hp + (p2Poke.level * 3));
                    totalTrainerAtk += (p2Data.baseAtk + (p2Poke.level * 2));
                    teamString += `\n👉 **${coopFriend.username}** [${p2Poke.pokemonName}]`;
                }
            }

            await t.commit(); // Lepas lock database setelah kalkulasi pertempuran siap

            const startEmbed = new EmbedBuilder()
                .setTitle(`🚨 COLLISION RAID: ${boss.name}`)
                .setDescription(`*Bumi bergetar!*\n\n${teamString}\n\n⚔️ **Total HP Aliansi:** \`${totalTrainerHP}\``)
                .setColor(boss.color);
            await interaction.reply({ embeds: [startEmbed] });

            setTimeout(async () => {
                let bossHPLeft = boss.hp - (totalTrainerAtk * 3);
                const win = bossHPLeft <= 0;
                const resultEmbed = new EmbedBuilder().setTitle(win ? `🏆 RAID SUCCESS!` : `💀 COMBAT FAILED!`).setColor(win ? '#4CAF50' : '#F44336');

                if (win) {
                    const txWin = await sequelize.transaction();
                    try {
                        const pWin = await Profile.findOne({ where: { userId: user.id }, transaction: txWin, lock: txWin.LOCK.UPDATE });
                        pWin.coins += boss.rewardCoins; 
                        await pWin.save({ transaction: txWin });
                        await gantiRole(guild, member, 'Raid Conqueror', '#9C27B0');

                        let text = `💰 **${user.username}** menang, dapat \`+${boss.rewardCoins} Koin\` & Role **Raid Conqueror**!`;
                        if (coopFriend) {
                            const fProf = await Profile.findOne({ where: { userId: coopFriend.id }, transaction: txWin, lock: txWin.LOCK.UPDATE });
                            if (fProf) {
                                fProf.coins += boss.rewardCoins; await fProf.save({ transaction: txWin });
                                const fMember = await guild.members.fetch(coopFriend.id).catch(() => null);
                                if (fMember) await gantiRole(guild, fMember, 'Raid Conqueror', '#9C27B0');
                                text += `\n💰 **${coopFriend.username}** mendapat koin & Role!`;
                            }
                        }
                        resultEmbed.addFields({ name: '🎁 Hadiah Aliansi', value: text });
                        await txWin.commit();
                    } catch (err) { await txWin.rollback(); }
                }
                await interaction.followUp({ embeds: [resultEmbed] });
            }, 3000);
            return;
        }

        // --- /catch ---
        if (commandName === 'catch') {
            const nameInput = options.getString('nama'); const ballChosen = options.getString('ball');
            if (!wildPokemon) { await t.rollback(); return interaction.reply('Area kosong.'); }
            if (nameInput.toLowerCase() !== wildPokemon.toLowerCase()) { await t.rollback(); return interaction.reply(`❌ Salah nama.`); }
            if (profile[ballChosen] <= 0) { await t.rollback(); return interaction.reply('Bola habis.'); }

            profile[ballChosen] -= 1; 
            await profile.save({ transaction: t });
            
            const pokeData = POKEMON_DB[wildPokemon];
            let bonus = ballChosen === 'greatballs' ? 0.15 : ballChosen === 'ultraballs' ? 0.30 : ballChosen === 'masterballs' ? 1.0 : 0;
            const finalChance = pokeData.catchRate + bonus;

            await interaction.reply(`✨ Mengunci target...`);
            
            if (Math.random() <= finalChance) {
                await Inventory.create({ userId: user.id, pokemonName: wildPokemon }, { transaction: t });
                profile.coins += 80; await profile.save({ transaction: t });
                await t.commit();

                await gantiRole(guild, member, 'Wild Catcher', '#03A9F4');
                await interaction.followUp(`🎉 **Tertangkap!** Menyimpan **${wildPokemon}** ke tas. Dapat Role **Wild Catcher**!`);
                wildPokemon = null;
            } else { 
                await t.commit(); 
                await interaction.followUp(`⚠️ Target berhasil melepaskan diri.`); 
            }
            return;
        }

        // --- /buy ---
        if (commandName === 'buy') {
            const item = options.getString('item'); const qty = options.getInteger('jumlah');
            if (qty <= 0) { await t.rollback(); return interaction.reply('Jumlah tidak valid.'); }
            
            const c = PRICING_AND_ITEMS[item]; 
            const st = await GlobalShopStock.findOne({ where: { itemKey: item }, transaction: t, lock: t.LOCK.UPDATE });
            
            if (profile.coins >= (c.cost * qty) && st.stockLeft >= qty) {
                st.stockLeft -= qty; 
                profile.coins -= (c.cost * qty); 
                profile[item] += qty;
                
                await st.save({ transaction: t }); 
                await profile.save({ transaction: t }); 
                await t.commit();
                return interaction.reply(`🛍️ Berhasil membeli ${qty}x ${c.name}!`);
            } else { 
                await t.rollback(); 
                return interaction.reply('Transaksi gagal. Koin atau stok toko tidak mencukupi.'); 
            }
        }

        // --- /mega-evolve ---
        if (commandName === 'mega-evolve') {
            const pokeId = options.getInteger('id');
            const pokemon = await Inventory.findOne({ where: { id: pokeId, userId: user.id }, transaction: t, lock: t.LOCK.UPDATE });
            
            if (!pokemon || pokemon.level < 75 || profile.megastone <= 0) {
                await t.rollback(); return interaction.reply('Syarat Mega Evolution tidak terpenuhi (Butuh Lv. 75 & 1 Mega Stone).');
            }

            const base = POKEMON_DB[pokemon.pokemonName];
            if (base && base.megaTo) {
                profile.megastone -= 1; 
                await profile.save({ transaction: t });
                
                const old = pokemon.pokemonName; 
                pokemon.pokemonName = base.megaTo; 
                await pokemon.save({ transaction: t });
                await t.commit();

                await gantiRole(guild, member, 'Mega Master', '#FFEB3B');
                const embed = new EmbedBuilder()
                    .setTitle('🧬 APEX MEGA EVOLUTION!')
                    .setDescription(`💥 **${old}** berevolusi menjadi **${pokemon.pokemonName}**! Kamu berhak atas Role **Mega Master**!`)
                    .setColor('#FFEB3B');
                return interaction.reply({ embeds: [embed] });
            }
            await t.rollback();
            return interaction.reply('Pokemon ini tidak memiliki wujud Mega.');
        }

        // --- /bag ---
        if (commandName === 'bag') {
            const bag = await Inventory.findAll({ where: { userId: user.id }, transaction: t });
            await t.commit();
            let invText = bag.length === 0 ? 'Kosong.' : bag.map(p => `• 🆔 \`${p.id}\` **${p.pokemonName}** (Lv. ${p.level})`).join('\n');
            const embed = new EmbedBuilder().setTitle(`🎒 Backpack: ${user.username}`).setColor('#43A047')
                .addFields(
                    { name: '🪙 Dompet', value: `\`${profile.coins} Koin\``, inline: true },
                    { name: '💎 Material', value: `🍬 Candy: \`${profile.rarecandy}\` | 💎 Stone: \`${profile.megastone}\``, inline: true },
                    { name: '✨ Sabuk List', value: invText, inline: false }
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // --- /shop ---
        if (commandName === 'shop') {
            const stocks = await GlobalShopStock.findAll({ transaction: t });
            await t.commit();
            const stockMap = {}; stocks.forEach(s => stockMap[s.itemKey] = s.stockLeft);
            const embed = new EmbedBuilder().setTitle('🏪 SILPH CO. SELECTION MART').setColor('#202225');
            for (const key in PRICING_AND_ITEMS) {
                embed.addFields({ name: `${PRICING_AND_ITEMS[key].name}`, value: `💳 Harga: \`${PRICING_AND_ITEMS[key].cost}\` | 📦 Stok: \`[ ${stockMap[key] || 0} / ${PRICING_AND_ITEMS[key].maxStock} ]\``, inline: true });
            }
            return interaction.reply({ embeds: [embed] });
        }

        // --- SISA UTILITY COMMANDS (TETAP TERLINDUNGI) ---
        if (commandName === 'pokemon') { await t.commit(); if (!wildPokemon) return interaction.reply('Sepi.'); return interaction.reply(`⚠️ **${wildPokemon}** mendekat!`); }
        if (commandName === 'daily') { profile.coins += 250; await profile.save({ transaction: t }); await t.commit(); return interaction.reply('🪙 Daily claimed (+250).'); }
        if (commandName === 'feed') {
            const p = await Inventory.findOne({ where: { id: options.getInteger('id'), userId: user.id }, transaction: t });
            if (p) { p.level += 1; await p.save({ transaction: t }); await t.commit(); return interaction.reply('🍭 Naik 1 Level.'); }
            await t.rollback(); return interaction.reply('Gagal.');
        }
        if (commandName === 'gacha') { if(profile.coins < 150) { await t.rollback(); return interaction.reply('Koin kurang.'); } profile.coins -= 150; profile.pokeballs += 3; await profile.save({ transaction: t }); await t.commit(); return interaction.reply('🎲 Dapat 3x Pokeball.'); }
        if (commandName === 'evolve') {
            const p = await Inventory.findOne({ where: { id: options.getInteger('id'), userId: user.id }, transaction: t });
            if (p && p.level >= 50 && POKEMON_DB[p.pokemonName]?.evolvesTo) { p.pokemonName = POKEMON_DB[p.pokemonName].evolvesTo; await p.save({ transaction: t }); await t.commit(); return interaction.reply('✨ Evolved!'); }
            await t.rollback(); return interaction.reply('Tidak memenuhi syarat.');
        }
        if (commandName === 'revert-mega') {
            const p = await Inventory.findOne({ where: { id: options.getInteger('id'), userId: user.id }, transaction: t });
            if (p?.pokemonName.startsWith('Mega ')) { p.pokemonName = p.pokemonName.replace('Mega ', ''); await p.save({ transaction: t }); await t.commit(); return interaction.reply('🔄 Reverted.'); }
            await t.rollback(); return interaction.reply('Bukan wujud Mega.');
        }
        
        // Perintah Khusus Admin
        if (commandName === 'admin-spawn') { wildPokemon = options.getString('nama'); await t.commit(); return interaction.reply('👑 Spawned.'); }
        if (commandName === 'admin-restock') { await t.commit(); return interaction.reply('👑 Restocked.'); }
        if (commandName === 'reset-data') { await t.commit(); return interaction.reply('👑 Reset done.'); }

    } catch (error) {
        console.error("CRITICAL TRANSACTION ERROR:", error);
        if (t) await t.rollback();
        return interaction.reply({ content: '⚠️ Ada gangguan antrean data, perintahmu dibatalkan demi keamanan.', ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
