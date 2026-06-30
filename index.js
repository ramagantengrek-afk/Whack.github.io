const { Client, GatewayIntentBits, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { Sequelize, DataTypes, Op } = require('sequelize');
require('dotenv').config();

// ==========================================
// 1. DATABASE SETUP & ATTRIBUTES
// ==========================================
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

const Inventory = sequelize.define('Inventory', {
    userId: { type: DataTypes.STRING, allowNull: false },
    pokemonName: { type: DataTypes.STRING, allowNull: false },
    level: { type: DataTypes.INTEGER, defaultValue: 5 }, // Mulai dari level 5 seperti di game
    xp: { type: DataTypes.INTEGER, defaultValue: 0 }
});

// ==========================================
// 2. DATA POKEMON (STATS & TIPE ALA ANIME)
// ==========================================
const POKEMON_DB = {
    'Pikachu': { type: 'Electric', catchRate: 0.70, hp: 35, baseAtk: 55, color: '#FFCC00' },
    'Charmander': { type: 'Fire', catchRate: 0.60, hp: 39, baseAtk: 52, color: '#FF6600' },
    'Bulbasaur': { type: 'Grass', catchRate: 0.60, hp: 45, baseAtk: 49, color: '#33CC66' },
    'Squirtle': { type: 'Water', catchRate: 0.60, hp: 44, baseAtk: 48, color: '#3399FF' },
    'Eevee': { type: 'Normal', catchRate: 0.65, hp: 55, baseAtk: 55, color: '#C0A080' },
    'Snorlax': { type: 'Normal', catchRate: 0.30, hp: 160, baseAtk: 110, color: '#406060' },
    'Gengar': { type: 'Ghost', catchRate: 0.25, hp: 60, baseAtk: 65, color: '#663399' },
    'Mewtwo': { type: 'Psychic', catchRate: 0.10, hp: 106, baseAtk: 110, color: '#E0E0E0' }
};
const POKEMON_LIST = Object.keys(POKEMON_DB);

// Tabel Kelemahan Tipe (Super Effective = 1.5x Damage)
const TYPE_ADVANTAGES = {
    Fire: { Grass: 1.5, Water: 0.5 },
    Water: { Fire: 1.5, Grass: 0.5 },
    Grass: { Water: 1.5, Fire: 0.5 },
    Electric: { Water: 1.5, Grass: 1.0 }
};

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

let wildPokemon = null;

// ==========================================
// 3. REGISTRASI COMMANDS
// ==========================================
client.once('ready', async () => {
    console.log(`[READY] Bot anime Pokemon aktif: ${client.user.tag}`);
    await sequelize.sync();

    const commands = [
        new SlashCommandBuilder().setName('pokemon').setDescription('Cek status Pokemon liar saat ini'),
        new SlashCommandBuilder().setName('catch').setDescription('Lempar Pokéball untuk menangkap Pokemon liar!').addStringOption(option => option.setName('nama').setDescription('Nama Pokemon').setRequired(true)),
        new SlashCommandBuilder().setName('bag').setDescription('Lihat tas koleksi Pokemon kamu (Rahasia)'),
        new SlashCommandBuilder().setName('trade')
            .setDescription('Tukar Pokemon dengan trainer lain')
            .addUserOption(option => option.setName('target').setDescription('Trainer tujuan').setRequired(true))
            .addStringOption(option => option.setName('punya_kamu').setDescription('Pokemon yang kamu berikan').setRequired(true))
            .addStringOption(option => option.setName('punya_dia').setDescription('Pokemon yang kamu minta').setRequired(true)),
        new SlashCommandBuilder().setName('battle')
            .setDescription('Tantang Trainer lain untuk duel Pokemon turn-based!')
            .addUserOption(option => option.setName('lawan').setDescription('Trainer lawan').setRequired(true))
            .addStringOption(option => option.setName('pokemon_kamu').setDescription('Pokemon andalanmu').setRequired(true)),
        new SlashCommandBuilder().setName('admin-spawn')
            .setDescription('👑 [ADMIN] Paksa munculkan Pokemon liar tertentu')
            .addStringOption(option => option.setName('nama').setDescription('Nama pokemon').setRequired(true).setAutoComplete(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ];

    const rest = new (require('@discordjs/rest').REST)({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }

    // Spawn otomatis setiap 5 menit
    setInterval(() => {
        wildPokemon = POKEMON_LIST[Math.floor(Math.random() * POKEMON_LIST.length)];
        console.log(`[SPAWN ANIME] Berhasil memunculkan ${wildPokemon}`);
    }, 5 * 60 * 1000);
});

// Autocomplete Admin
client.on('interactionCreate', async interaction => {
    if (!interaction.isAutocomplete()) return;
    if (interaction.commandName === 'admin-spawn') {
        const focused = interaction.options.getFocused().toLowerCase();
        const filtered = POKEMON_LIST.filter(p => p.toLowerCase().includes(focused));
        await interaction.respond(filtered.slice(0, 25).map(p => ({ name: p, value: p })));
    }
});

// ==========================================
// 4. INTERACTION HANDLER (GAME LOGIC)
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, user, options } = interaction;

    // --- /pokemon ---
    if (commandName === 'pokemon') {
        if (!wildPokemon) return interaction.reply('Belum ada Pokemon liar yang terlihat di sekitar sini.');
        const pokeData = POKEMON_DB[wildPokemon];
        
        const embed = new EmbedBuilder()
            .setTitle(`❗ Pokemon Liar Muncul!`)
            .setDescription(`Seekor **${wildPokemon}** (Tipe: *${pokeData.type}*) meloncat dari semak-semak!\nTingkat kesulitan tangkap: **${((1 - pokeData.catchRate) * 100).toFixed(0)}%**`)
            .setColor(pokeData.color)
            .setFooter({ text: 'Ketik /catch untuk melempar Pokéball!' });
        await interaction.reply({ embeds: [embed] });
    }

    // --- /catch (DENGAN ARCADIA CATCH RATE ALA GAME) ---
    if (commandName === 'catch') {
        const guess = options.getString('nama');
        if (!wildPokemon) return interaction.reply('Yah, Pokemon liarnya sudah kabur duluan.');

        if (guess.toLowerCase() !== wildPokemon.toLowerCase()) {
            return interaction.reply(`❌ Salah nama! Itu bukan **${guess}**.`);
        }

        const pokeData = POKEMON_DB[wildPokemon];
        const randomChance = Math.random(); // Angka acak 0.0 sampai 1.0

        await interaction.reply(`🔴 *Syuttt... Jg... Jg...* Kamu melemparkan Pokéball ke arah **${wildPokemon}**!`);

        // Simulasi menunggu Pokéball bergetar (delay 2 detik)
        setTimeout(async () => {
            if (randomChance <= pokeData.catchRate) {
                // Berhasil Tangkap!
                await Inventory.create({ userId: user.id, pokemonName: wildPokemon });
                const successEmbed = new EmbedBuilder()
                    .setTitle('🎉 Gotcha!')
                    .setDescription(`**${wildPokemon}** berhasil ditangkap dan masuk Pokedex kamu! Data aman tersimpan di database.`)
                    .setColor('#4CAF50');
                await interaction.followUp({ embeds: [successEmbed] });
                wildPokemon = null; // Reset wild spawn
            } else {
                // Gagal Tangkap & Kabur
                const escapeChance = Math.random();
                if (escapeChance > 0.5) {
                    await interaction.followUp(`💨 Oh tidak! **${wildPokemon}** keluar dari Pokéball dan langsung kabur ke dalam hutan!`);
                    wildPokemon = null; 
                } else {
                    await interaction.followUp(`⚠️ Argh! **${wildPokemon}** berhasil keluar dari Pokéball! Coba lempar sekali lagi!`);
                }
            }
        }, 2000);
    }

    // --- /bag (PRIVASI) ---
    if (commandName === 'bag') {
        const bag = await Inventory.findAll({ where: { userId: user.id } });
        if (bag.length === 0) return interaction.reply({ content: 'Tas kamu kosong melongpong.', ephemeral: true });

        const list = bag.map((p, i) => `${i + 1}. **${p.pokemonName}** (Lv. ${p.level}) - *Tipe: ${POKEMON_DB[p.pokemonName]?.type || 'Normal'}*`).join('\n');
        const embed = new EmbedBuilder().setTitle(`🎒 Pokedex Pribadi Trainer ${user.username}`).setDescription(list).setColor('#2196F3');
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // --- /trade ---
    if (commandName === 'trade') {
        const target = options.getUser('target');
        const myPoke = options.getString('punya_kamu');
        const targetPoke = options.getString('punya_dia');

        if (target.id === user.id) return interaction.reply({ content: 'Gak bisa trade sama diri sendiri!', ephemeral: true });

        const p1 = await Inventory.findOne({ where: { userId: user.id, pokemonName: { [Op.iLike]: myPoke } } });
        const p2 = await Inventory.findOne({ where: { userId: target.id, pokemonName: { [Op.iLike]: targetPoke } } });

        if (!p1 || !p2) return interaction.reply({ content: 'Salah satu dari kalian tidak memiliki Pokemon yang disebutkan!', ephemeral: true });

        p1.userId = target.id; p2.userId = user.id;
        await p1.save(); await p2.save();

        await interaction.reply(`🔄 **Tukar Menukar Selesai!** ${user} memberikan **${myPoke}** kepada ${target} demi mendapatkan **${targetPoke}**!`);
    }

    // --- /battle (SISTEM ANIME TURN BASED DENGAN TYPE ADVANTAGE) ---
    if (commandName === 'battle') {
        const opponent = options.getUser('lawan');
        const p1Name = options.getString('pokemon_kamu');

        if (opponent.id === user.id) return interaction.reply({ content: 'Jangan lawan diri sendiri!', ephemeral: true });

        const p1 = await Inventory.findOne({ where: { userId: user.id, pokemonName: { [Op.iLike]: p1Name } } });
        const p2 = await Inventory.findOne({ where: { userId: opponent.id } }); // Ambil pokemon pertama lawan

        if (!p1) return interaction.reply({ content: `Kamu tidak punya **${p1Name}**!`, ephemeral: true });
        if (!p2) return interaction.reply({ content: `Lawanmu belum menangkap Pokemon apapun!`, ephemeral: true });

        const p1Data = POKEMON_DB[p1.pokemonName];
        const p2Data = POKEMON_DB[p2.pokemonName];

        // Hitung Base HP awal sesuai Level
        let h1 = p1Data.hp + (p1.level * 2);
        let h2 = p2Data.hp + (p2.level * 2);

        await interaction.reply(`⚔️ **Ditantang Duel!**\nTrainer **${user.username}** mengirim **${p1.pokemonName}** (Lv.${p1.level}) !!\nTrainer **${opponent.username}** menghadang dengan **${p2.pokemonName}** (Lv.${p2.level}) !!`);

        // Simulasi hitung putaran pertarungan (Turn) lewat text followUp
        setTimeout(async () => {
            // Cek keunggulan tipe elemen
            let multiplier1 = TYPE_ADVANTAGES[p1Data.type]?.[p2Data.type] || 1.0;
            let multiplier2 = TYPE_ADVANTAGES[p2Data.type]?.[p1Data.type] || 1.0;

            let dmg1 = Math.floor((p1Data.baseAtk + p1.level) * multiplier1 * 0.3);
            let dmg2 = Math.floor((p2Data.baseAtk + p2.level) * multiplier2 * 0.3);

            let logText = `**Ronde 1:**\n💥 *${p1.pokemonName}* meluncurkan serangan!`;
            if (multiplier1 > 1) logText += ` *(Serangan Super Efektif!)*`;
            logText += ` Memberikan **${dmg1} DMG** ke *${p2.pokemonName}*.\n`;

            logText += `💥 *${p2.pokemonName}* membalas balik!`;
            if (multiplier2 > 1) logText += ` *(Serangan Super Efektif!)*`;
            logText += ` Memberikan **${dmg2} DMG** ke *${p1.pokemonName}*.\n`;

            h2 -= dmg1; h1 -= dmg2;

            await interaction.followUp(logText);

            // Pengumuman Hasil Akhir (Ronde 2/Penentuan)
            setTimeout(async () => {
                if (h1 > h2) {
                    p1.level += 1; await p1.save();
                    await interaction.followUp(`🏆 **Pertandingan Selesai!** *${p2.pokemonName}* milik **${opponent.username}** pingsan!\n**${user.username} WIN!** *${p1.pokemonName}* kamu naik ke **Level ${p1.level}**!`);
                } else if (h2 > h1) {
                    p2.level += 1; await p2.save();
                    await interaction.followUp(`🏆 **Pertandingan Selesai!** *${p1.pokemonName}* milikmu pingsan!\n**${opponent.username} WIN!** *${p2.pokemonName}* milik lawan naik ke **Level ${p2.level}**!`);
                } else {
                    await interaction.followUp(`👔 Pertarungan yang sangat melelahkan! Kedua Pokemon sama-sama kelelahan dan hasilnya **SERI**!`);
                }
            }, 2500);

        }, 2500);
    }

    // --- admin-spawn ---
    if (commandName === 'admin-spawn') {
        const name = options.getString('nama');
        if (!POKEMON_DB[name]) return interaction.reply({ content: 'Nama Pokemon tidak terdaftar di database utama bot!', ephemeral: true });
        wildPokemon = name;
        await interaction.reply(`👑 **[ADMIN]** Memanggil **${name}** liar untuk muncul ke permukaan server!`);
    }
});

client.login(process.env.DISCORD_TOKEN);
