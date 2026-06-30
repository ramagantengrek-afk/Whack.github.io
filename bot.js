const { 
    Client, GatewayIntentBits, Routes, SlashCommandBuilder, 
    PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, 
    StringSelectMenuBuilder, ButtonBuilder, ButtonStyle 
} = require('discord.js');
const { Sequelize, DataTypes, Op } = require('sequelize');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// =========================================================================
// 🔴 CENTRAL WEB LOG & GLOBAL PROJECT STATE
// =========================================================================
const serverLogs = [];
let ACTIVE_EVENT = { name: "Normal Adventure", type: "NONE", multiplier: 1.0, endAt: null };

function logToWeb(message) {
    const time = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const formattedLog = `[${time}] ${message}`;
    console.log(formattedLog);
    serverLogs.unshift(formattedLog);
    if (serverLogs.length > 250) serverLogs.pop();
}

function checkActiveEvent() {
    if (ACTIVE_EVENT.endAt && Date.now() > ACTIVE_EVENT.endAt) {
        logToWeb(`[EVENT] Event "${ACTIVE_EVENT.name}" telah berakhir secara otomatis.`);
        ACTIVE_EVENT = { name: "Normal Adventure", type: "NONE", multiplier: 1.0, endAt: null };
    }
}

// =========================================================================
// 🛡️ ANTI-CHEAT: ADVANCED MEMORY LOCKING MECHANISM
// =========================================================================
const activeUserLocks = new Set();

function acquireLock(userId) {
    if (activeUserLocks.has(userId)) return false;
    activeUserLocks.add(userId);
    return true;
}

function releaseLock(userId) {
    activeUserLocks.delete(userId);
}

// =========================================================================
// ⚙️ CHANNELS & VOICE CONFIGURATION ENVIRONMENT
// =========================================================================
const CONFIG_SETUP = {
    SPAWN_CHANNEL_ID: process.env.SPAWN_CHANNEL_ID || 'ID_TEXT_CHANNEL_SPAWN',
    VOICE_COUNTER_CHANNEL_ID: process.env.VOICE_COUNTER_CHANNEL_ID || 'ID_VOICE_CHANNEL_COUNTER',
    SPAWN_INTERVAL: 20 * 60 * 1000 // ⏱️ TEPAT 20 MENIT
};

