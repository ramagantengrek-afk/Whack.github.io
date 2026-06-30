// bot.js
// =============================================================================
// POKEBOT - Single file Discord bot bertema Pokemon (PostgreSQL)
// Cukup 2 file: bot.js + package.json. Siap push ke GitHub & deploy ke Railway.
//
// ENV yang dibutuhkan (set di Railway Variables atau file .env lokal):
//   DISCORD_TOKEN   = token bot
//   CLIENT_ID       = application id bot
//   GUILD_ID        = (opsional) id server untuk deploy command instan
//   DATABASE_URL    = connection string postgres (Railway otomatis sediakan jika pakai plugin Postgres)
//   PGSSL           = "true" jika provider DB butuh SSL
//   ADMIN_IDS       = daftar user id admin dipisah koma
//   SNAPSHOT_INTERVAL_MINUTES = interval auto-snapshot untuk /rollback (default 1)
// =============================================================================

require("dotenv").config();
const { Pool } = require("pg");
const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

// =============================================================================
// 1. DATA POKEMON (species orisinal, tipe, base stat, evolusi, movepool)
// =============================================================================

const TYPE_CHART = {
  fire: { grass: 2, water: 0.5, fire: 0.5, ice: 2, bug: 2, rock: 0.5 },
  water: { fire: 2, grass: 0.5, water: 0.5, ground: 2, rock: 2 },
  grass: { water: 2, fire: 0.5, grass: 0.5, ground: 2, rock: 2, flying: 0.5, bug: 0.5, poison: 0.5 },
  electric: { water: 2, flying: 2, electric: 0.5, grass: 0.5, ground: 0 },
  normal: { rock: 0.5, ghost: 0 },
  flying: { grass: 2, bug: 2, electric: 0.5, rock: 0.5, fighting: 2 },
  bug: { grass: 2, fire: 0.5, fighting: 0.5, flying: 0.5, poison: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, rock: 2 },
  rock: { fire: 2, flying: 2, bug: 2, ground: 0.5, fighting: 0.5 },
  fighting: { normal: 2, rock: 2, ice: 2, flying: 0.5, poison: 0.5, bug: 0.5, ghost: 0 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5 },
  ice: { grass: 2, ground: 2, flying: 2, water: 0.5, ice: 0.5 },
  ghost: { ghost: 2, normal: 0, psychic: 2 },
  dragon: { dragon: 2 },
};

function typeEffectiveness(moveType, defenderTypes) {
  let mult = 1;
  for (const t of defenderTypes) {
    const row = TYPE_CHART[moveType];
    if (row && row[t] !== undefined) mult *= row[t];
  }
  return mult;
}

const MOVES = {
  tackle: { name: "Tackle", type: "normal", power: 40, accuracy: 100 },
  scratch: { name: "Scratch", type: "normal", power: 40, accuracy: 100 },
  ember: { name: "Ember", type: "fire", power: 40, accuracy: 100 },
  flamethrower: { name: "Flamethrower", type: "fire", power: 70, accuracy: 95 },
  watergun: { name: "Water Gun", type: "water", power: 40, accuracy: 100 },
  surf: { name: "Surf", type: "water", power: 70, accuracy: 95 },
  vinewhip: { name: "Vine Whip", type: "grass", power: 40, accuracy: 100 },
  razorleaf: { name: "Razor Leaf", type: "grass", power: 65, accuracy: 95 },
  thundershock: { name: "Thunder Shock", type: "electric", power: 40, accuracy: 100 },
  thunderbolt: { name: "Thunderbolt", type: "electric", power: 70, accuracy: 95 },
  gust: { name: "Gust", type: "flying", power: 40, accuracy: 100 },
  airslash: { name: "Air Slash", type: "flying", power: 65, accuracy: 95 },
  rockthrow: { name: "Rock Throw", type: "rock", power: 50, accuracy: 90 },
  bite: { name: "Bite", type: "normal", power: 45, accuracy: 100 },
  confusion: { name: "Confusion", type: "psychic", power: 50, accuracy: 100 },
  poisonsting: { name: "Poison Sting", type: "poison", power: 35, accuracy: 100 },
  dig: { name: "Dig", type: "ground", power: 60, accuracy: 100 },
  icebeam: { name: "Ice Beam", type: "ice", power: 65, accuracy: 95 },
  shadowball: { name: "Shadow Ball", type: "ghost", power: 60, accuracy: 100 },
  dragonbreath: { name: "Dragon Breath", type: "dragon", power: 60, accuracy: 100 },
};

