const { Client, GatewayIntentBits, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

// ==========================================
// 1. SETUP DATABASE & PERSISTENCE (POSTGRESQL)
// ==========================================
// Railway otomatis menyediakan variabel DATABASE_URL jika PostgreSQL ditambahkan
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false // Wajib untuk koneksi aman ke Railway
        }
    }
});

// Model Database Inventory Pokemon
const Inventory = sequelize.define('Inventory', {
    userId: { type: DataTypes.STRING, allowNull: false },
    pokemonName: { type: DataTypes.STRING, allowNull: false },
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    caughtAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

// ==========================================
// 2. SETUP DISCORD CLIENT & INTENTS
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences, // Wajib untuk hitung member online
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let wildPokemon = null; // Menyimpan Pokemon liar saat ini
const POKEMON_LIST = ['Pikachu', 'Charmander', 'Bulbasaur', 'Squirtle', 'Eevee', 'Mewtwo', 'Snorlax', 'Gengar', 'Lucario'];

// Mengambil ID Channel dari Environment Variables di Railway
const COUNTER_CHANNELS = {
    total: process.env.CHANNEL_TOTAL,
    bots: process.env.CHANNEL_BOTS,
    online: process.env.CHANNEL_ONLINE
};

// ==========================================
// 3. FUNGSI UPDATE COUNTER CHANNEL
// ==========================================
async function updateCounters(guild) {
    if (!guild) return;
    try {
        // Fetch semua member beserta status presence mereka
        const members = await guild.members.fetch({ withPresences: true });
        
        const totalCount = members.filter(m => !m.user.bot).size;
        const botCount = members.filter(m => m.user.bot).size;
        // Menghitung SEMUA yang online (Manusia + Bot) sesuai request kamu sebelumnya
        const onlineCount = members.filter(m => m.presence && m.presence.status !== 'offline').size;

        const totalChan = guild.channels.cache.get(COUNTER_CHANNELS.total);
        const botsChan = guild.channels.cache.get(COUNTER_CHANNELS.bots);
        const onlineChan = guild.channels.cache.get(COUNTER_CHANNELS.online);

        if (totalChan) await totalChan.setName(`👥 Total Member: ${totalCount}`).catch(() => {});
        if (botsChan) await botsChan.setName(`🤖 Bots: ${botCount}`).catch(() => {});
        if (onlineChan) await onlineChan.setName(`🟢 Online: ${onlineCount}`).catch(() => {});
    } catch (error) {
        console.error('Gagal mengupdate channel counter:', error);
    }
}

// ==========================================
// 4. EVENT: BOT READY (DAFTAR SLASH COMMANDS)
// ==========================================
client.once('ready', async () => {
    console.log(`[READY] Bot online sebagai ${client.user.tag}`);
    
    // Sinkronisasi Database SQLite
    await sequelize.sync();
    console.log('[DATABASE] SQLite terhubung dan berhasil disinkronkan!');

    // Inisialisasi/Daftarkan Perintah Slash
    const commands = [
        // Player Commands
        new SlashCommandBuilder().setName('pokemon').setDescription('Cek status Pokemon liar saat ini'),
        new SlashCommandBuilder().setName('catch').setDescription('Tangkap Pokemon liar yang sedang muncul').addStringOption(option => option.setName('nama').setDescription('Nama Pokemon dengan benar').setRequired(true)),
        new SlashCommandBuilder().setName('bag').setDescription('Lihat tas koleksi Pokemon kamu'),
        
        // Admin Commands (Hanya untuk yang punya izin MANAGE_GUILD / Admin)
        new SlashCommandBuilder()
            .setName('admin-spawn')
            .setDescription('👑 [ADMIN] Paksa munculkan Pokemon liar tertentu')
            .addStringOption(option => option.setName('nama').setDescription('Nama Pokemon yang mau dimunculkan').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
            
        new SlashCommandBuilder()
            .setName('admin-clear')
            .setDescription('👑 [ADMIN] Hapus semua isi tas Pokemon milik member tertentu')
            .addUserOption(option => option.setName('target').setDescription('Member yang mau dihapus tasnya').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ];

    const rest = new (require('@discordjs/rest').REST)({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('[SLASH] Memulai pendaftaran global slash commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[SLASH] Berhasil mendaftarkan semua slash commands!');
    } catch (error) {
        console.error('[SLASH ERROR]', error);
    }

    // Interval Update Counter (Tiap 10 menit agar aman dari Rate Limit Discord)
    setInterval(() => {
        client.guilds.cache.forEach(guild => updateCounters(guild));
    }, 10 * 60 * 1000);

    // Interval Otomatis Spawn Pokemon Liar (Tiap 5 menit)
    setInterval(() => {
        wildPokemon = POKEMON_LIST[Math.floor(Math.random() * POKEMON_LIST.length)];
        console.log(`[SPAWN] ${wildPokemon} muncul secara liar!`);
    }, 5 * 60 * 1000);
});

// Event pemicu update counter otomatis
client.on('guildMemberAdd', member => updateCounters(member.guild));
client.on('guildMemberRemove', member => updateCounters(member.guild));
client.on('presenceUpdate', (oldPres, newPres) => { if (newPres) updateCounters(newPres.guild); });

// ==========================================
// 5. HANDLING INTERACTION (SLASH COMMANDS)
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, user, options } = interaction;

    // --- COMMAND: /pokemon ---
    if (commandName === 'pokemon') {
        if (wildPokemon) {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Ada Pokemon Liar Muncul!')
                .setDescription(`Sesosok **${wildPokemon}** terlihat di semak-semak!\n\nGunakan perintah \`/catch nama: ${wildPokemon}\` sebelum diambil orang lain!`)
                .setColor('#FFCC00');
            return interaction.reply({ embeds: [embed] });
        }
        await interaction.reply('Sabar ya, saat ini belum ada Pokemon liar yang muncul di area ini.');
    }

    // --- COMMAND: /catch ---
    if (commandName === 'catch') {
        const guess = options.getString('nama');
        if (!wildPokemon) return interaction.reply('Aww, kamu telat! Tidak ada Pokemon liar di sekitar sini sekarang.');

        if (guess.toLowerCase() === wildPokemon.toLowerCase()) {
            const caught = wildPokemon;
            // Simpan data permanen ke SQLite
            await Inventory.create({ userId: user.id, pokemonName: caught });
            wildPokemon = null; // Reset spawn setelah berhasil ditangkap

            const embed = new EmbedBuilder()
                .setTitle('🎉 Berhasil Ditangkap!')
                .setDescription(`Selamat ${user}, kamu berhasil menangkap **${caught}**!\nPokemon telah disimpan dengan aman di dalam tas (\`/bag\`) kamu.`)
                .setColor('#4CAF50');
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply(`❌ Tebakanmu salah! Itu bukan **${guess}**. Coba perhatikan lagi namanya.`);
        }
    }

    // --- COMMAND: /bag ---
    if (commandName === 'bag') {
        const userBag = await Inventory.findAll({ where: { userId: user.id } });
        if (userBag.length === 0) {
            return interaction.reply('🎒 Tas kamu masih kosong melongpong! Tunggu Pokemon muncul dan gunakan perintah `/catch`.');
        }

        const listPokemon = userBag.map((p, index) => `${index + 1}. **${p.pokemonName}** *(Lv. ${p.level})*`).join('\n');
        const embed = new EmbedBuilder()
            .setTitle(`🎒 Kantong Pokemon ${user.username}`)
            .setDescription(`Berikut koleksi Pokemon milikmu:\n\n${listPokemon}`)
            .setColor('#2196F3')
            .setFooter({ text: `Total: ${userBag.length} Pokemon` });
            
        await interaction.reply({ embeds: [embed] });
    }

    // --- ADMIN COMMAND: /admin-spawn ---
    if (commandName === 'admin-spawn') {
        const targetPokemon = options.getString('nama');
        wildPokemon = targetPokemon;

        const embed = new EmbedBuilder()
            .setTitle('👑 Admin Command Executed')
            .setDescription(`Admin ${user} memaksa memunculkan **${targetPokemon}** ke server!\nAyo semuanya tangkap pakai \`/catch\`!`)
            .setColor('#FF3D00');
            
        await interaction.reply({ embeds: [embed] });
    }

    // --- ADMIN COMMAND: /admin-clear ---
    if (commandName === 'admin-clear') {
        const targetUser = options.getUser('target');
        
        // Hapus semua data berdasarkan ID user di SQLite
        const deletedRows = await Inventory.destroy({ where: { userId: targetUser.id } });
        
        await interaction.reply(`👑 **[ADMIN]** Berhasil mengosongkan tas milik ${targetUser}. Total \`${deletedRows}\` data Pokemon dihapus dari database.`);
    }
});

client.login(process.env.DISCORD_TOKEN);