async function updateVoiceCounter(guild) {
    if (!CONFIG_SETUP.VOICE_COUNTER_CHANNEL_ID || CONFIG_SETUP.VOICE_COUNTER_CHANNEL_ID.includes('ID_VOICE_')) return;
    try {
        const channel = await guild.channels.fetch(CONFIG_SETUP.VOICE_COUNTER_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        let totalVoiceMembers = 0;
        guild.channels.cache.forEach(c => {
            if (c.isVoiceBased()) totalVoiceMembers += c.members.size;
        });

        const newName = `🎙️ Users Online: ${totalVoiceMembers}`;
        if (channel.name !== newName) {
            await channel.setName(newName);
            logToWeb(`[VOICE] Memperbarui jumlah counter channel menjadi: ${totalVoiceMembers}`);
        }
    } catch (err) {
        console.error("Gagal melakukan pembaruan nama Voice Counter:", err);
    }
}

// =========================================================================
// 📋 GAME CONSTANTS & DATABASE MAPS
// =========================================================================
const NATURES = {
    'Adamant': { buff: 'attack', nerf: 'spAtk', multiplier: 1.1 },
    'Modest': { buff: 'spAtk', nerf: 'attack', multiplier: 1.1 },
    'Timid': { buff: 'speed', nerf: 'attack', multiplier: 1.1 },
    'Jolly': { buff: 'speed', nerf: 'spAtk', multiplier: 1.1 },
    'Hardy': { buff: null, nerf: null, multiplier: 1.0 },
    'Bold': { buff: 'defense', nerf: 'attack', multiplier: 1.1 },
    'Calm': { buff: 'spDef', nerf: 'attack', multiplier: 1.1 }
};

const BALL_SETTINGS = {
    'pokeballs': { name: '🔴 Pokéball', rateBonus: 0.0, price: 200 },
    'greatballs': { name: '🔵 Great Ball', rateBonus: 0.15, price: 500 },
    'ultraballs': { name: '⚫ Ultra Ball', rateBonus: 0.30, price: 1200 },
    'masterballs': { name: '🟡 Master Ball', rateBonus: 1.0, price: 5000 }
}
    // =========================================================================
// 🐉 DATABASE STATS POKÉMON RESMI (GEN 1 - GEN 5 EXTENDED: +100 MONSTERS)
// =========================================================================
const POKEMON_DB = {
    // === GENERASI 1 (KANTO) ===
    'Bulbasaur': { type: 'Grass', hp: 45, attack: 49, defense: 49, speed: 45, catchRate: 0.55, evolvesTo: 'Ivysaur', canSpawnWild: true, moves: ['Tackle', 'Vine Whip'] },
    'Ivysaur': { type: 'Grass', hp: 60, attack: 62, defense: 63, speed: 60, catchRate: 0.0, evolvesTo: 'Venusaur', canSpawnWild: false, moves: ['Vine Whip', 'Razor Leaf'] },
    'Venusaur': { type: 'Grass', hp: 80, attack: 82, defense: 83, speed: 80, catchRate: 0.0, canSpawnWild: false, moves: ['Razor Leaf', 'Solar Beam'] },
    'Charmander': { type: 'Fire', hp: 39, attack: 52, defense: 43, speed: 65, catchRate: 0.55, evolvesTo: 'Charmeleon', canSpawnWild: true, moves: ['Scratch', 'Ember'] },
    'Charmeleon': { type: 'Fire', hp: 58, attack: 64, defense: 58, speed: 80, catchRate: 0.0, evolvesTo: 'Charizard', canSpawnWild: false, moves: ['Ember', 'Flamethrower'] },
    'Charizard': { type: 'Fire', hp: 78, attack: 84, defense: 78, speed: 100, catchRate: 0.0, canSpawnWild: false, moves: ['Flamethrower', 'Fire Blast'] },
    'Squirtle': { type: 'Water', hp: 44, attack: 48, defense: 65, speed: 43, catchRate: 0.55, evolvesTo: 'Wartortle', canSpawnWild: true, moves: ['Tackle', 'Water Gun'] },
    'Wartortle': { type: 'Water', hp: 59, attack: 63, defense: 80, speed: 58, catchRate: 0.0, evolvesTo: 'Blastoise', canSpawnWild: false, moves: ['Water Gun', 'Hydro Pump'] },
    'Blastoise': { type: 'Water', hp: 79, attack: 83, defense: 100, speed: 78, catchRate: 0.0, canSpawnWild: false, moves: ['Hydro Pump', 'Skull Bash'] },
    'Pikachu': { type: 'Electric', hp: 35, attack: 55, defense: 40, speed: 90, catchRate: 0.45, evolvesTo: 'Raichu', canSpawnWild: true, moves: ['Quick Attack', 'Thunder Shock'] },
    'Raichu': { type: 'Electric', hp: 60, attack: 90, defense: 55, speed: 110, catchRate: 0.0, canSpawnWild: false, moves: ['Thunder Shock', 'Thunderbolt'] },
    'Eevee': { type: 'Normal', hp: 55, attack: 55, defense: 50, speed: 55, catchRate: 0.50, evolvesTo: 'Vaporeon', canSpawnWild: true, moves: ['Tackle', 'Swift'] },
    'Vaporeon': { type: 'Water', hp: 130, attack: 65, defense: 60, speed: 65, catchRate: 0.0, canSpawnWild: false, moves: ['Water Gun', 'Hydro Pump'] },
    'Pidgey': { type: 'Flying', hp: 40, attack: 45, defense: 40, speed: 56, catchRate: 0.70, evolvesTo: 'Pidgeotto', canSpawnWild: true, moves: ['Tackle', 'Gust'] },
    'Pidgeotto': { type: 'Flying', hp: 63, attack: 60, defense: 55, speed: 71, catchRate: 0.0, canSpawnWild: false, moves: ['Gust', 'Wing Attack'] },
    'Gastly': { type: 'Ghost', hp: 30, attack: 35, defense: 30, speed: 80, catchRate: 0.60, evolvesTo: 'Haunter', canSpawnWild: true, moves: ['Lick', 'Shadow Ball'] },
    'Haunter': { type: 'Ghost', hp: 45, attack: 50, defense: 45, speed: 95, catchRate: 0.0, canSpawnWild: false, moves: ['Shadow Ball', 'Dark Pulse'] },
    'Machop': { type: 'Fighting', hp: 70, attack: 80, defense: 50, speed: 35, catchRate: 0.50, evolvesTo: 'Machoke', canSpawnWild: true, moves: ['Pound', 'Karate Chop'] },
    'Machoke': { type: 'Fighting', hp: 80, attack: 100, defense: 70, speed: 45, catchRate: 0.0, canSpawnWild: false, moves: ['Karate Chop', 'Cross Chop'] },
    'Caterpie': { type: 'Bug', hp: 45, attack: 30, defense: 35, speed: 45, catchRate: 0.75, evolvesTo: 'Metapod', canSpawnWild: true, moves: ['Tackle'] },
    'Metapod': { type: 'Bug', hp: 50, attack: 20, defense: 55, speed: 30, catchRate: 0.0, evolvesTo: 'Butterfree', canSpawnWild: false, moves: ['Tackle'] },
    'Butterfree': { type: 'Bug', hp: 60, attack: 45, defense: 50, speed: 70, catchRate: 0.0, canSpawnWild: false, moves: ['Gust', 'Psybeam'] },
    'Rattata': { type: 'Normal', hp: 30, attack: 56, defense: 35, speed: 72, catchRate: 0.75, evolvesTo: 'Raticate', canSpawnWild: true, moves: ['Tackle', 'Quick Attack'] },
    'Raticate': { type: 'Normal', hp: 55, attack: 81, defense: 60, speed: 97, catchRate: 0.0, canSpawnWild: false, moves: ['Quick Attack', 'Hyper Fang'] },
    'Ekans': { type: 'Poison', hp: 35, attack: 60, defense: 44, speed: 55, catchRate: 0.65, evolvesTo: 'Arbok', canSpawnWild: true, moves: ['Pound', 'Acid'] },
    'Arbok': { type: 'Poison', hp: 60, attack: 95, defense: 69, speed: 80, catchRate: 0.0, canSpawnWild: false, moves: ['Acid', 'Gunk Shot'] },
    'Sandshrew': { type: 'Ground', hp: 50, attack: 75, defense: 85, speed: 40, catchRate: 0.60, evolvesTo: 'Sandslash', canSpawnWild: true, moves: ['Scratch', 'Dig'] },
    'Sandslash': { type: 'Ground', hp: 75, attack: 100, defense: 110, speed: 65, catchRate: 0.0, canSpawnWild: false, moves: ['Dig', 'Earthquake'] },
    'Zubat': { type: 'Flying', hp: 40, attack: 45, defense: 35, speed: 55, catchRate: 0.70, evolvesTo: 'Golbat', canSpawnWild: true, moves: ['Absorb', 'Air Cutter'] },
    'Golbat': { type: 'Flying', hp: 75, attack: 80, defense: 70, speed: 90, catchRate: 0.0, canSpawnWild: false, moves: ['Air Cutter', 'Air Slash'] },
    'Growlithe': { type: 'Fire', hp: 55, attack: 70, defense: 45, speed: 60, catchRate: 0.50, evolvesTo: 'Arcanine', canSpawnWild: true, moves: ['Ember', 'Flame Wheel'] },
    'Arcanine': { type: 'Fire', hp: 90, attack: 110, defense: 80, speed: 95, catchRate: 0.0, canSpawnWild: false, moves: ['Flame Wheel', 'Fire Blast'] },
    'Geodude': { type: 'Rock', hp: 40, attack: 80, defense: 100, speed: 20, catchRate: 0.60, evolvesTo: 'Graveler', canSpawnWild: true, moves: ['Tackle', 'Rock Throw'] },
    'Graveler': { type: 'Rock', hp: 55, attack: 95, defense: 115, speed: 35, catchRate: 0.0, evolvesTo: 'Golem', canSpawnWild: false, moves: ['Rock Throw', 'Stone Edge'] },
    'Golem': { type: 'Rock', hp: 80, attack: 120, defense: 130, speed: 45, catchRate: 0.0, canSpawnWild: false, moves: ['Stone Edge', 'Earthquake'] },

    // === GENERASI 2 (JOHTO) ===
    'Chikorita': { type: 'Grass', hp: 45, attack: 49, defense: 65, speed: 45, catchRate: 0.55, evolvesTo: 'Bayleef', canSpawnWild: true, moves: ['Tackle', 'Razor Leaf'] },
    'Bayleef': { type: 'Grass', hp: 60, attack: 62, defense: 80, speed: 60, catchRate: 0.0, evolvesTo: 'Meganium', canSpawnWild: false, moves: ['Razor Leaf', 'Solar Beam'] },
    'Meganium': { type: 'Grass', hp: 80, attack: 82, defense: 100, speed: 80, catchRate: 0.0, canSpawnWild: false, moves: ['Solar Beam', 'Body Slam'] },
    'Cyndaquil': { type: 'Fire', hp: 39, attack: 52, defense: 43, speed: 65, catchRate: 0.55, evolvesTo: 'Quilava', canSpawnWild: true, moves: ['Tackle', 'Ember'] },
    'Quilava': { type: 'Fire', hp: 58, attack: 64, defense: 58, speed: 80, catchRate: 0.0, evolvesTo: 'Typhlosion', canSpawnWild: false, moves: ['Ember', 'Flamethrower'] },
    'Typhlosion': { type: 'Fire', hp: 78, attack: 84, defense: 78, speed: 100, catchRate: 0.0, canSpawnWild: false, moves: ['Flamethrower', 'Eruption'] },
    'Totodile': { type: 'Water', hp: 50, attack: 65, defense: 64, speed: 43, catchRate: 0.55, evolvesTo: 'Croconaw', canSpawnWild: true, moves: ['Scratch', 'Water Gun'] },
    'Croconaw': { type: 'Water', hp: 65, attack: 80, defense: 80, speed: 58, catchRate: 0.0, evolvesTo: 'Feraligatr', canSpawnWild: false, moves: ['Water Gun', 'Hydro Pump'] },
    'Feraligatr': { type: 'Water', hp: 85, attack: 105, defense: 100, speed: 78, catchRate: 0.0, canSpawnWild: false, moves: ['Hydro Pump', 'Crunch'] },
    'Sentret': { type: 'Normal', hp: 35, attack: 46, defense: 34, speed: 20, catchRate: 0.75, evolvesTo: 'Furret', canSpawnWild: true, moves: ['Tackle', 'Quick Attack'] },
    'Furret': { type: 'Normal', hp: 85, attack: 76, defense: 64, speed: 90, catchRate: 0.0, canSpawnWild: false, moves: ['Quick Attack', 'Slam'] },
    'Hoothoot': { type: 'Flying', hp: 60, attack: 30, defense: 30, speed: 50, catchRate: 0.70, evolvesTo: 'Noctowl', canSpawnWild: true, moves: ['Tackle', 'Gust'] },
    'Noctowl': { type: 'Flying', hp: 100, attack: 50, defense: 50, speed: 70, catchRate: 0.0, canSpawnWild: false, moves: ['Gust', 'Air Slash'] },
    'Ledyba': { type: 'Bug', hp: 40, attack: 20, defense: 30, speed: 55, catchRate: 0.75, evolvesTo: 'Ledian', canSpawnWild: true, moves: ['Tackle', 'Swift'] },
    'Ledian': { type: 'Bug', hp: 55, attack: 35, defense: 50, speed: 85, catchRate: 0.0, canSpawnWild: false, moves: ['Swift', 'Bug Buzz'] },
    'Spinarak': { type: 'Bug', hp: 40, attack: 60, defense: 40, speed: 30, catchRate: 0.75, evolvesTo: 'Ariados', canSpawnWild: true, moves: ['Poison Sting', 'Leech Life'] },
    'Ariados': { type: 'Bug', hp: 70, attack: 90, defense: 70, speed: 40, catchRate: 0.0, canSpawnWild: false, moves: ['Leech Life', 'Bug Buzz'] },
    'Mareep': { type: 'Electric', hp: 55, attack: 40, defense: 40, speed: 35, catchRate: 0.60, evolvesTo: 'Flaaffy', canSpawnWild: true, moves: ['Tackle', 'Thunder Shock'] },
    'Flaaffy': { type: 'Electric', hp: 70, attack: 55, defense: 55, speed: 45, catchRate: 0.0, evolvesTo: 'Ampharos', canSpawnWild: false, moves: ['Thunder Shock', 'Thunderbolt'] },
    'Ampharos': { type: 'Electric', hp: 90, attack: 75, defense: 85, speed: 55, catchRate: 0.0, canSpawnWild: false, moves: ['Thunderbolt', 'Thunder'] },
    'Marill': { type: 'Water', hp: 70, attack: 20, defense: 50, speed: 40, catchRate: 0.65, evolvesTo: 'Azumarill', canSpawnWild: true, moves: ['Tackle', 'Water Gun'] },
    'Azumarill': { type: 'Water', hp: 100, attack: 50, defense: 80, speed: 50, catchRate: 0.0, canSpawnWild: false, moves: ['Water Gun', 'Hydro Pump'] },

    // === GENERASI 3 (HOENN) ===
    'Treecko': { type: 'Grass', hp: 40, attack: 45, defense: 35, speed: 70, catchRate: 0.55, evolvesTo: 'Grovyle', canSpawnWild: true, moves: ['Pound', 'Absorb'] },
    'Grovyle': { type: 'Grass', hp: 50, attack: 65, defense: 45, speed: 95, catchRate: 0.0, evolvesTo: 'Sceptile', canSpawnWild: false, moves: ['Absorb', 'Leaf Blade'] },
    'Sceptile': { type: 'Grass', hp: 70, attack: 85, defense: 65, speed: 120, catchRate: 0.0, canSpawnWild: false, moves: ['Leaf Blade', 'Solar Beam'] },
    'Torchic': { type: 'Fire', hp: 45, attack: 60, defense: 40, speed: 45, catchRate: 0.55, evolvesTo: 'Combusken', canSpawnWild: true, moves: ['Scratch', 'Ember'] },
    'Combusken': { type: 'Fire', hp: 60, attack: 85, defense: 60, speed: 55, catchRate: 0.0, evolvesTo: 'Blaziken', canSpawnWild: false, moves: ['Ember', 'Flame Charge'] },
    'Blaziken': { type: 'Fire', hp: 80, attack: 120, defense: 70, speed: 80, catchRate: 0.0, canSpawnWild: false, moves: ['Flame Charge', 'Flare Blitz'] },
    'Mudkip': { type: 'Water', hp: 50, attack: 70, defense: 50, speed: 40, catchRate: 0.55, evolvesTo: 'Marshtomp', canSpawnWild: true, moves: ['Tackle', 'Water Gun'] },
    'Marshtomp': { type: 'Water', hp: 70, attack: 85, defense: 70, speed: 50, catchRate: 0.0, evolvesTo: 'Swampert', canSpawnWild: false, moves: ['Water Gun', 'Mud Shot'] },
    'Swampert': { type: 'Water', hp: 100, attack: 110, defense: 90, speed: 60, catchRate: 0.0, canSpawnWild: false, moves: ['Mud Shot', 'Hydro Pump'] },
    'Poochyena': { type: 'Dark', hp: 35, attack: 55, defense: 35, speed: 35, catchRate: 0.75, evolvesTo: 'Mightyena', canSpawnWild: true, moves: ['Tackle', 'Bite'] },
    'Mightyena': { type: 'Dark', hp: 70, attack: 90, defense: 70, speed: 70, catchRate: 0.0, canSpawnWild: false, moves: ['Bite', 'Crunch'] },
    'Zigzagoon': { type: 'Normal', hp: 38, attack: 30, defense: 41, speed: 60, catchRate: 0.75, evolvesTo: 'Linoone', canSpawnWild: true, moves: ['Tackle', 'Headbutt'] },
    'Linoone': { type: 'Normal', hp: 78, attack: 70, defense: 61, speed: 100, catchRate: 0.0, canSpawnWild: false, moves: ['Headbutt', 'Slash'] },
    'Wurmple': { type: 'Bug', hp: 45, attack: 45, defense: 35, speed: 20, catchRate: 0.75, evolvesTo: 'Silcoon', canSpawnWild: true, moves: ['Tackle'] },
    'Silcoon': { type: 'Bug', hp: 50, attack: 35, defense: 55, speed: 15, catchRate: 0.0, evolvesTo: 'Beautifly', canSpawnWild: false, moves: ['Tackle'] },
    'Beautifly': { type: 'Bug', hp: 60, attack: 70, defense: 50, speed: 65, catchRate: 0.0, canSpawnWild: false, moves: ['Gust', 'Bug Buzz'] },
    'Lotad': { type: 'Water', hp: 40, attack: 30, defense: 30, speed: 30, catchRate: 0.70, evolvesTo: 'Lombre', canSpawnWild: true, moves: ['Astonish', 'Water Gun'] },
    'Lombre': { type: 'Water', hp: 60, attack: 50, defense: 50, speed: 50, catchRate: 0.0, evolvesTo: 'Ludicolo', canSpawnWild: false, moves: ['Water Gun', 'Energy Ball'] },
    'Ludicolo': { type: 'Water', hp: 80, attack: 70, defense: 70, speed: 70, catchRate: 0.0, canSpawnWild: false, moves: ['Energy Ball', 'Hydro Pump'] },
    'Seedot': { type: 'Grass', hp: 40, attack: 40, defense: 50, speed: 30, catchRate: 0.70, evolvesTo: 'Nuzleaf', canSpawnWild: true, moves: ['Tackle', 'Razor Leaf'] },
    'Nuzleaf': { type: 'Grass', hp: 70, attack: 70, defense: 40, speed: 60, catchRate: 0.0, evolvesTo: 'Shiftry', canSpawnWild: false, moves: ['Razor Leaf', 'Extrasensory'] },
    'Shiftry': { type: 'Grass', hp: 90, attack: 100, defense: 60, speed: 80, catchRate: 0.0, canSpawnWild: false, moves: ['Extrasensory', 'Leaf Storm'] },
    'Ralts': { type: 'Psychic', hp: 28, attack: 25, defense: 25, speed: 40, catchRate: 0.60, evolvesTo: 'Kirlia', canSpawnWild: true, moves: ['Pound', 'Confusion'] },
    'Kirlia': { type: 'Psychic', hp: 38, attack: 35, defense: 35, speed: 50, catchRate: 0.0, evolvesTo: 'Gardevoir', canSpawnWild: false, moves: ['Confusion', 'Psychic'] },
    'Gardevoir': { type: 'Psychic', hp: 68, attack: 65, defense: 65, speed: 80, catchRate: 0.0, canSpawnWild: false, moves: ['Psychic', 'Moonblast'] },

    // === GENERASI 4 (SINNOH) ===
    'Turtwig': { type: 'Grass', hp: 55, attack: 68, defense: 64, speed: 31, catchRate: 0.55, evolvesTo: 'Grotle', canSpawnWild: true, moves: ['Tackle', 'Absorb'] },
    'Grotle': { type: 'Grass', hp: 75, attack: 89, defense: 85, speed: 36, catchRate: 0.0, evolvesTo: 'Torterra', canSpawnWild: false, moves: ['Absorb', 'Razor Leaf'] },
    'Torterra': { type: 'Grass', hp: 95, attack: 109, defense: 105, speed: 56, catchRate: 0.0, canSpawnWild: false, moves: ['Razor Leaf', 'Earthquake'] },
    'Chimchar': { type: 'Fire', hp: 44, attack: 58, defense: 44, speed: 61, catchRate: 0.55, evolvesTo: 'Monferno', canSpawnWild: true, moves: ['Scratch', 'Ember'] },
    'Monferno': { type: 'Fire', hp: 64, attack: 78, defense: 52, speed: 81, catchRate: 0.0, evolvesTo: 'Infernape', canSpawnWild: false, moves: ['Ember', 'Flame Wheel'] },
    'Infernape': { type: 'Fire', hp: 76, attack: 104, defense: 71, speed: 108, catchRate: 0.0, canSpawnWild: false, moves: ['Flame Wheel', 'Flare Blitz'] },
    'Piplup': { type: 'Water', hp: 53, attack: 51, defense: 53, speed: 40, catchRate: 0.55, evolvesTo: 'Prinplup', canSpawnWild: true, moves: ['Pound', 'Water Gun'] },
    'Prinplup': { type: 'Water', hp: 64, attack: 66, defense: 68, speed: 50, catchRate: 0.0, evolvesTo: 'Empoleon', canSpawnWild: false, moves: ['Water Gun', 'Bubble Beam'] },
    'Empoleon': { type: 'Water', hp: 84, attack: 86, defense: 88, speed: 60, catchRate: 0.0, canSpawnWild: false, moves: ['Bubble Beam', 'Hydro Pump'] },
    'Starly': { type: 'Flying', hp: 40, attack: 55, defense: 30, speed: 60, catchRate: 0.75, evolvesTo: 'Staravia', canSpawnWild: true, moves: ['Tackle', 'Wing Attack'] },
    'Staravia': { type: 'Flying', hp: 55, attack: 75, defense: 50, speed: 80, catchRate: 0.0, evolvesTo: 'Staraptor', canSpawnWild: false, moves: ['Wing Attack', 'Fly'] },
    'Staraptor': { type: 'Flying', hp: 85, attack: 120, defense: 70, speed: 100, catchRate: 0.0, canSpawnWild: false, moves: ['Fly', 'Brave Bird'] },
    'Bidoof': { type: 'Normal', hp: 59, attack: 45, defense: 40, speed: 31, catchRate: 0.80, evolvesTo: 'Bibarel', canSpawnWild: true, moves: ['Tackle', 'Headbutt'] },
    'Bibarel': { type: 'Normal', hp: 79, attack: 85, defense: 60, speed: 71, catchRate: 0.0, canSpawnWild: false, moves: ['Headbutt', 'Take Down'] },
    'Shinx': { type: 'Electric', hp: 45, attack: 65, defense: 34, speed: 45, catchRate: 0.65, evolvesTo: 'Luxio', canSpawnWild: true, moves: ['Tackle', 'Spark'] },
    'Luxio': { type: 'Electric', hp: 60, attack: 85, defense: 49, speed: 60, catchRate: 0.0, evolvesTo: 'Luxray', canSpawnWild: false, moves: ['Spark', 'Thunder Fang'] },
    'Luxray': { type: 'Electric', hp: 80, attack: 120, defense: 79, speed: 70, catchRate: 0.0, canSpawnWild: false, moves: ['Thunder Fang', 'Thunderbolt'] },
    'Cranidos': { type: 'Rock', hp: 67, attack: 125, defense: 40, speed: 58, catchRate: 0.50, evolvesTo: 'Rampardos', canSpawnWild: true, moves: ['Headbutt', 'Rock Throw'] },
    'Rampardos': { type: 'Rock', hp: 97, attack: 165, defense: 60, speed: 58, catchRate: 0.0, canSpawnWild: false, moves: ['Rock Throw', 'Stone Edge'] },
    'Shieldon': { type: 'Rock', hp: 30, attack: 42, defense: 118, speed: 30, catchRate: 0.50, evolvesTo: 'Bastiodon', canSpawnWild: true, moves: ['Tackle', 'Iron Defense'] },
    'Bastiodon': { type: 'Rock', hp: 60, attack: 52, defense: 168, speed: 30, catchRate: 0.0, canSpawnWild: false, moves: ['Iron Defense', 'Iron Head'] },

    // === GENERASI 5 (UNOVA) ===
    'Snivy': { type: 'Grass', hp: 45, attack: 45, defense: 55, speed: 63, catchRate: 0.55, evolvesTo: 'Servine', canSpawnWild: true, moves: ['Tackle', 'Vine Whip'] },
    'Servine': { type: 'Grass', hp: 60, attack: 60, defense: 75, speed: 83, catchRate: 0.0, evolvesTo: 'Serperior', canSpawnWild: false, moves: ['Vine Whip', 'Leaf Blade'] },
    'Serperior': { type: 'Grass', hp: 75, attack: 75, defense: 95, speed: 113, catchRate: 0.0, canSpawnWild: false, moves: ['Leaf Blade', 'Leaf Storm'] },
    'Tepig': { type: 'Fire', hp: 65, attack: 63, defense: 45, speed: 45, catchRate: 0.55, evolvesTo: 'Pignite', canSpawnWild: true, moves: ['Tackle', 'Ember'] },
    'Pignite': { type: 'Fire', hp: 90, attack: 93, defense: 55, speed: 55, catchRate: 0.0, evolvesTo: 'Emboar', canSpawnWild: false, moves: ['Ember', 'Flame Charge'] },
    'Emboar': { type: 'Fire', hp: 110, attack: 123, defense: 65, speed: 65, catchRate: 0.0, canSpawnWild: false, moves: ['Flame Charge', 'Flare Blitz'] },
    'Oshawott': { type: 'Water', hp: 55, attack: 55, defense: 45, speed: 45, catchRate: 0.55, evolvesTo: 'Dewott', canSpawnWild: true, moves: ['Tackle', 'Water Gun'] },
    'Dewott': { type: 'Water', hp: 75, attack: 75, defense: 60, speed: 60, catchRate: 0.0, evolvesTo: 'Samurott', canSpawnWild: false, moves: ['Water Gun', 'Razor Shell'] },
    'Samurott': { type: 'Water', hp: 95, attack: 100, defense: 85, speed: 70, catchRate: 0.0, canSpawnWild: false, moves: ['Razor Shell', 'Hydro Pump'] },
    'Patrat': { type: 'Normal', hp: 45, attack: 55, defense: 39, speed: 42, catchRate: 0.75, evolvesTo: 'Watchog', canSpawnWild: true, moves: ['Tackle', 'Bite'] },
    'Watchog': { type: 'Normal', hp: 60, attack: 85, defense: 69, speed: 77, catchRate: 0.0, canSpawnWild: false, moves: ['Bite', 'Slam'] },
    'Lillipup': { type: 'Normal', hp: 45, attack: 60, defense: 45, speed: 55, catchRate: 0.70, evolvesTo: 'Herdier', canSpawnWild: true, moves: ['Tackle', 'Bite'] },
    'Herdier': { type: 'Normal', hp: 65, attack: 80, defense: 65, speed: 60, catchRate: 0.0, evolvesTo: 'Stoutland', canSpawnWild: false, moves: ['Bite', 'Take Down'] },
    'Stoutland': { type: 'Normal', hp: 85, attack: 110, defense: 90, speed: 80, catchRate: 0.0, canSpawnWild: false, moves: ['Take Down', 'Giga Impact'] },
    'Purrloin': { type: 'Dark', hp: 41, attack: 50, defense: 37, speed: 66, catchRate: 0.70, evolvesTo: 'Liepard', canSpawnWild: true, moves: ['Scratch', 'Assurance'] },
    'Liepard': { type: 'Dark', hp: 64, attack: 88, defense: 50, speed: 106, catchRate: 0.0, canSpawnWild: false, moves: ['Assurance', 'Night Slash'] },
    'Roggenrola': { type: 'Rock', hp: 55, attack: 75, defense: 85, speed: 15, catchRate: 0.65, evolvesTo: 'Boldore', canSpawnWild: true, moves: ['Tackle', 'Rock Throw'] },
    'Boldore': { type: 'Rock', hp: 70, attack: 105, defense: 105, speed: 20, catchRate: 0.0, evolvesTo: 'Gigalith', canSpawnWild: false, moves: ['Rock Throw', 'Rock Slide'] },
    'Gigalith': { type: 'Rock', hp: 85, attack: 135, defense: 130, speed: 25, catchRate: 0.0, canSpawnWild: false, moves: ['Rock Slide', 'Stone Edge'] }
};

// Tambahkan baris ini di dalam objek MOVE_DATA lama kamu:
const MOVE_DATA = {
    // ... data lama kamu ...
    'Acid': { power: 40, type: 'Poison' },
    'Gunk Shot': { power: 120, type: 'Poison' },
    'Dig': { power: 80, type: 'Ground' },
    'Earthquake': { power: 100, type: 'Ground' },
    'Absorb': { power: 20, type: 'Grass' },
    'Air Cutter': { power: 60, type: 'Flying' },
    'Air Slash': { power: 75, type: 'Flying' },
    'Flame Wheel': { power: 60, type: 'Fire' },
    'Rock Throw': { power: 50, type: 'Rock' },
    'Stone Edge': { power: 100, type: 'Rock' },
    'Body Slam': { power: 85, type: 'Normal' },
    'Eruption': { power: 150, type: 'Fire' },
    'Crunch': { power: 80, type: 'Dark' },
    'Slam': { power: 80, type: 'Normal' },
    'Bug Buzz': { power: 90, type: 'Bug' },
    'Poison Sting': { power: 15, type: 'Poison' },
    'Leech Life': { power: 80, type: 'Bug' },
    'Thunder': { power: 110, type: 'Electric' },
    'Leaf Blade': { power: 90, type: 'Grass' },
    'Flame Charge': { power: 50, type: 'Fire' },
    'Flare Blitz': { power: 120, type: 'Fire' },
    'Mud Shot': { power: 55, type: 'Ground' },
    'Bite': { power: 60, type: 'Dark' },
    'Headbutt': { power: 70, type: 'Normal' },
    'Energy Ball': { power: 90, type: 'Grass' },
    'Extrasensory': { power: 80, type: 'Psychic' },
    'Leaf Storm': { power: 130, type: 'Grass' },
    'Confusion': { power: 50, type: 'Psychic' },
    'Psychic': { power: 90, type: 'Psychic' },
    'Moonblast': { power: 95, type: 'Fairy' },
    'Bubble Beam': { power: 65, type: 'Water' },
    'Fly': { power: 90, type: 'Flying' },
    'Brave Bird': { power: 120, type: 'Flying' },
    'Take Down': { power: 90, type: 'Normal' },
    'Spark': { power: 65, type: 'Electric' },
    'Thunder Fang': { power: 65, type: 'Electric' },
    'Iron Defense': { power: 0, type: 'Steel' },
    'Iron Head': { power: 80, type: 'Steel' },
    'Razor Shell': { power: 75, type: 'Water' },
    'Giga Impact': { power: 150, type: 'Normal' },
    'Assurance': { power: 60, type: 'Dark' },
    'Night Slash': { power: 70, type: 'Dark' },
    'Rock Slide': { power: 75, type: 'Rock' }
};

const WILD_SPAWN_LIST = Object.keys(POKEMON_DB).filter(name => POKEMON_DB[name].canSpawnWild === true);

// =========================================================================
// 💾 DATABASE MODEL STRUCTURING (SEQUELIZE POSTGRES OR SQLITE)
// =========================================================================
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres', logging: false,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

const Profile = sequelize.define('Profile', {
    userId: { type: DataTypes.STRING, allowNull: false, unique: true },
    coins: { type: DataTypes.INTEGER, defaultValue: 1000 },
    pokeballs: { type: DataTypes.INTEGER, defaultValue: 20 },
    greatballs: { type: DataTypes.INTEGER, defaultValue: 10 },
    ultraballs: { type: DataTypes.INTEGER, defaultValue: 3 },
    masterballs: { type: DataTypes.INTEGER, defaultValue: 0 },
    lastDailyClaim: { type: DataTypes.DATE, defaultValue: new Date(0) }
});

const Inventory = sequelize.define('Inventory', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    pokemonName: { type: DataTypes.STRING, allowNull: false },
    level: { type: DataTypes.INTEGER, defaultValue: 5 },
    xp: { type: DataTypes.INTEGER, defaultValue: 0 },
    nature: { type: DataTypes.STRING, defaultValue: 'Hardy' },
    isShiny: { type: DataTypes.BOOLEAN, defaultValue: false },
    // 🧬 DATA STATS PERMANEN IV (INDIVIDUAL VALUES) ACKAN 0-31
    ivHp: { type: DataTypes.INTEGER, defaultValue: 15 },
    ivAttack: { type: DataTypes.INTEGER, defaultValue: 15 },
    ivDefense: { type: DataTypes.INTEGER, defaultValue: 15 },
    ivSpeed: { type: DataTypes.INTEGER, defaultValue: 15 }
});