const POKEMON_SPECIES = [
  { id: 1, name: "Flarion", types: ["fire"], base: { hp: 39, atk: 52, def: 43, spd: 65 }, stage: 1, evolvesTo: 2, evolveLevel: 16, catchRate: 45, moves: ["tackle", "ember", "scratch"], starter: true, emoji: "🔥" },
  { id: 2, name: "Flarodile", types: ["fire"], base: { hp: 58, atk: 64, def: 58, spd: 80 }, stage: 2, evolvesTo: 3, evolveLevel: 36, catchRate: 45, moves: ["ember", "flamethrower", "bite"], emoji: "🔥" },
  { id: 3, name: "Infernyx", types: ["fire", "flying"], base: { hp: 78, atk: 84, def: 78, spd: 100 }, stage: 3, catchRate: 45, moves: ["flamethrower", "airslash", "dig"], emoji: "🔥" },
  { id: 4, name: "Aquandra", types: ["water"], base: { hp: 44, atk: 48, def: 65, spd: 43 }, stage: 1, evolvesTo: 5, evolveLevel: 16, catchRate: 45, moves: ["tackle", "watergun"], starter: true, emoji: "💧" },
  { id: 5, name: "Aquarius", types: ["water"], base: { hp: 59, atk: 63, def: 80, spd: 58 }, stage: 2, evolvesTo: 6, evolveLevel: 36, catchRate: 45, moves: ["watergun", "surf", "bite"], emoji: "💧" },
  { id: 6, name: "Hydroking", types: ["water"], base: { hp: 79, atk: 83, def: 100, spd: 78 }, stage: 3, catchRate: 45, moves: ["surf", "icebeam", "bite"], emoji: "💧" },
  { id: 7, name: "Leaflet", types: ["grass"], base: { hp: 45, atk: 49, def: 49, spd: 45 }, stage: 1, evolvesTo: 8, evolveLevel: 16, catchRate: 45, moves: ["tackle", "vinewhip"], starter: true, emoji: "🌿" },
  { id: 8, name: "Foliana", types: ["grass", "poison"], base: { hp: 60, atk: 62, def: 63, spd: 60 }, stage: 2, evolvesTo: 9, evolveLevel: 32, catchRate: 45, moves: ["vinewhip", "razorleaf", "poisonsting"], emoji: "🌿" },
  { id: 9, name: "Verdantor", types: ["grass", "poison"], base: { hp: 80, atk: 82, def: 83, spd: 80 }, stage: 3, catchRate: 45, moves: ["razorleaf", "poisonsting", "dig"], emoji: "🌿" },
  { id: 10, name: "Sparkit", types: ["electric"], base: { hp: 35, atk: 55, def: 40, spd: 90 }, stage: 1, evolvesTo: 11, evolveLevel: 20, catchRate: 190, moves: ["thundershock", "tackle"], emoji: "⚡" },
  { id: 11, name: "Voltrex", types: ["electric"], base: { hp: 60, atk: 75, def: 60, spd: 110 }, stage: 2, catchRate: 75, moves: ["thunderbolt", "thundershock", "scratch"], emoji: "⚡" },
  { id: 12, name: "Pidgekit", types: ["normal", "flying"], base: { hp: 40, atk: 45, def: 40, spd: 56 }, stage: 1, evolvesTo: 13, evolveLevel: 18, catchRate: 255, moves: ["tackle", "gust"], emoji: "🐦" },
  { id: 13, name: "Skywing", types: ["normal", "flying"], base: { hp: 63, atk: 60, def: 55, spd: 71 }, stage: 2, catchRate: 120, moves: ["gust", "airslash"], emoji: "🐦" },
  { id: 14, name: "Rattick", types: ["normal"], base: { hp: 30, atk: 56, def: 35, spd: 72 }, stage: 1, evolvesTo: 15, evolveLevel: 20, catchRate: 255, moves: ["tackle", "bite"], emoji: "🐭" },
  { id: 15, name: "Ratterang", types: ["normal"], base: { hp: 55, atk: 81, def: 60, spd: 97 }, stage: 2, catchRate: 127, moves: ["bite", "tackle"], emoji: "🐭" },
  { id: 16, name: "Geodude-X", types: ["rock", "ground"], base: { hp: 40, atk: 80, def: 100, spd: 20 }, stage: 1, evolvesTo: 17, evolveLevel: 25, catchRate: 255, moves: ["tackle", "rockthrow"], emoji: "🪨" },
  { id: 17, name: "Graveltor", types: ["rock", "ground"], base: { hp: 55, atk: 95, def: 115, spd: 35 }, stage: 2, catchRate: 120, moves: ["rockthrow", "dig"], emoji: "🪨" },
  { id: 18, name: "Psyfin", types: ["psychic"], base: { hp: 50, atk: 45, def: 45, spd: 90 }, stage: 1, evolvesTo: 19, evolveLevel: 25, catchRate: 190, moves: ["confusion", "tackle"], emoji: "🔮" },
  { id: 19, name: "Mindara", types: ["psychic"], base: { hp: 70, atk: 65, def: 65, spd: 110 }, stage: 2, catchRate: 75, moves: ["confusion", "shadowball"], emoji: "🔮" },
  { id: 20, name: "Gloomite", types: ["ghost", "poison"], base: { hp: 45, atk: 50, def: 45, spd: 55 }, stage: 1, evolvesTo: 21, evolveLevel: 22, catchRate: 190, moves: ["poisonsting", "tackle"], emoji: "👻" },
  { id: 21, name: "Phantule", types: ["ghost", "poison"], base: { hp: 65, atk: 70, def: 65, spd: 75 }, stage: 2, catchRate: 90, moves: ["shadowball", "poisonsting"], emoji: "👻" },
  { id: 22, name: "Snowlet", types: ["ice"], base: { hp: 50, atk: 50, def: 50, spd: 50 }, stage: 1, evolvesTo: 23, evolveLevel: 24, catchRate: 190, moves: ["tackle", "icebeam"], emoji: "❄️" },
  { id: 23, name: "Frostorn", types: ["ice"], base: { hp: 75, atk: 75, def: 75, spd: 75 }, stage: 2, catchRate: 75, moves: ["icebeam", "bite"], emoji: "❄️" },
  { id: 24, name: "Drakling", types: ["dragon"], base: { hp: 55, atk: 65, def: 55, spd: 65 }, stage: 1, evolvesTo: 25, evolveLevel: 30, catchRate: 60, moves: ["dragonbreath", "tackle"], emoji: "🐉" },
  { id: 25, name: "Wyrmdrake", types: ["dragon", "flying"], base: { hp: 85, atk: 95, def: 85, spd: 95 }, stage: 2, catchRate: 30, moves: ["dragonbreath", "airslash"], emoji: "🐉" },
  { id: 26, name: "Buzzling", types: ["bug"], base: { hp: 35, atk: 40, def: 35, spd: 50 }, stage: 1, evolvesTo: 27, evolveLevel: 15, catchRate: 255, moves: ["tackle", "poisonsting"], emoji: "🐛" },
  { id: 27, name: "Beetalor", types: ["bug", "flying"], base: { hp: 55, atk: 65, def: 55, spd: 75 }, stage: 2, catchRate: 120, moves: ["airslash", "poisonsting"], emoji: "🐛" },
  { id: 28, name: "Mewlith", types: ["psychic"], base: { hp: 100, atk: 100, def: 100, spd: 100 }, stage: 1, catchRate: 3, legendary: true, moves: ["confusion", "shadowball", "icebeam"], emoji: "✨" },
  { id: 29, name: "Zaprexis", types: ["electric", "flying"], base: { hp: 90, atk: 110, def: 90, spd: 130 }, stage: 1, catchRate: 3, legendary: true, moves: ["thunderbolt", "airslash", "dragonbreath"], emoji: "✨" },
  { id: 30, name: "Terraquake", types: ["ground", "rock"], base: { hp: 110, atk: 120, def: 110, spd: 70 }, stage: 1, catchRate: 3, legendary: true, moves: ["dig", "rockthrow", "dragonbreath"], emoji: "✨" },
];

const getSpecies = (id) => POKEMON_SPECIES.find((p) => p.id === Number(id));
const getSpeciesByName = (name) => POKEMON_SPECIES.find((p) => p.name.toLowerCase() === name.toLowerCase().trim());
const getStarters = () => POKEMON_SPECIES.filter((p) => p.starter);
const randomWildSpecies = () => {
  const wild = POKEMON_SPECIES.filter((p) => !p.legendary && p.stage === 1);
  return wild[Math.floor(Math.random() * wild.length)];
};