// =========================================================================
// 🧮 STATS GENERATOR & ADVANCED FORMULA CALCULATOR
// =========================================================================
function getPokemonStats(pk) {
    const base = POKEMON_DB[pk.pokemonName] || { hp: 50, attack: 50, defense: 50, speed: 50 };
    const nature = NATURES[pk.nature] || { buff: null, nerf: null, multiplier: 1.0 };
    
    // Formula Akurat Berdasarkan Algoritma Game Pokémon Core Series
    let calculatedHp = Math.floor(((base.hp * 2 + pk.ivHp) * pk.level) / 100) + pk.level + 10;
    let calculatedAtk = Math.floor(((base.attack * 2 + pk.ivAttack) * pk.level) / 100) + 5;
    let calculatedDef = Math.floor(((base.defense * 2 + pk.ivDefense) * pk.level) / 100) + 5;
    let calculatedSpd = Math.floor(((base.speed * 2 + pk.ivSpeed) * pk.level) / 100) + 5;

    if (nature.buff === 'attack') calculatedAtk = Math.floor(calculatedAtk * nature.multiplier);
    if (nature.buff === 'defense') calculatedDef = Math.floor(calculatedDef * nature.multiplier);
    if (nature.buff === 'speed') calculatedSpd = Math.floor(calculatedSpd * nature.multiplier);
    
    if (nature.nerf === 'attack') calculatedAtk = Math.floor(calculatedAtk * 0.9);
    if (nature.nerf === 'defense') calculatedDef = Math.floor(calculatedDef * 0.9);
    if (nature.nerf === 'speed') calculatedSpd = Math.floor(calculatedSpd * 0.9);

    return { maxHp: calculatedHp, attack: calculatedAtk, defense: calculatedDef, speed: calculatedSpd };
}