// =============================================================================
// 2. DATABASE (PostgreSQL) + SISTEM SNAPSHOT UNTUK /rollback
// =============================================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS players (
  user_id        TEXT PRIMARY KEY,
  money          INTEGER NOT NULL DEFAULT 1500,
  bag            JSONB NOT NULL DEFAULT '{"pokeball":5,"greatball":2,"ultraball":0,"potion":3,"superpotion":0,"revive":1}',
  pokedex_seen   JSONB NOT NULL DEFAULT '[]',
  pokedex_caught JSONB NOT NULL DEFAULT '[]',
  battles_won    INTEGER NOT NULL DEFAULT 0,
  battles_lost   INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pokemon_instances (
  instance_id   BIGSERIAL PRIMARY KEY,
  species_id    INTEGER NOT NULL,
  owner_id      TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  nickname      TEXT,
  level         INTEGER NOT NULL DEFAULT 5,
  exp           INTEGER NOT NULL DEFAULT 0,
  iv_hp         INTEGER NOT NULL DEFAULT 0,
  iv_atk        INTEGER NOT NULL DEFAULT 0,
  iv_def        INTEGER NOT NULL DEFAULT 0,
  iv_spd        INTEGER NOT NULL DEFAULT 0,
  shiny         BOOLEAN NOT NULL DEFAULT false,
  in_box        BOOLEAN NOT NULL DEFAULT true,
  caught_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pokemon_owner ON pokemon_instances(owner_id);
CREATE TABLE IF NOT EXISTS snapshots (
  id            BIGSERIAL PRIMARY KEY,
  snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason        TEXT,
  data          JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_time ON snapshots(snapshot_at);
`;

async function bootstrapSchema() {
  await pool.query(SCHEMA_SQL);
  console.log("✅ Skema database siap.");
}

const rowToPlayer = (row) =>
  !row
    ? null
    : {
        userId: row.user_id,
        money: row.money,
        bag: row.bag,
        pokedexSeen: row.pokedex_seen,
        pokedexCaught: row.pokedex_caught,
        battlesWon: row.battles_won,
        battlesLost: row.battles_lost,
        createdAt: row.created_at,
      };

const rowToInstance = (row) =>
  !row
    ? null
    : {
        instanceId: String(row.instance_id),
        speciesId: row.species_id,
        ownerId: row.owner_id,
        nickname: row.nickname,
        level: row.level,
        exp: row.exp,
        ivs: { hp: row.iv_hp, atk: row.iv_atk, def: row.iv_def, spd: row.iv_spd },
        shiny: row.shiny,
        inBox: row.in_box,
        caughtAt: row.caught_at,
      };

async function getPlayer(userId) {
  const { rows } = await pool.query("SELECT * FROM players WHERE user_id = $1", [userId]);
  if (rows.length) return rowToPlayer(rows[0]);
  const { rows: inserted } = await pool.query("INSERT INTO players (user_id) VALUES ($1) RETURNING *", [userId]);
  return rowToPlayer(inserted[0]);
}

async function playerExists(userId) {
  const { rows } = await pool.query("SELECT 1 FROM players WHERE user_id = $1", [userId]);
  return rows.length > 0;
}

async function updatePlayer(userId, fields) {
  const map = { money: "money", bag: "bag", pokedexSeen: "pokedex_seen", pokedexCaught: "pokedex_caught", battlesWon: "battles_won", battlesLost: "battles_lost" };
  const sets = [];
  const values = [];
  let i = 1;
  for (const key of Object.keys(fields)) {
    const col = map[key];
    if (!col) continue;
    sets.push(`${col} = $${i}`);
    const v = fields[key];
    values.push(typeof v === "object" && v !== null ? JSON.stringify(v) : v);
    i++;
  }
  if (sets.length === 0) return getPlayer(userId);
  values.push(userId);
  const { rows } = await pool.query(`UPDATE players SET ${sets.join(", ")} WHERE user_id = $${i} RETURNING *`, values);
  return rowToPlayer(rows[0]);
}

async function createPokemonInstance(speciesId, level, ownerId, opts = {}) {
  await getPlayer(ownerId);
  const ivs = opts.ivs || {
    hp: Math.floor(Math.random() * 32),
    atk: Math.floor(Math.random() * 32),
    def: Math.floor(Math.random() * 32),
    spd: Math.floor(Math.random() * 32),
  };
  const shiny = opts.shiny !== undefined ? opts.shiny : Math.random() < 0.02;
  const inBox = opts.inBox !== undefined ? opts.inBox : true;
  const { rows } = await pool.query(
    `INSERT INTO pokemon_instances (species_id, owner_id, nickname, level, exp, iv_hp, iv_atk, iv_def, iv_spd, shiny, in_box)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [speciesId, ownerId, opts.nickname || null, level, opts.exp || 0, ivs.hp, ivs.atk, ivs.def, ivs.spd, shiny, inBox]
  );
  return rowToInstance(rows[0]);
}

async function getInstance(instanceId) {
  const { rows } = await pool.query("SELECT * FROM pokemon_instances WHERE instance_id = $1", [instanceId]);
  return rowToInstance(rows[0]);
}

async function getPlayerPokemon(ownerId) {
  const { rows } = await pool.query("SELECT * FROM pokemon_instances WHERE owner_id = $1 ORDER BY caught_at ASC", [ownerId]);
  return rows.map(rowToInstance);
}

async function updateInstance(instanceId, fields) {
  const map = { nickname: "nickname", level: "level", exp: "exp", inBox: "in_box" };
  const sets = [];
  const values = [];
  let i = 1;
  for (const key of Object.keys(fields)) {
    const col = map[key];
    if (!col) continue;
    sets.push(`${col} = $${i}`);
    values.push(fields[key]);
    i++;
  }
  if (sets.length === 0) return getInstance(instanceId);
  values.push(instanceId);
  const { rows } = await pool.query(`UPDATE pokemon_instances SET ${sets.join(", ")} WHERE instance_id = $${i} RETURNING *`, values);
  return rowToInstance(rows[0]);
}

async function deleteInstance(instanceId) {
  await pool.query("DELETE FROM pokemon_instances WHERE instance_id = $1", [instanceId]);
}

async function takeSnapshot(reason = "auto") {
  const players = (await pool.query("SELECT * FROM players")).rows;
  const instances = (await pool.query("SELECT * FROM pokemon_instances")).rows;
  const { rows } = await pool.query("INSERT INTO snapshots (reason, data) VALUES ($1, $2) RETURNING id, snapshot_at", [
    reason,
    JSON.stringify({ players, instances }),
  ]);
  await pool.query(`DELETE FROM snapshots WHERE id IN (SELECT id FROM snapshots ORDER BY snapshot_at DESC OFFSET 1000)`);
  return { id: rows[0].id, ts: rows[0].snapshot_at };
}

async function findClosestSnapshot(targetDate) {
  const { rows } = await pool.query(`SELECT * FROM snapshots WHERE snapshot_at <= $1 ORDER BY snapshot_at DESC LIMIT 1`, [targetDate]);
  if (rows.length) return rows[0];
  const fallback = await pool.query(`SELECT * FROM snapshots ORDER BY snapshot_at ASC LIMIT 1`);
  return fallback.rows[0] || null;
}

async function restoreFromSnapshotRow(snapshotRow) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM pokemon_instances");
    await client.query("DELETE FROM players");
    const { players, instances } = snapshotRow.data;
    for (const p of players) {
      await client.query(
        `INSERT INTO players (user_id, money, bag, pokedex_seen, pokedex_caught, battles_won, battles_lost, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [p.user_id, p.money, JSON.stringify(p.bag), JSON.stringify(p.pokedex_seen), JSON.stringify(p.pokedex_caught), p.battles_won, p.battles_lost, p.created_at]
      );
    }
    for (const inst of instances) {
      await client.query(
        `INSERT INTO pokemon_instances (instance_id, species_id, owner_id, nickname, level, exp, iv_hp, iv_atk, iv_def, iv_spd, shiny, in_box, caught_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [inst.instance_id, inst.species_id, inst.owner_id, inst.nickname, inst.level, inst.exp, inst.iv_hp, inst.iv_atk, inst.iv_def, inst.iv_spd, inst.shiny, inst.in_box, inst.caught_at]
      );
    }
    await client.query(`SELECT setval(pg_get_serial_sequence('pokemon_instances','instance_id'), COALESCE((SELECT MAX(instance_id) FROM pokemon_instances), 1))`);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function rollbackBySeconds(secondsAgo) {
  const targetDate = new Date(Date.now() - secondsAgo * 1000);
  const snap = await findClosestSnapshot(targetDate);
  if (!snap) throw new Error("Tidak ada snapshot yang tersedia untuk rollback.");
  await restoreFromSnapshotRow(snap);
  return { targetDate, snapshotAt: snap.snapshot_at };
}

async function resetGame() {
  await takeSnapshot("before-reset-game");
  await pool.query("DELETE FROM pokemon_instances");
  await pool.query("DELETE FROM players");
}

async function resetPlayer(userId) {
  await takeSnapshot("before-reset-player-" + userId);
  await pool.query("DELETE FROM pokemon_instances WHERE owner_id = $1", [userId]);
  await pool.query("DELETE FROM players WHERE user_id = $1", [userId]);
}

// =============================================================================
// 3. GAME LOGIC (stat, exp, catch chance, damage)
// =============================================================================

function calcStat(base, iv, level, isHp = false) {
  if (isHp) return Math.floor(((2 * base + iv) * level) / 100) + level + 10;
  return Math.floor(((2 * base + iv) * level) / 100) + 5;
}

function getComputedStats(instance) {
  const species = getSpecies(instance.speciesId);
  const lvl = instance.level;
  return {
    hp: calcStat(species.base.hp, instance.ivs.hp, lvl, true),
    atk: calcStat(species.base.atk, instance.ivs.atk, lvl),
    def: calcStat(species.base.def, instance.ivs.def, lvl),
    spd: calcStat(species.base.spd, instance.ivs.spd, lvl),
  };
}

const expForNextLevel = (level) => Math.floor((4 * Math.pow(level, 3)) / 5);

function addExp(instance, amount) {
  instance.exp += amount;
  const leveledUp = [];
  let next = expForNextLevel(instance.level + 1);
  while (instance.exp >= next && instance.level < 100) {
    instance.level += 1;
    leveledUp.push(instance.level);
    next = expForNextLevel(instance.level + 1);
  }
  return leveledUp;
}

function calcCatchChance(species, currentHpPct, ballBonus) {
  const rate = species.catchRate;
  const hpFactor = 1 - currentHpPct * 0.7;
  let chance = (rate / 255) * ballBonus * (0.4 + hpFactor);
  return Math.max(0.02, Math.min(0.95, chance));
}

function damageRoll(attackerStats, move, defenderStats, defenderTypes) {
  if (Math.random() * 100 > move.accuracy) return { hit: false, dmg: 0, effectiveness: 1 };
  const eff = typeEffectiveness(move.type, defenderTypes);
  const base = ((2 * 50) / 5 + 2) * move.power * (attackerStats.atk / Math.max(1, defenderStats.def)) / 50 + 2;
  const variance = 0.85 + Math.random() * 0.15;
  let dmg = Math.floor(base * eff * variance);
  if (dmg < 1) dmg = 1;
  return { hit: true, dmg, effectiveness: eff };
}

function formatPokemonLine(instance) {
  const species = getSpecies(instance.speciesId);
  const shiny = instance.shiny ? "✨" : "";
  const nickname = instance.nickname ? `${instance.nickname} (${species.name})` : species.name;
  return `${species.emoji} ${shiny}${nickname} Lv.${instance.level}`;
}

// =============================================================================
// 4. ADMIN UTIL
// =============================================================================

const getAdminIds = () =>
  (process.env.ADMIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
const isAdmin = (userId) => getAdminIds().includes(userId);

const ITEM_LABEL = {
  pokeball: "🔴 Poke Ball",
  greatball: "🔵 Great Ball",
  ultraball: "🟡 Ultra Ball",
  potion: "🧪 Potion",
  superpotion: "💉 Super Potion",
  revive: "✨ Revive",
};

const SHOP_ITEMS = {
  pokeball: { label: "🔴 Poke Ball", price: 200 },
  greatball: { label: "🔵 Great Ball", price: 500 },
  ultraball: { label: "🟡 Ultra Ball", price: 1000 },
  potion: { label: "🧪 Potion", price: 150 },
  superpotion: { label: "💉 Super Potion", price: 400 },
  revive: { label: "✨ Revive", price: 800 },
};

// =============================================================================
// 5. DEFINISI SLASH COMMAND
// =============================================================================

const commandDefs = [
  new SlashCommandBuilder().setName("start").setDescription("Mulai perjalanan dan pilih Pokemon starter pertamamu"),
  new SlashCommandBuilder().setName("catch").setDescription("Cari dan tangkap Pokemon liar"),
  new SlashCommandBuilder().setName("battle").setDescription("Bertarung melawan Pokemon liar pakai Pokemon pertama di tim aktif"),
  new SlashCommandBuilder()
    .setName("team")
    .setDescription("Kelola tim aktif Pokemon (maks 6)")
    .addSubcommand((s) => s.setName("lihat").setDescription("Lihat tim aktifmu"))
    .addSubcommand((s) => s.setName("tambah").setDescription("Pindahkan Pokemon dari PC Box ke tim aktif").addStringOption((o) => o.setName("instance_id").setDescription("ID Pokemon (lihat /bag)").setRequired(true)))
    .addSubcommand((s) => s.setName("keluarkan").setDescription("Pindahkan Pokemon dari tim aktif ke PC Box").addStringOption((o) => o.setName("instance_id").setDescription("ID Pokemon (lihat /bag)").setRequired(true))),
  new SlashCommandBuilder().setName("bag").setDescription("Lihat tas (item & koleksi Pokemon) milikmu").addUserOption((o) => o.setName("user").setDescription("Lihat tas user lain (opsional)")),
  new SlashCommandBuilder().setName("pokedex").setDescription("Lihat progres Pokedex"),
  new SlashCommandBuilder().setName("profile").setDescription("Lihat profil & statistik trainer").addUserOption((o) => o.setName("user").setDescription("Lihat profil user lain (opsional)")),
  new SlashCommandBuilder().setName("shop").setDescription("Lihat daftar item & harga di toko"),
  new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Beli item dari Poke Mart")
    .addStringOption((o) => o.setName("item").setDescription("Item yang ingin dibeli").setRequired(true).addChoices(...Object.entries(SHOP_ITEMS).map(([k, it]) => ({ name: it.label, value: k }))))
    .addIntegerOption((o) => o.setName("jumlah").setDescription("Jumlah (default 1)").setMinValue(1).setMaxValue(99)),
  new SlashCommandBuilder().setName("release").setDescription("Lepaskan Pokemon kembali ke alam liar (PERMANEN)").addStringOption((o) => o.setName("instance_id").setDescription("ID Pokemon (lihat /bag)").setRequired(true)),
  new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("Beri nama panggilan untuk Pokemon-mu")
    .addStringOption((o) => o.setName("instance_id").setDescription("ID Pokemon (lihat /bag)").setRequired(true))
    .addStringOption((o) => o.setName("nama").setDescription("Nama panggilan baru").setRequired(true).setMaxLength(20)),

  // ADMIN
  new SlashCommandBuilder()
    .setName("rollback")
    .setDescription("[ADMIN] Kembalikan seluruh data game ke titik waktu tertentu di masa lalu")
    .addIntegerOption((o) => o.setName("jumlah").setDescription("Jumlah waktu lalu").setRequired(true).setMinValue(1))
    .addStringOption((o) => o.setName("satuan").setDescription("Satuan waktu").setRequired(true).addChoices({ name: "Detik", value: "detik" }, { name: "Menit", value: "menit" }, { name: "Jam", value: "jam" })),
  new SlashCommandBuilder().setName("inspect-profile").setDescription("[ADMIN] Lihat detail lengkap profil seorang player").addUserOption((o) => o.setName("user").setDescription("Player target").setRequired(true)),
  new SlashCommandBuilder().setName("reset-game").setDescription("[ADMIN] Hapus SELURUH data game (semua player & Pokemon)"),
  new SlashCommandBuilder()
    .setName("reset-data")
    .setDescription("[ADMIN] Reset data spesifik")
    .addSubcommand((s) => s.setName("player").setDescription("Hapus semua data milik satu player").addUserOption((o) => o.setName("user").setDescription("Player target").setRequired(true))),
  new SlashCommandBuilder()
    .setName("give-pokemon")
    .setDescription("[ADMIN] Berikan Pokemon ke player (masuk PC Box, cek lewat /bag)")
    .addUserOption((o) => o.setName("user").setDescription("Player penerima").setRequired(true))
    .addStringOption((o) => o.setName("nama_pokemon").setDescription("Nama spesies, mis. Flarion").setRequired(true))
    .addIntegerOption((o) => o.setName("level").setDescription("Level (1-100, default 5)").setMinValue(1).setMaxValue(100))
    .addBooleanOption((o) => o.setName("shiny").setDescription("Jadikan shiny? (default: acak)")),
  new SlashCommandBuilder()
    .setName("give-item")
    .setDescription("[ADMIN] Berikan item ke player (masuk /bag)")
    .addUserOption((o) => o.setName("user").setDescription("Player penerima").setRequired(true))
    .addStringOption((o) => o.setName("item").setDescription("Item").setRequired(true).addChoices(...Object.entries(ITEM_LABEL).map(([k, v]) => ({ name: v, value: k }))))
    .addIntegerOption((o) => o.setName("jumlah").setDescription("Jumlah").setRequired(true).setMinValue(1).setMaxValue(999)),
  new SlashCommandBuilder()
    .setName("give-money")
    .setDescription("[ADMIN] Berikan / kurangi uang player")
    .addUserOption((o) => o.setName("user").setDescription("Player target").setRequired(true))
    .addIntegerOption((o) => o.setName("jumlah").setDescription("Jumlah koin (boleh negatif)").setRequired(true)),
  new SlashCommandBuilder()
    .setName("set-level")
    .setDescription("[ADMIN] Ubah level Pokemon milik player")
    .addStringOption((o) => o.setName("instance_id").setDescription("ID Pokemon").setRequired(true))
    .addIntegerOption((o) => o.setName("level").setDescription("Level baru (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)),
].map((b) => b.toJSON());

// =============================================================================
// 6. DISCORD CLIENT + HANDLER
// =============================================================================

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`✅ Login sebagai ${client.user.tag}`);
  try {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commandDefs });
      console.log("✅ Slash command ter-deploy ke GUILD (instan).");
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commandDefs });
      console.log("✅ Slash command ter-deploy GLOBAL (bisa butuh waktu untuk muncul).");
    }
  } catch (e) {
    console.error("Gagal deploy slash command:", e);
  }

  takeSnapshot("startup").catch((e) => console.error("Snapshot startup gagal:", e));
  const intervalMinutes = Math.max(1, Number(process.env.SNAPSHOT_INTERVAL_MINUTES || 1));
  setInterval(() => {
    takeSnapshot("auto-interval").catch((e) => console.error("Auto-snapshot gagal:", e));
  }, intervalMinutes * 60 * 1000);
});