function getTypeEffectiveness(atkType, defType) {
    if (!atkType || !defType) return 1.0;
    const chart = {
        'Fire': { 'Grass': 2.0, 'Water': 0.5, 'Fire': 0.5 },
        'Water': { 'Fire': 2.0, 'Grass': 0.5, 'Water': 0.5 },
        'Grass': { 'Water': 2.0, 'Fire': 0.5, 'Grass': 0.5 },
        'Electric': { 'Water': 2.0, 'Grass': 0.5 },
        'Ghost': { 'Ghost': 2.0, 'Normal': 0.0 },
        'Fighting': { 'Normal': 2.0, 'Ghost': 0.0 }
    };
    return chart[atkType]?.[defType] !== undefined ? chart[atkType][defType] : 1.0;
}

// =========================================================================
// 🚀 BOT INITIALIZATION & ENGINE DEPLOYMENT
// =========================================================================
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates] 
});

let wildPokemon = null;

client.once('ready', async () => {
    logToWeb(`[SYS] Menghubungkan Engine Inti v4 Berhasil.`);
    await sequelize.sync();
    
    client.guilds.cache.forEach(guild => updateVoiceCounter(guild));

    // ⏱️ Auto Spawn Mechanism Loop (20 Menit Sekali)
    setInterval(async () => {
        checkActiveEvent();
        const randomPokemon = WILD_SPAWN_LIST[Math.floor(Math.random() * WILD_SPAWN_LIST.length)];
        wildPokemon = randomPokemon;
        
        const channel = await client.channels.fetch(CONFIG_SETUP.SPAWN_CHANNEL_ID).catch(() => null);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('🚨 POKÉMON LIAR MUNCUL!')
                .setDescription(`Seekor wild **${wildPokemon}** meloncat keluar dari semak-semak! Ketik \`/catch\` dengan sigap untuk menjatuhkannya!`)
                .setThumbnail('https://i.imgur.com/83pZ70V.png')
                .setColor('#FF5722')
                .setFooter({ text: 'Gunakan tipe Bola terbaikmu agar tidak terlepas dan kabur.' });
            await channel.send({ embeds: [embed] });
        }
        logToWeb(`[SPAWN] Sistem melahirkan ${wildPokemon} secara otomatis.`);
    }, CONFIG_SETUP.SPAWN_INTERVAL);

    // Registering Multi-Slashed Command Builders
    const commands = [
        new SlashCommandBuilder().setName('bag').setDescription('🎒 Cek isi dompet, item bola, dan koleksi lengkap monster milikmu'),
        new SlashCommandBuilder().setName('daily').setDescription('🎁 Klaim tunjangan koin dan bonus gacha bola harian gratisanmu'),
        new SlashCommandBuilder().setName('catch').setDescription('🔴 Lempar bola pilihanmu ke Pokémon liar yang sedang aktif saat ini')
            .addStringOption(o => o.setName('nama').setDescription('Nama target monster liar').setRequired(true))
            .addStringOption(o => o.setName('ball').setDescription('Jenis bola yang ingin dilemparkan').setRequired(true).addChoices(
                { name: '🔴 Pokéball', value: 'pokeballs' }, { name: '🔵 Great Ball', value: 'greatballs' },
                { name: '⚫ Ultra Ball', value: 'ultraballs' }, { name: '🟡 Master Ball', value: 'masterballs' }
            )),
        new SlashCommandBuilder().setName('shop').setDescription('🛒 Kunjungi Mall Pasar Global Pokémon')
            .addSubcommand(sub => sub.setName('list').setDescription('Tampilkan daftar katalog barang dagangan'))
            .addSubcommand(sub => sub.setName('buy').setDescription('Beli item pilihanmu')
                .addStringOption(o => o.setName('item').setDescription('Item yang dibeli').setRequired(true).addChoices(
                    { name: '🔴 Pokéball (200 koin)', value: 'pokeballs' }, { name: '🔵 Great Ball (500 koin)', value: 'greatballs' },
                    { name: '⚫ Ultra Ball (1200 koin)', value: 'ultraballs' }, { name: '🟡 Master Ball (5000 koin)', value: 'masterballs' }
                ))
                .addIntegerOption(o => o.setName('jumlah').setDescription('Kuantitas jumlah').setRequired(true))),
        new SlashCommandBuilder().setName('battle').setDescription('⚔️ Tantang Trainer lain untuk bertarung multi-turn real-time')
            .addUserOption(o => o.setName('lawan').setDescription('Akun target lawan').setRequired(true))
            .addIntegerOption(o => o.setName('id_pokemon').setDescription('ID Unik Pokémon jagoanmu').setRequired(true)),
        new SlashCommandBuilder().setName('release').setDescription('🍂 Bebaskan Pokémon ke alam bebas untuk mencairkan santunan uang koin')
            .addIntegerOption(o => o.setName('id').setDescription('ID target Pokémon').setRequired(true)),
        new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Lihat daftar 5 Trainer terkaya se-jagat raya'),
        new SlashCommandBuilder().setName('evolve').setDescription('🔺 Picu mutasi evolusi Pokémon yang telah menyentuh batas standar (Lv. 16+)')
            .addIntegerOption(o => o.setName('id').setDescription('ID target Pokémon').setRequired(true)),

        // =========================================================================
        // 👑 ADMIN SUPER-USER ACCESS SYSTEM
        // =========================================================================
        new SlashCommandBuilder().setName('admin-give-coin').setDescription('👑 [ADMIN] Alirkan dana koin gaib ke dompet member')
            .addUserOption(o => o.setName('target').setRequired(true)).addIntegerOption(o => o.setName('jumlah').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
        new SlashCommandBuilder().setName('admin-give-ball').setDescription('👑 [ADMIN] Pasok suplai muatan bola ilegal ke pemain')
            .addUserOption(o => o.setName('target').setRequired(true))
            .addStringOption(o => o.setName('ball').setRequired(true).addChoices(
                { name: 'Pokéball', value: 'pokeballs' }, { name: 'Great Ball', value: 'greatballs' },
                { name: 'Ultra Ball', value: 'ultraballs' }, { name: 'Master Ball', value: 'masterballs' }
            )).addIntegerOption(o => o.setName('jumlah').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
        new SlashCommandBuilder().setName('admin-spawn-manual').setDescription('👑 [ADMIN] Paksa kelahiran monster spesifik seketika itu juga')
            .addStringOption(o => o.setName('pokemon').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
        new SlashCommandBuilder().setName('admin-clear-wild').setDescription('👑 [ADMIN] Bersihkan area panggung spawn liar')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
        new SlashCommandBuilder().setName('admin-set-event').setDescription('👑 [ADMIN] Deklarasikan status Event Global Server')
            .addStringOption(o => o.setName('nama').setRequired(true))
            .addStringOption(o => o.setName('tipe').setRequired(true).addChoices(
                { name: 'Double Coins Extravaganza', value: 'DOUBLE_COIN' }, { name: 'Shiny Paradise Event', value: 'DOUBLE_SHINY' }
            )).addIntegerOption(o => o.setName('durasi').setDescription('Waktu dalam satuan Menit').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
        new SlashCommandBuilder().setName('admin-wipe-user').setDescription('👑 [ADMIN] Hapus total data profile & inventory target user (PERMANEN)')
            .addUserOption(o => o.setName('target').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
        new SlashCommandBuilder().setName('admin-gift-all').setDescription('👑 [ADMIN] Bagikan koin gratis gratis ke seluruh database member')
            .addIntegerOption(o => o.setName('jumlah').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ];

    const rest = new (require('@discordjs/rest').REST)({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { 
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); 
        logToWeb(`[SYS] Berhasil mendaftarkan seluruh paket Slash Commands baru.`);
    } catch (e) { 
        console.error("Gagal melakukan registrasi command:", e); 
    }
});

// =========================================================================
// 🎙️ VOICE STATE UPDATER (MONITOR AKTIVITAS)
// =========================================================================
client.on('voiceStateUpdate', (oldState, newState) => {
    const guild = newState.guild || oldState.guild;
    if (guild) updateVoiceCounter(guild);
});

// =========================================================================
// 📥 COMMAND CENTRAL EXECUTIVE ROUTER
// =========================================================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, user, options } = interaction;

    // Trigger Anti-Cheat Double Action Spamming Lock
    if (!acquireLock(user.id)) {
        return interaction.reply({ content: '❌ **Anti-Cheat Guard:** Aksimu terlalu cepat! Harap tunggu antrean proses database selesai.', ephemeral: true });
    }

    // Deferral Reply Anti 3-Detik Batas Akhir Discord Timeout
    await interaction.deferReply({ ephemeral: (commandName === 'bag' || commandName === 'shop') });
    const t = await sequelize.transaction();

    try {
        const [userProf] = await Profile.findOrCreate({ where: { userId: user.id }, transaction: t });

        if (commandName === 'bag') {
            const bag = await Inventory.findAll({ where: { userId: user.id }, transaction: t });
            await t.commit();
            
            let pText = bag.length === 0 ? '*Kosong Melongpong*' : bag.map(p => {
                const s = getPokemonStats(p);
                return `• **ID: \`${p.id}\`** | ${p.isShiny ? '✨ ' : ''}**${p.pokemonName}** (Lv. ${p.level})\n  ↳ *Nature:* \`${p.nature}\` | *IV:* \`HP:${p.ivHp} A:${p.ivAttack} D:${p.ivDefense} S:${p.ivSpeed}\` | *MaxHP:* \`${s.maxHp}\``;
            }).join('\n');

            const embed = new EmbedBuilder().setTitle(`🎒 Tas Utama Trainer: ${user.username}`).setColor('#1e88e5')
                .addFields(
                    { name: '🪙 Tabungan Finansial', value: `\`${userProf.coins} Koin\``, inline: false },
                    { name: '📦 Amunisi Kantong Bola', value: `🔴 Pokéball: \`${userProf.pokeballs}\` | 🔵 Great: \`${userProf.greatballs}\` | ⚫ Ultra: \`${userProf.ultraballs}\` | 🟡 Master: \`${userProf.masterballs}\``, inline: false },
                    { name: '🐉 Monster Peliharaan', value: pText, inline: false }
                );

            releaseLock(user.id);
            return interaction.editReply({ embeds: [embed] });
        }

        if (commandName === 'daily') {
            const cooldown = 24 * 60 * 60 * 1000; // 24 Jam Penuh
            const lastClaim = new Date(userProf.lastDailyClaim).getTime();

            if (Date.now() - lastClaim < cooldown) {
                const sisa = cooldown - (Date.now() - lastClaim);
                const jam = Math.floor(sisa / (1000 * 60 * 60));
                const menit = Math.floor((sisa % (1000 * 60 * 60)) / (1000 * 60));
                await t.rollback();
                releaseLock(user.id);
                return interaction.editReply(`⏳ Kamu sudah mengambil jatah harianmu. Kembali lagi dalam **${jam} jam ${menit} menit**.`);
            }

            // Gacha pembagian item harian gratisan
            const coinDapat = Math.floor(Math.random() * 500) + 500;
            userProf.coins += coinDapat;
            userProf.pokeballs += 5;
            userProf.greatballs += 2;
            userProf.lastDailyClaim = new Date();

            await userProf.save({ transaction: t });
            await t.commit();

            logToWeb(`[DAILY] ${user.username} mengklaim hadiah harian.`);
            releaseLock(user.id);
            return interaction.editReply(`🎁 **DAILY REWARDS:** Berhasil mengklaim jatah hari ini!\n• \`+${coinDapat} Koin\`\n• \`+5x Pokéball\`\n• \`+2x Great Ball\``);
        }

        if (commandName === 'shop') {
            const sub = options.getSubcommand();

            if (sub === 'list') {
                await t.commit();
                const embed = new EmbedBuilder().setTitle('🛒 PASAR GLOBAL RIFT POKÉSHOP').setColor('#4caf50')
                    .setDescription('Gunakan perintah `/shop buy [nama_item] [jumlah]` untuk melakukan transaksi pembelian.')
                    .addFields(
                        { name: '🔴 Pokéball', value: `Harga: \`200 Koin\` per butir`, inline: true },
                        { name: '🔵 Great Ball', value: `Harga: \`500 Koin\` per butir`, inline: true },
                        { name: '⚫ Ultra Ball', value: `Harga: \`1200 Koin\` per butir`, inline: true },
                        { name: '🟡 Master Ball', value: `Harga: \`5000 Koin\` per butir`, inline: true }
                    );
                releaseLock(user.id);
                return interaction.editReply({ embeds: [embed] });
            }

            if (sub === 'buy') {
                const itemType = options.getString('item');
                const qty = options.getInteger('jumlah');

                if (qty <= 0) {
                    await t.rollback();
                    releaseLock(user.id);
                    return interaction.editReply('❌ Kuantitas pesanan pembelian tidak valid.');
                }

                const totalCost = BALL_SETTINGS[itemType].price * qty;
                if (userProf.coins < totalCost) {
                    await t.rollback();
                    releaseLock(user.id);
                    return interaction.editReply(`❌ Koin saldo kamu tidak memadai. Total tagihan belanja: \`${totalCost} Koin\`.`);
                }

                userProf.coins -= totalCost;
                userProf[itemType] += qty;

                await userProf.save({ transaction: t });
                await t.commit();

                logToWeb(`[SHOP] ${user.username} membeli ${qty}x ${itemType}.`);
                releaseLock(user.id);
                return interaction.editReply(`🛒 **Transaksi Sukses!** Berhasil membeli **${qty}x ${BALL_SETTINGS[itemType].name}** seharga \`${totalCost} Koin\`.`);
            }
        }

        if (commandName === 'catch') {
            const pokeTarget = options.getString('nama');
            const ballSelected = options.getString('ball');

            if (!wildPokemon || wildPokemon.toLowerCase() !== pokeTarget.toLowerCase()) {
                await t.rollback();
                releaseLock(user.id);
                return interaction.editReply('❌ Target Pokémon salah, atau barangkali monster tersebut sudah lelah dan kabur.');
            }

            if (userProf[ballSelected] <= 0) {
                await t.rollback();
                releaseLock(user.id);
                return interaction.editReply(`❌ Kamu kehabisan item amunisi **${BALL_SETTINGS[ballSelected].name}**.`);
            }

            // Konsumsi peluru bola pemain
            userProf[ballSelected] -= 1;

            const baseChance = POKEMON_DB[wildPokemon]?.catchRate || 0.50;
            const absoluteChance = baseChance + BALL_SETTINGS[ballSelected].rateBonus;

            if (Math.random() <= absoluteChance) {
                const isShiny = Math.random() <= (ACTIVE_EVENT.type === "DOUBLE_SHINY" ? 0.22 : 0.05);
                const listNature = Object.keys(NATURES);
                const pickedNature = listNature[Math.floor(Math.random() * listNature.length)];

                // Acak Nilai IV (0 - 31)
                const ivHp = Math.floor(Math.random() * 32);
                const ivAtk = Math.floor(Math.random() * 32);
                const ivDef = Math.floor(Math.random() * 32);
                const ivSpd = Math.floor(Math.random() * 32);

                await Inventory.create({ 
                    userId: user.id, pokemonName: wildPokemon, isShiny, 
                    nature: pickedNature, level: 5, ivHp, ivAttack: ivAtk, 
                    ivDefense: ivDef, ivSpeed: ivSpd 
                }, { transaction: t });

                let bonusCash = ACTIVE_EVENT.type === "DOUBLE_COIN" ? 300 : 150;
                userProf.coins += bonusCash;

                await userProf.save({ transaction: t });
                await t.commit();

                logToWeb(`[CATCH] ${user.username} berhasil mengamankan ${wildPokemon}.`);
                wildPokemon = null; // Reset spawn state global
                releaseLock(user.id);
                return interaction.editReply(`🎉 **TARGET AMAN TERTANGKAP!** Kamu mendapatkan **${pokeTarget}** ${isShiny ? '(✨ SHINY!)' : ''}.\n• Koin Hadiah: \`+${bonusCash} Koin\`\n• Sifat Nature: \`${pickedNature}\``);
            } else {
                await userProf.save({ transaction: t });
                await t.commit();
                releaseLock(user.id);
                return interaction.editReply(`💨 Ah sial! **${pokeTarget}** berhasil keluar dan meronta lolos dari kurungan bola lalu kabur.`);
            }
        }

        if (commandName === 'release') {
            const targetId = options.getInteger('id');
            const targetMonster = await Inventory.findOne({ where: { id: targetId, userId: user.id }, transaction: t });

            if (!targetMonster) {
                await t.rollback();
                releaseLock(user.id);
                return interaction.editReply('❌ Gagal mendeteksi ketersediaan monster dengan ID tersebut di kantongmu.');
            }

            await targetMonster.destroy({ transaction: t });
            userProf.coins += 120;
            await userProf.save({ transaction: t });
            await t.commit();

            logToWeb(`[RELEASE] ${user.username} melikuidasi ID ${targetId}.`);
            releaseLock(user.id);
            return interaction.editReply(`🍂 Berhasil melepas **${targetMonster.pokemonName}** kembali ke hutan rimba. Dapat kompensasi pelipur lara \`+120 Koin\`.`);
        }

        if (commandName === 'leaderboard') {
            await t.commit();
            const topFive = await Profile.findAll({ order: [['coins', 'DESC']], limit: 5 });
            let boardStr = topFive.map((p, index) => `**${index + 1}.** <@${p.userId}> ⌙ Saldo: \`${p.coins} Koin\``).join('\n');
            releaseLock(user.id);
            return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏆 SINGGASANA 5 TRAINER TERKAYA').setDescription(boardStr || '*Kosong*').setColor('#fbc02d')] });
        }

        if (commandName === 'evolve') {
            const idTarget = options.getInteger('id');
            const targetPoke = await Inventory.findOne({ where: { id: idTarget, userId: user.id }, transaction: t });

            if (!targetPoke) { await t.rollback(); releaseLock(user.id); return interaction.editReply('❌ ID Pokémon tidak ditemukan.'); }
            if (targetPoke.level < 16) { await t.rollback(); releaseLock(user.id); return interaction.editReply('❌ Batas energi tidak mumpuni. Syarat evolusi adalah Level 16.'); }

            const staticMeta = POKEMON_DB[targetPoke.pokemonName];
            if (!staticMeta || !staticMeta.evolvesTo) { await t.rollback(); releaseLock(user.id); return interaction.editReply('❌ Monster ini sudah menetap di fase puncak final evolusi.'); }

            const wujudLama = targetPoke.pokemonName;
            targetPoke.pokemonName = staticMeta.evolvesTo;
            await targetPoke.save({ transaction: t });
            await t.commit();

            logToWeb(`[EVOLVE] ${user.username} berhasil mengevolusikan ${wujudLama}.`);
            releaseLock(user.id);
            return interaction.editReply(`🔺 **MUTASI EVOLUSI SPEKTAKULER!** **${wujudLama}** milikmu bermutasi menjadi **${targetPoke.pokemonName}**!`);
        }

        // =========================================================================
        // 👑 ADMIN COMMAND EXECUTIONS HANDLER
        // =========================================================================
        if (commandName === 'admin-give-coin') {
            const target = options.getUser('target');
            const amount = options.getInteger('jumlah');
            const [profTarget] = await Profile.findOrCreate({ where: { userId: target.id }, transaction: t });

            profTarget.coins += amount;
            await profTarget.save({ transaction: t });
            await t.commit();

            logToWeb(`[ADMIN] ${user.username} menyuntik koin ke ${target.username}.`);
            releaseLock(user.id);
            return interaction.editReply(`👑 **ADMINISTRATOR:** Berhasil memanipulasi koin gaib sebesar \`${amount}\` ke dompet ${target}.`);
        }

        if (commandName === 'admin-give-ball') {
            const target = options.getUser('target');
            const jenisBall = options.getString('ball');
            const jumlahBall = options.getInteger('jumlah');
            const [profTarget] = await Profile.findOrCreate({ where: { userId: target.id }, transaction: t });

            profTarget[jenisBall] += jumlahBall;
            await profTarget.save({ transaction: t });
            await t.commit();

            logToWeb(`[ADMIN] ${user.username} menyuplai item ilegal ke ${target.username}.`);
            releaseLock(user.id);
            return interaction.editReply(`👑 **ADMINISTRATOR:** Memasok sebanyak \`${jumlahBall}x\` ${BALL_SETTINGS[jenisBall].name} ke dalam tas milik ${target}.`);
        }

        if (commandName === 'admin-spawn-manual') {
            const namaPk = options.getString('pokemon');
            const matchedKey = Object.keys(POKEMON_DB).find(k => k.toLowerCase() === namaPk.toLowerCase());

            if (!matchedKey) { await t.rollback(); releaseLock(user.id); return interaction.editReply('❌ Nama Pokémon tersebut tidak dikenali oleh kamus database internal.'); }

            wildPokemon = matchedKey;
            await t.commit();

            logToWeb(`[ADMIN] ${user.username} memaksa takdir melahirkan ${wildPokemon}.`);
            releaseLock(user.id);
            return interaction.editReply(`👑 **ADMINISTRATOR:** Berhasil memaksa gerbang portal terbuka, **${wildPokemon}** keluar sekarang!`);
        }

        if (commandName === 'admin-clear-wild') {
            wildPokemon = null;
            await t.commit();
            logToWeb(`[ADMIN] ${user.username} mengosongkan zona semak liar.`);
            releaseLock(user.id);
            return interaction.editReply('👑 **ADMINISTRATOR:** Area dibersihkan, Pokémon liar yang berkeliaran dihanguskan.');
        }

        if (commandName === 'admin-set-event') {
            const namaEv = options.getString('nama');
            const tipeEv = options.getString('tipe');
            const durasiEv = options.getInteger('durasi');

            ACTIVE_EVENT = { name: namaEv, type: tipeEv, multiplier: 2.0, endAt: Date.now() + (durasiEv * 60 * 1000) };
            await t.commit();

            logToWeb(`[ADMIN] Mengumumkan maklumat Event Server: ${namaEv}`);
            releaseLock(user.id);
            return interaction.editReply(`📢 **GLOBAL PROJECT STATE UPDATED:** Event **${namaEv}** resmi dikumandangkan untuk \`${durasiEv} Menit\` ke depan!`);
        }

        if (commandName === 'admin-wipe-user') {
            const target = options.getUser('target');
            
            await Inventory.destroy({ where: { userId: target.id }, transaction: t });
            await Profile.destroy({ where: { userId: target.id }, transaction: t });
            await t.commit();

            logToWeb(`[ADMIN WIPE] Akun data ${target.username} dihancurkan total.`);
            releaseLock(user.id);
            return interaction.editReply(`⚠️ **DANGER ZONE WIPE:** Seluruh berkas profile koin dan data peliharaan milik ${target} telah dihapus permanen dari sistem.`);
        }

        if (commandName === 'admin-gift-all') {
            const nominal = options.getInteger('jumlah');
            
            await Profile.increment({ coins: nominal }, { where: {}, transaction: t });
            await t.commit();

            logToWeb(`[ADMIN GLOBAL] Pembagian subsidi ${nominal} koin masal.`);
            releaseLock(user.id);
            return interaction.editReply(`👑 **ADMINISTRATOR MASAL:** Berhasil membagikan kompensasi koin gratis senilai \`${nominal}\` ke seluruh penduduk user di database.`);
        }

        if (commandName === 'battle') {
            const targetLawan = options.getUser('lawan');
            const idSaya = options.getInteger('id_pokemon');

            if (targetLawan.id === user.id) {
                await t.rollback(); releaseLock(user.id);
                return interaction.editReply('❌ Kamu tidak bisa melakukan aksi skizofrenia bertarung melawan bayangan dirimu sendiri.');
            }

            const pokeSaya = await Inventory.findOne({ where: { id: idSaya, userId: user.id }, transaction: t });
            const listPokeLawan = await Inventory.findAll({ where: { userId: targetLawan.id }, transaction: t });
            await t.commit();

            if (!pokeSaya) { releaseLock(user.id); return interaction.editReply('❌ Gagal menarik berkas data Pokémon andalanmu.'); }
            if (listPokeLawan.length === 0) { releaseLock(user.id); return interaction.editReply('❌ Pihak penantang target tidak memiliki modal satu pun monster untuk bertarung.'); }

            const dropDownMenus = listPokeLawan.slice(0, 25).map(p => ({
                label: `${p.pokemonName} (Lv. ${p.level}) — IV Atk: ${p.ivAttack}`,
                value: `rft_opp_${p.id}`
            }));

            const barisKomponen = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`pvp_stage_${user.id}_${targetLawan.id}_${idSaya}`)
                    .setPlaceholder('Pilih monster andalanmu untuk membalas tantangan')
                    .addOptions(dropDownMenus)
            );

            releaseLock(user.id);
            return interaction.editReply({ 
                content: `⚔️ **DEKLARASI DUEL ARENA:** ${user} melempar sarung tangan menantang duel maut kepada ${targetLawan}! Silakan pihak target menekan menu di bawah ini:`, 
                components: [barisKomponen] 
            });
        }

    } catch (e) {
        if (t) await t.rollback();
        releaseLock(user.id);
        console.error("Kesalahan fatal dalam penanganan interaksi utama:", e);
        return interaction.editReply('❌ Sistem Internal mendeteksi adanya malfungsi kegagalan kueri.');
    }
});

// =========================================================================
// ⚔️ SIMULASI PERTARUNGAN INTERAKTIF ENGINE PVP MULTI-TURN
// =========================================================================
client.on('interactionCreate', async selectInter => {
    if (!selectInter.isStringSelectMenu() || !selectInter.customId.startsWith('pvp_stage_')) return;
    
    const [,, p1Id, p2Id, poke1DbId] = selectInter.customId.split('_');
    if (selectInter.user.id !== p2Id) {
        return selectInter.reply({ content: '❌ Kamu bukan target yang diundang di dalam pakta duel akbar ini!', ephemeral: true });
    }

    await selectInter.deferReply();

    const poke2DbId = selectInter.values[0].replace('rft_opp_', '');
    
    const ksatria1 = await Inventory.findByPk(poke1DbId);
    const ksatria2 = await Inventory.findByPk(poke2DbId);

    if (!ksatria1 || !ksatria2) {
        return selectInter.editReply('❌ Sesi duel batal dikarenakan salah satu entitas monster dipindahkan/dihapus.');
    }

    let stats1 = getPokemonStats(ksatria1);
    let stats2 = getPokemonStats(ksatria2);

    let curHp1 = stats1.maxHp;
    let curHp2 = stats2.maxHp;

    let pertarunganLogs = [];
    pertarunganLogs.push(`🎭 **PERMAINAN DIMULAI!**\n• P1: **${ksatria1.pokemonName}** (Lv.${ksatria1.level})\n• P2: **${ksatria2.pokemonName}** (Lv.${ksatria2.level})\n──────────────────`);

    const moveList1 = POKEMON_DB[ksatria1.pokemonName]?.moves || ['Tackle'];
    const moveList2 = POKEMON_DB[ksatria2.pokemonName]?.moves || ['Tackle'];

    // Simulasi Siklus Putaran Turn Pertarungan Berkelanjutan Berbasis Kecepatan Speed Stats
    let turnCount = 1;
    while (curHp1 > 0 && curHp2 > 0 && turnCount <= 6) {
        pertarunganLogs.push(`[🥊 **ROUND ${turnCount}**]`);
        
        // Entitas 1 Menyerang Entitas 2
        let moveP1 = moveList1[Math.floor(Math.random() * moveList1.length)];
        let moveMeta1 = MOVE_DATA[moveP1] || { power: 40, type: 'Normal' };
        let efektivitas1 = getTypeEffectiveness(moveMeta1.type, POKEMON_DB[ksatria2.pokemonName]?.type);
        let kalkulasiKerusakan1 = Math.floor((((ksatria1.level * 0.4 + 2) * stats1.attack * moveMeta1.power) / (stats2.defense || 1)) / 50) + 2;
        kalkulasiKerusakan1 = Math.floor(kalkulasiKerusakan1 * efektivitas1);
        
        curHp2 -= kalkulasiKerusakan1;
        pertarunganLogs.push(`• **${ksatria1.pokemonName}** meluncurkan *${moveP1}*! Mengoyak \`${kalkulasiKerusakan1}\` HP lawan. ${efektivitas1 > 1 ? '🎯 Super efektif!' : ''}`);

        if (curHp2 <= 0) break;

        // Entitas 2 Membalas Menyerang Entitas 1
        let moveP2 = moveList2[Math.floor(Math.random() * moveList2.length)];
        let moveMeta2 = MOVE_DATA[moveP2] || { power: 40, type: 'Normal' };
        let efektivitas2 = getTypeEffectiveness(moveMeta2.type, POKEMON_DB[ksatria1.pokemonName]?.type);
        let kalkulasiKerusakan2 = Math.floor((((ksatria2.level * 0.4 + 2) * stats2.attack * moveMeta2.power) / (stats1.defense || 1)) / 50) + 2;
        kalkulasiKerusakan2 = Math.floor(kalkulasiKerusakan2 * efektivitas2);

        curHp1 -= kalkulasiKerusakan2;
        pertarunganLogs.push(`• **${ksatria2.pokemonName}** membalas dengan *${moveP2}*! Menghantam \`${kalkulasiKerusakan2}\` HP. ${efektivitas2 > 1 ? '🎯 Super efektif!' : ''}`);
        
        turnCount++;
    }

    // Penentuan Konklusi Akhir Jawara Arena Pertarungan
    let sangPemenang = curHp2 <= 0 ? ksatria1 : ksatria2;
    let pemenangId = curHp2 <= 0 ? p1Id : p2Id;
    let nominalHadiahKoin = Math.floor(Math.random() * 100) + 100;

    // Tambah XP poin untuk monster yang memenangkan laga pertarungan
    sangPemenang.xp += 45;
    let levelUpString = "";
    if (sangPemenang.xp >= 100) {
        sangPemenang.level += 1;
        sangPemenang.xp = 0;
        levelUpString = `\n🆙 **LEVEL UP CELEBRATION!** **${sangPemenang.pokemonName}** berevolusi secara kekuatan naik menjangkau Level \`${sangPemenang.level}\`!`;
    }
    await sangPemenang.save();

    // Input transfer koin ke profil pemenang
    const profilePemenang = await Profile.findOne({ where: { userId: pemenangId } });
    if (profilePemenang) {
        profilePemenang.coins += nominalHadiahKoin;
        await profilePemenang.save();
    }

    pertarunganLogs.push(`──────────────────\n🏆 **DUEL USAI!** Pemenangnya adalah <@${pemenangId}>!\n• Hadiah: \`+${nominalHadiahKoin} Koin\`\n• Poin Pengalaman: \`+45 XP\` ${levelUpString}`);

    const embedHasil = new EmbedBuilder()
        .setTitle('⚔️ RIFT ARENA CHAMPIONSHIP LOG')
        .setDescription(pertarunganLogs.join('\n').substring(0, 4000))
        .setColor('#e53935');

    return selectInter.editReply({ embeds: [embedHasil], components: [] });
});

// =========================================================================
// 💻 ADVANCED WEBPANEL LOG MONITORING DASHBOARD INTERFACE
// =========================================================================
app.get('/', async (req, res) => {
    try {
        const totalPemain = await Profile.count();
        const totalMonster = await Inventory.count();
        
        let templateHtml = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Rift Hyper Engine Control Panel v4</title>
            <style>
                body { background-color: #0d0e12; color: #e2e8f0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 30px; margin: 0; }
                .container { max-width: 1200px; margin: 0 auto; }
                header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; }
                h1 { color: #38bdf8; font-weight: 700; margin: 0; font-size: 28px; }
                .status-badge { background: #10b981; color: #fff; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: bold; text-transform: uppercase; }
                .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
                .stat-card { background: #1e293b; padding: 20px; border-radius: 12px; border-top: 4px solid #38bdf8; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); }
                .stat-card h3 { margin: 0 0 10px 0; color: #94a3b8; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
                .stat-card p { margin: 0; font-size: 22px; font-weight: 600; color: #f8fafc; }
                .stat-card span { color: #38bdf8; }
                .log-section { background: #020617; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; box-shadow: inset 0 2px 4px 0 rgba(0,0,0,0.6); }
                .log-header { font-size: 16px; font-weight: 600; color: #fbbf24; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; }
                .terminal-box { background: #000000; color: #34d399; padding: 20px; height: 400px; overflow-y: auto; font-family: 'Consolas', 'Courier New', monospace; border-radius: 8px; font-size: 14px; line-height: 1.6; border: 1px solid #111827; }
                .log-row { border-bottom: 1px solid #121b2c; padding: 6px 0; color: #34d399; }
                .log-row:hover { background: #0b132b; }
            </style>
            <script>
                // Auto reload halaman setiap 15 detik sekali untuk sinkronisasi log real-time
                setInterval(() => { window.location.reload(); }, 15000);
            </script>
        </head>
        <body>
            <div class="container">
                <header>
                    <div>
                        <h1>⚡ Pokémon Rift Mega Engine v4</h1>
                        <p style="margin: 5px 0 0 0; color: #64748b;">Enterprise Live Tracking Terminal Systems</p>
                    </div>
                    <div class="status-badge">Cluster Active</div>
                </header>

                <div class="dashboard-grid">
                    <div class="stat-card">
                        <h3>Kondisi Event Global</h3>
                        <p><span>🎉 Event:</span> ${ACTIVE_EVENT.name}</p>
                        <p style="font-size: 14px; margin-top: 5px; color: #a1a1aa;">Aturan Mekanik: Spawn Otomatis Setiap 20 Menit</p>
                    </div>
                    <div class="stat-card">
                        <h3>Statistik Data Infrastruktur</h3>
                        <p>👥 Total Pemain Terdaftar: <span>${totalPemain} User</span></p>
                        <p>🐉 Total Koleksi Pokémon: <span>${totalMonster} Ekor</span></p>
                    </div>
                </div>

                <div class="log-section">
                    <div class="log-header">
                        <span>📜 INTERNAL LIVE AUDIT SYSTEM TRAFFIC LOGS</span>
                        <span style="font-size: 12px; color: #64748b;">Auto-Refresh Active (15s)</span>
                    </div>
                    <div class="terminal-box">
                        ${serverLogs.length === 0 ? '<div style="color: #4b5563;">> Sistem dalam kondisi idle menunggu instruksi lalu lintas data...</div>' : serverLogs.map(logLine => `<div class="log-row">> ${logLine}</div>`).join('')}
                    </div>
                </div>
            </div>
        </body>
        </html>`;
        
        res.setHeader('Content-Type', 'text/html');
        return res.send(templateHtml);
    } catch (err) {
        return res.status(500).send("Gagal mengompilasi lembar kendali Web-Panel: " + err.message);
    }
});

// Jalankan Konektivitas Server Port Jaringan & Login Discord Gateway Token
app.listen(PORT, () => {
    logToWeb(`[SYS] Saluran HTTP Web Server Express sukses diaktifkan pada Port Alokasi *:${PORT}`);
});
client.login(process.env.DISCORD_TOKEN);