async function requireAdmin(interaction) {
  if (!isAdmin(interaction.user.id)) {
    await interaction.reply({ content: "❌ Command ini khusus admin.", ephemeral: true });
    return false;
  }
  return true;
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  try {
    switch (commandName) {
      // ---------------- /start ----------------
      case "start": {
        const userId = interaction.user.id;
        const existing = await getPlayerPokemon(userId);
        if (existing.length > 0) return interaction.reply({ content: "Kamu sudah punya Pokemon! Gunakan `/bag`.", ephemeral: true });
        await getPlayer(userId);

        const starters = getStarters();
        const embed = new EmbedBuilder().setTitle("🌟 Pilih Pokemon Starter-mu!").setDescription(starters.map((s) => `${s.emoji} **${s.name}** — Tipe: ${s.types.join("/")}`).join("\n")).setColor(0x3ba55d);
        const row = new ActionRowBuilder().addComponents(starters.map((s) => new ButtonBuilder().setCustomId(`start_pick_${s.id}`).setLabel(s.name).setStyle(ButtonStyle.Primary).setEmoji(s.emoji)));
        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = msg.createMessageComponentCollector({ time: 60_000 });
        collector.on("collect", async (i) => {
          if (i.user.id !== userId) return i.reply({ content: "Ini bukan sesi /start milikmu!", ephemeral: true });
          const speciesId = Number(i.customId.replace("start_pick_", ""));
          const species = getSpecies(speciesId);
          const already = await getPlayerPokemon(userId);
          if (already.length > 0) return i.update({ content: "Kamu sudah memilih starter sebelumnya!", embeds: [], components: [] });
          await createPokemonInstance(speciesId, 5, userId, { inBox: false });
          await i.update({ content: null, embeds: [new EmbedBuilder().setTitle(`Selamat! Kamu memilih ${species.emoji} ${species.name}!`).setDescription("Gunakan `/catch`, `/bag`, dan `/battle`!").setColor(0x3ba55d)], components: [] });
          collector.stop();
        });
        collector.on("end", (collected) => {
          if (collected.size === 0) interaction.editReply({ content: "⏱️ Waktu habis. Coba `/start` lagi.", embeds: [], components: [] }).catch(() => {});
        });
        break;
      }

      // ---------------- /catch ----------------
      case "catch": {
        const userId = interaction.user.id;
        let player = await getPlayer(userId);
        const species = randomWildSpecies();
        const level = Math.floor(Math.random() * 10) + 3;
        const stats = getComputedStats({ speciesId: species.id, level, ivs: { hp: 16, atk: 16, def: 16, spd: 16 } });
        let currentHpPct = 1.0;
        const BALL_BONUS = { pokeball: 1, greatball: 1.5, ultraball: 2 };

        const seen = new Set(player.pokedexSeen);
        seen.add(species.id);
        await updatePlayer(userId, { pokedexSeen: [...seen] });

        const buildEmbed = () => new EmbedBuilder().setTitle(`Pokemon liar muncul! ${species.emoji} ${species.name}`).setDescription(`Level ${level} • Tipe: ${species.types.join("/")}\nHP: ${Math.ceil(stats.hp * currentHpPct)}/${stats.hp}`).setColor(0xf5a623);
        const buildRow = () =>
          new ActionRowBuilder().addComponents(
            Object.keys(BALL_BONUS)
              .map((ball) => new ButtonBuilder().setCustomId(`catch_${ball}`).setLabel(`${ITEM_LABEL[ball]} (${player.bag[ball] || 0})`).setStyle(ButtonStyle.Primary).setDisabled((player.bag[ball] || 0) <= 0))
              .concat(new ButtonBuilder().setCustomId("catch_run").setLabel("Biarkan Kabur").setStyle(ButtonStyle.Secondary))
          );

        const msg = await interaction.reply({ embeds: [buildEmbed()], components: [buildRow()], fetchReply: true });
        const collector = msg.createMessageComponentCollector({ time: 45_000 });

        collector.on("collect", async (i) => {
          if (i.user.id !== userId) return i.reply({ content: "Ini bukan sesi catch milikmu!", ephemeral: true });
          if (i.customId === "catch_run") {
            collector.stop();
            return i.update({ content: `${species.name} liar pun kabur.`, embeds: [], components: [] });
          }
          const ball = i.customId.replace("catch_", "");
          const fresh = await getPlayer(userId);
          if ((fresh.bag[ball] || 0) <= 0) return i.reply({ content: "Ball itu sudah habis!", ephemeral: true });

          const newBag = { ...fresh.bag, [ball]: fresh.bag[ball] - 1 };
          await updatePlayer(userId, { bag: newBag });
          player.bag = newBag;

          const chance = calcCatchChance(species, currentHpPct, BALL_BONUS[ball]);
          if (Math.random() < chance) {
            await createPokemonInstance(species.id, level, userId, { inBox: true });
            const caught = new Set(fresh.pokedexCaught);
            caught.add(species.id);
            await updatePlayer(userId, { pokedexCaught: [...caught] });
            collector.stop();
            return i.update({ content: null, embeds: [new EmbedBuilder().setTitle(`🎉 Tertangkap! ${species.emoji} ${species.name}`).setDescription(`Cek lewat \`/bag\` atau \`/pokedex\`. Peluang saat itu: ${(chance * 100).toFixed(0)}%`).setColor(0x3ba55d)], components: [] });
          } else {
            currentHpPct = Math.max(0.1, currentHpPct - 0.15);
            await i.update({ embeds: [buildEmbed()], components: [buildRow()] });
            await interaction.followUp({ content: `Yah, ${species.name} meloloskan diri! (Peluang: ${(chance * 100).toFixed(0)}%)`, ephemeral: true });
          }
        });
        collector.on("end", (collected, reason) => {
          if (reason === "time") interaction.editReply({ content: `${species.name} liar pergi.`, embeds: [], components: [] }).catch(() => {});
        });
        break;
      }

      // ---------------- /battle ----------------
      case "battle": {
        const userId = interaction.user.id;
        const pokemons = await getPlayerPokemon(userId);
        const team = pokemons.filter((p) => !p.inBox);
        if (team.length === 0) return interaction.reply({ content: "Tim aktifmu kosong! `/team tambah` dulu, atau `/start` jika belum punya Pokemon.", ephemeral: true });

        const playerInst = team[0];
        const playerSpecies = getSpecies(playerInst.speciesId);
        const playerStats = getComputedStats(playerInst);
        let playerHp = playerStats.hp;

        const wildSpecies = randomWildSpecies();
        const wildLevel = Math.max(1, playerInst.level + Math.floor(Math.random() * 5) - 2);
        const wildStats = getComputedStats({ speciesId: wildSpecies.id, level: wildLevel, ivs: { hp: 12, atk: 12, def: 12, spd: 12 } });
        let wildHp = wildStats.hp;
        const playerMoves = playerSpecies.moves;

        const buildEmbed = (log) =>
          new EmbedBuilder()
            .setTitle(`⚔️ ${formatPokemonLine(playerInst)} VS ${wildSpecies.emoji} ${wildSpecies.name} Lv.${wildLevel}`)
            .setDescription(`**${playerSpecies.name}** HP: ${Math.max(0, playerHp)}/${playerStats.hp}\n**${wildSpecies.name}** HP: ${Math.max(0, wildHp)}/${wildStats.hp}\n\n${log || "Pilih jurus untuk menyerang!"}`)
            .setColor(0xe74c3c);
        const buildRow = () => new ActionRowBuilder().addComponents(playerMoves.map((m) => new ButtonBuilder().setCustomId(`move_${m}`).setLabel(MOVES[m].name).setStyle(ButtonStyle.Danger)));

        const msg = await interaction.reply({ embeds: [buildEmbed()], components: [buildRow()], fetchReply: true });
        const collector = msg.createMessageComponentCollector({ time: 60_000 });

        collector.on("collect", async (i) => {
          if (i.user.id !== userId) return i.reply({ content: "Ini bukan battle milikmu!", ephemeral: true });
          const move = MOVES[i.customId.replace("move_", "")];
          let log = "";
          const playerFirst = playerStats.spd >= wildStats.spd;

          const doPlayerAttack = () => {
            const res = damageRoll(playerStats, move, wildStats, wildSpecies.types);
            if (!res.hit) log += `💨 ${playerSpecies.name} pakai ${move.name} tapi meleset!\n`;
            else {
              wildHp -= res.dmg;
              log += `🗡️ ${playerSpecies.name} pakai ${move.name}, ${res.dmg} damage${res.effectiveness > 1 ? " (Efektif!)" : res.effectiveness < 1 && res.effectiveness > 0 ? " (kurang efektif)" : res.effectiveness === 0 ? " (tidak berefek!)" : ""}.\n`;
            }
          };
          const doWildAttack = () => {
            const wm = MOVES[wildSpecies.moves[Math.floor(Math.random() * wildSpecies.moves.length)]];
            const res = damageRoll(wildStats, wm, playerStats, playerSpecies.types);
            if (!res.hit) log += `💨 ${wildSpecies.name} liar pakai ${wm.name} tapi meleset!\n`;
            else {
              playerHp -= res.dmg;
              log += `💥 ${wildSpecies.name} liar pakai ${wm.name}, ${res.dmg} damage ke ${playerSpecies.name}.\n`;
            }
          };

          if (playerFirst) {
            doPlayerAttack();
            if (wildHp > 0) doWildAttack();
          } else {
            doWildAttack();
            if (playerHp > 0) doPlayerAttack();
          }

          if (wildHp <= 0) {
            collector.stop();
            const expGain = 20 + wildLevel * 5;
            const moneyGain = 30 + wildLevel * 3;
            const leveledUp = addExp(playerInst, expGain);
            await updateInstance(playerInst.instanceId, { exp: playerInst.exp, level: playerInst.level });
            const p = await getPlayer(userId);
            await updatePlayer(userId, { money: p.money + moneyGain, battlesWon: p.battlesWon + 1 });
            log += `\n🎉 ${wildSpecies.name} liar pingsan! Kamu menang!\n+${expGain} EXP, +${moneyGain} koin${leveledUp.length ? `\n⬆️ Naik ke Level ${playerInst.level}!` : ""}`;
            return i.update({ embeds: [buildEmbed(log)], components: [] });
          }
          if (playerHp <= 0) {
            collector.stop();
            const p = await getPlayer(userId);
            await updatePlayer(userId, { battlesLost: p.battlesLost + 1 });
            log += `\n💀 ${playerSpecies.name} pingsan! Kamu kalah.`;
            return i.update({ embeds: [buildEmbed(log)], components: [] });
          }
          await i.update({ embeds: [buildEmbed(log)], components: [buildRow()] });
        });
        collector.on("end", (collected, reason) => {
          if (reason === "time") interaction.editReply({ content: "⏱️ Battle dibatalkan (tidak ada respon).", components: [] }).catch(() => {});
        });
        break;
      }

      // ---------------- /team ----------------
      case "team": {
        const userId = interaction.user.id;
        const sub = interaction.options.getSubcommand();
        const pokemons = await getPlayerPokemon(userId);
        if (sub === "lihat") {
          const team = pokemons.filter((p) => !p.inBox);
          return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`⚔️ Tim Aktif (${team.length}/6)`).setDescription(team.length ? team.map((p) => `\`${p.instanceId}\` ${formatPokemonLine(p)}`).join("\n") : "_Kosong, gunakan /team tambah_").setColor(0x4a90d9)] });
        }
        const instanceId = interaction.options.getString("instance_id");
        const inst = pokemons.find((p) => p.instanceId === instanceId);
        if (!inst) return interaction.reply({ content: "Pokemon dengan ID itu tidak ditemukan.", ephemeral: true });
        if (sub === "tambah") {
          const team = pokemons.filter((p) => !p.inBox);
          if (!inst.inBox) return interaction.reply({ content: "Sudah ada di tim aktif.", ephemeral: true });
          if (team.length >= 6) return interaction.reply({ content: "Tim aktif sudah penuh (6).", ephemeral: true });
          await updateInstance(instanceId, { inBox: false });
          return interaction.reply(`✅ ${formatPokemonLine(inst)} dipindahkan ke tim aktif.`);
        }
        if (sub === "keluarkan") {
          if (inst.inBox) return interaction.reply({ content: "Sudah ada di PC Box.", ephemeral: true });
          await updateInstance(instanceId, { inBox: true });
          return interaction.reply(`📦 ${formatPokemonLine(inst)} dipindahkan ke PC Box.`);
        }
        break;
      }

      // ---------------- /bag ----------------
      case "bag": {
        const target = interaction.options.getUser("user") || interaction.user;
        const player = await getPlayer(target.id);
        const pokemons = await getPlayerPokemon(target.id);
        const itemLines = Object.entries(player.bag).filter(([, q]) => q > 0).map(([k, q]) => `${ITEM_LABEL[k] || k} x${q}`).join("\n") || "_Tidak ada item_";
        const team = pokemons.filter((p) => !p.inBox);
        const box = pokemons.filter((p) => p.inBox);
        const teamLines = team.length ? team.map((p) => `\`${p.instanceId}\` ${formatPokemonLine(p)}`).join("\n") : "_Belum ada Pokemon di tim_";
        const boxLines = box.length ? box.slice(0, 15).map((p) => `\`${p.instanceId}\` ${formatPokemonLine(p)}`).join("\n") + (box.length > 15 ? `\n...dan ${box.length - 15} lainnya` : "") : "_PC Box kosong_";
        const embed = new EmbedBuilder()
          .setTitle(`🎒 Tas ${target.username}`)
          .setColor(0x4a90d9)
          .addFields({ name: "💰 Uang", value: `${player.money}` }, { name: "Item", value: itemLines }, { name: `Tim Aktif (${team.length}/6)`, value: teamLines }, { name: `PC Box (${box.length})`, value: boxLines })
          .setFooter({ text: "Pokemon hasil /give-pokemon masuk ke PC Box di sini." });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      // ---------------- /pokedex ----------------
      case "pokedex": {
        const player = await getPlayer(interaction.user.id);
        const seen = new Set(player.pokedexSeen);
        const caught = new Set(player.pokedexCaught);
        const lines = POKEMON_SPECIES.filter((s) => !s.legendary).map((s) => (caught.has(s.id) ? `✅ #${s.id} ${s.emoji} ${s.name}` : seen.has(s.id) ? `👁️ #${s.id} ${s.emoji} ${s.name} (terlihat)` : `❔ #${s.id} ???`));
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`📖 Pokedex ${interaction.user.username}`).setDescription(lines.join("\n")).setFooter({ text: `Tertangkap: ${caught.size} • Terlihat: ${seen.size}` }).setColor(0xcc3333)] });
        break;
      }

      // ---------------- /profile ----------------
      case "profile": {
        const target = interaction.options.getUser("user") || interaction.user;
        const player = await getPlayer(target.id);
        const pokemons = await getPlayerPokemon(target.id);
        const embed = new EmbedBuilder()
          .setTitle(`🧢 Profil Trainer ${target.username}`)
          .setThumbnail(target.displayAvatarURL())
          .setColor(0x9b59b6)
          .addFields(
            { name: "💰 Uang", value: `${player.money}`, inline: true },
            { name: "🎮 Total Pokemon", value: `${pokemons.length}`, inline: true },
            { name: "📖 Tertangkap Unik", value: `${player.pokedexCaught.length}`, inline: true },
            { name: "🏆 Menang", value: `${player.battlesWon}`, inline: true },
            { name: "💀 Kalah", value: `${player.battlesLost}`, inline: true },
            { name: "📅 Mulai Bermain", value: `<t:${Math.floor(new Date(player.createdAt).getTime() / 1000)}:R>`, inline: true }
          );
        await interaction.reply({ embeds: [embed] });
        break;
      }

      // ---------------- /shop ----------------
      case "shop": {
        const player = await getPlayer(interaction.user.id);
        const lines = Object.entries(SHOP_ITEMS).map(([k, it]) => `${it.label} — **${it.price}** koin (\`/buy item:${k}\`)`);
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🛒 Poke Mart").setDescription(lines.join("\n")).setFooter({ text: `Uangmu: ${player.money} koin` }).setColor(0xf1c40f)] });
        break;
      }

      // ---------------- /buy ----------------
      case "buy": {
        const itemKey = interaction.options.getString("item");
        const qty = interaction.options.getInteger("jumlah") || 1;
        const item = SHOP_ITEMS[itemKey];
        if (!item) return interaction.reply({ content: "Item tidak valid.", ephemeral: true });
        const totalPrice = item.price * qty;
        const player = await getPlayer(interaction.user.id);
        if (player.money < totalPrice) return interaction.reply({ content: `Uang tidak cukup! Butuh ${totalPrice}, kamu punya ${player.money}.`, ephemeral: true });
        const newBag = { ...player.bag, [itemKey]: (player.bag[itemKey] || 0) + qty };
        await updatePlayer(interaction.user.id, { money: player.money - totalPrice, bag: newBag });
        await interaction.reply(`✅ Membeli ${qty}x ${item.label} seharga ${totalPrice} koin. Sisa: ${player.money - totalPrice}.`);
        break;
      }

      // ---------------- /release ----------------
      case "release": {
        const userId = interaction.user.id;
        const instanceId = interaction.options.getString("instance_id");
        const pokemons = await getPlayerPokemon(userId);
        const inst = pokemons.find((p) => p.instanceId === instanceId);
        if (!inst) return interaction.reply({ content: "Pokemon dengan ID itu tidak ditemukan.", ephemeral: true });
        const line = formatPokemonLine(inst);
        await deleteInstance(instanceId);
        await interaction.reply(`👋 Kamu melepaskan ${line} kembali ke alam liar.`);
        break;
      }

      // ---------------- /nickname ----------------
      case "nickname": {
        const userId = interaction.user.id;
        const instanceId = interaction.options.getString("instance_id");
        const nama = interaction.options.getString("nama");
        const pokemons = await getPlayerPokemon(userId);
        const inst = pokemons.find((p) => p.instanceId === instanceId);
        if (!inst) return interaction.reply({ content: "Pokemon dengan ID itu tidak ditemukan.", ephemeral: true });
        await updateInstance(instanceId, { nickname: nama });
        await interaction.reply(`✅ ${getSpecies(inst.speciesId).name} sekarang dipanggil **${nama}**!`);
        break;
      }

      // ============================= ADMIN =============================
      case "rollback": {
        if (!(await requireAdmin(interaction))) break;
        const jumlah = interaction.options.getInteger("jumlah");
        const satuan = interaction.options.getString("satuan");
        const multiplier = satuan === "jam" ? 3600 : satuan === "menit" ? 60 : 1;
        await interaction.deferReply();
        try {
          const result = await rollbackBySeconds(jumlah * multiplier);
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle("⏪ Rollback Berhasil")
                .setDescription(`Data dikembalikan ke sekitar **${jumlah} ${satuan} lalu**.\nTarget: <t:${Math.floor(result.targetDate.getTime() / 1000)}:F>\nSnapshot dipakai: <t:${Math.floor(new Date(result.snapshotAt).getTime() / 1000)}:F>`)
                .setColor(0xe67e22),
            ],
          });
        } catch (e) {
          await interaction.editReply({ content: `❌ Gagal rollback: ${e.message}` });
        }
        break;
      }

      case "inspect-profile": {
        if (!(await requireAdmin(interaction))) break;
        const target = interaction.options.getUser("user");
        if (!(await playerExists(target.id))) return interaction.reply({ content: "Player belum punya data (belum `/start`).", ephemeral: true });
        const player = await getPlayer(target.id);
        const pokemons = await getPlayerPokemon(target.id);
        const team = pokemons.filter((p) => !p.inBox);
        const box = pokemons.filter((p) => p.inBox);
        const detailedTeam = team.map((p) => `\`${p.instanceId}\` ${formatPokemonLine(p)} | IV(hp${p.ivs.hp}/atk${p.ivs.atk}/def${p.ivs.def}/spd${p.ivs.spd}) | EXP:${p.exp}`).join("\n") || "_kosong_";
        const embed = new EmbedBuilder()
          .setTitle(`🔍 Inspect Profile: ${target.username} (${target.id})`)
          .setColor(0x2c3e50)
          .addFields(
            { name: "Uang", value: `${player.money}`, inline: true },
            { name: "Total Pokemon", value: `${pokemons.length} (Tim:${team.length}, Box:${box.length})`, inline: true },
            { name: "Menang/Kalah", value: `${player.battlesWon}/${player.battlesLost}`, inline: true },
            { name: "Pokedex Seen/Caught", value: `${player.pokedexSeen.length}/${player.pokedexCaught.length}`, inline: true },
            { name: "Dibuat", value: `<t:${Math.floor(new Date(player.createdAt).getTime() / 1000)}:F>`, inline: true },
            { name: "Bag (raw JSON)", value: "```json\n" + JSON.stringify(player.bag, null, 2).slice(0, 900) + "\n```" },
            { name: "Tim Aktif Detail", value: detailedTeam.slice(0, 1000) }
          );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case "reset-game": {
        if (!(await requireAdmin(interaction))) break;
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("confirm_reset_game").setLabel("Ya, Reset Semua Data").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("cancel_reset_game").setLabel("Batal").setStyle(ButtonStyle.Secondary)
        );
        const msg = await interaction.reply({
          embeds: [new EmbedBuilder().setTitle("⚠️ Konfirmasi Reset Game").setDescription("Menghapus SELURUH data player & Pokemon. Snapshot otomatis dibuat dulu, masih bisa `/rollback`. Lanjutkan?").setColor(0xe74c3c)],
          components: [row],
          fetchReply: true,
        });
        const collector = msg.createMessageComponentCollector({ time: 30_000, max: 1 });
        collector.on("collect", async (i) => {
          if (i.user.id !== interaction.user.id) return i.reply({ content: "Bukan konfirmasi milikmu.", ephemeral: true });
          if (i.customId === "cancel_reset_game") return i.update({ content: "Reset dibatalkan.", embeds: [], components: [] });
          await resetGame();
          await i.update({ content: "✅ Seluruh data game berhasil direset.", embeds: [], components: [] });
        });
        collector.on("end", (collected) => {
          if (collected.size === 0) interaction.editReply({ content: "⏱️ Konfirmasi kedaluwarsa.", embeds: [], components: [] }).catch(() => {});
        });
        break;
      }

      case "reset-data": {
        if (!(await requireAdmin(interaction))) break;
        if (interaction.options.getSubcommand() === "player") {
          const target = interaction.options.getUser("user");
          if (!(await playerExists(target.id))) return interaction.reply({ content: "Player tidak punya data.", ephemeral: true });
          await resetPlayer(target.id);
          await interaction.reply(`✅ Data **${target.username}** berhasil dihapus. Bisa di-\`/rollback\` jika perlu.`);
        }
        break;
      }

      case "give-pokemon": {
        if (!(await requireAdmin(interaction))) break;
        const target = interaction.options.getUser("user");
        const namaPokemon = interaction.options.getString("nama_pokemon");
        const level = interaction.options.getInteger("level") || 5;
        const shinyOpt = interaction.options.getBoolean("shiny");
        const species = getSpeciesByName(namaPokemon);
        if (!species) return interaction.reply({ content: `Spesies "${namaPokemon}" tidak ditemukan. Daftar valid:\n${POKEMON_SPECIES.map((s) => s.name).join(", ")}`, ephemeral: true });
        await getPlayer(target.id);
        const instance = await createPokemonInstance(species.id, level, target.id, { inBox: true, shiny: shinyOpt === null ? undefined : shinyOpt });
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("🎁 Pokemon Diberikan!")
              .setDescription(`${formatPokemonLine(instance)} diberikan ke **${target.username}**.\nMasuk ke **PC Box**, cek lewat \`/bag\` lalu \`/team tambah instance_id:${instance.instanceId}\`.`)
              .setColor(0x9b59b6),
          ],
        });
        break;
      }

      case "give-item": {
        if (!(await requireAdmin(interaction))) break;
        const target = interaction.options.getUser("user");
        const item = interaction.options.getString("item");
        const jumlah = interaction.options.getInteger("jumlah");
        const player = await getPlayer(target.id);
        const newBag = { ...player.bag, [item]: (player.bag[item] || 0) + jumlah };
        await updatePlayer(target.id, { bag: newBag });
        await interaction.reply(`✅ Memberikan ${jumlah}x ${ITEM_LABEL[item]} ke **${target.username}**. Cek \`/bag\`.`);
        break;
      }

      case "give-money": {
        if (!(await requireAdmin(interaction))) break;
        const target = interaction.options.getUser("user");
        const jumlah = interaction.options.getInteger("jumlah");
        const player = await getPlayer(target.id);
        const newMoney = Math.max(0, player.money + jumlah);
        await updatePlayer(target.id, { money: newMoney });
        await interaction.reply(`✅ Uang **${target.username}** sekarang **${newMoney}** koin (${jumlah >= 0 ? "+" : ""}${jumlah}).`);
        break;
      }

      case "set-level": {
        if (!(await requireAdmin(interaction))) break;
        const instanceId = interaction.options.getString("instance_id");
        const level = interaction.options.getInteger("level");
        const inst = await getInstance(instanceId);
        if (!inst) return interaction.reply({ content: "Instance Pokemon tidak ditemukan.", ephemeral: true });
        await updateInstance(instanceId, { level });
        await interaction.reply(`✅ Level diubah: ${formatPokemonLine(await getInstance(instanceId))}`);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Error pada /${commandName}:`, err);
    const embed = new EmbedBuilder().setTitle("❌ Terjadi Kesalahan").setDescription("Ada error saat menjalankan command ini.").setColor(0xe74c3c);
    if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [embed] }).catch(() => {});
    else await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
  }
});

// =============================================================================
// 7. START
// =============================================================================

(async () => {
  await bootstrapSchema();
  await client.login(process.env.DISCORD_TOKEN);
})().catch((e) => {
  console.error("Gagal start bot:", e);
  process.exit(1);
});
