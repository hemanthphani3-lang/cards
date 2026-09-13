/**
 * API & Storage Provider Abstraction
 * Handles dual-mode operations:
 * 1. Google Apps Script Web App API (if URL is set in Settings)
 * 2. LocalStorage Fallback (if offline or URL not set)
 */

const GAS_URL_KEY = 'card_scorekeeper_gas_url';
const LOCAL_STORAGE_GAMES_KEY = 'card_scorekeeper_games';
const LOCAL_STORAGE_PLAYERS_KEY = 'card_scorekeeper_players';
const LOCAL_STORAGE_SCORES_KEY = 'card_scorekeeper_scores';

export function getGasUrl() {
  const envUrl = import.meta.env.VITE_GAS_URL;
  return localStorage.getItem(GAS_URL_KEY) || (envUrl ? envUrl.trim() : '');
}

export function setGasUrl(url) {
  if (url) {
    localStorage.setItem(GAS_URL_KEY, url.trim());
  } else {
    localStorage.removeItem(GAS_URL_KEY);
  }
}

// ----------------------------------------------------------------------------
// LOCAL STORAGE PROVIDER (Works offline / without GAS)
// ----------------------------------------------------------------------------

function getLocalData(key) {
  const json = localStorage.getItem(key);
  return json ? JSON.parse(json) : null;
}

function setLocalData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function initLocalDataIfEmpty() {
  let games = getLocalData(LOCAL_STORAGE_GAMES_KEY);
  if (!games) {
    const now = new Date().toISOString();

    const sampleGame = {
      game_id: 'G_sample_1',
      game_name: 'Friday Cards',
      max_score: 100,
      status: 'active',
      created_at: now,
      updated_at: now
    };

    const samplePlayers = [
      { player_id: 'P_1', game_id: 'G_sample_1', player_name: 'Rahul', status: 'active', created_at: now, updated_at: now },
      { player_id: 'P_2', game_id: 'G_sample_1', player_name: 'Arjun', status: 'active', created_at: now, updated_at: now },
      { player_id: 'P_3', game_id: 'G_sample_1', player_name: 'Kiran', status: 'active', created_at: now, updated_at: now }
    ];

    const sampleScores = [
      { score_id: 'S_1', game_id: 'G_sample_1', round_number: 1, player_id: 'P_1', score: 5, created_at: now, updated_at: now },
      { score_id: 'S_2', game_id: 'G_sample_1', round_number: 1, player_id: 'P_2', score: 10, created_at: now, updated_at: now },
      { score_id: 'S_3', game_id: 'G_sample_1', round_number: 1, player_id: 'P_3', score: 12, created_at: now, updated_at: now },
      { score_id: 'S_4', game_id: 'G_sample_1', round_number: 2, player_id: 'P_1', score: 8, created_at: now, updated_at: now },
      { score_id: 'S_5', game_id: 'G_sample_1', round_number: 2, player_id: 'P_2', score: 4, created_at: now, updated_at: now },
      { score_id: 'S_6', game_id: 'G_sample_1', round_number: 2, player_id: 'P_3', score: 11, created_at: now, updated_at: now }
    ];

    setLocalData(LOCAL_STORAGE_GAMES_KEY, [sampleGame]);
    setLocalData(LOCAL_STORAGE_PLAYERS_KEY, samplePlayers);
    setLocalData(LOCAL_STORAGE_SCORES_KEY, sampleScores);
  }
}

const LocalStorageProvider = {
  async getGames() {
    initLocalDataIfEmpty();
    const games = getLocalData(LOCAL_STORAGE_GAMES_KEY) || [];
    const players = getLocalData(LOCAL_STORAGE_PLAYERS_KEY) || [];
    const scores = getLocalData(LOCAL_STORAGE_SCORES_KEY) || [];

    return games.map(g => {
      const activePlayers = players.filter(p => p.game_id === g.game_id && p.status !== 'removed');
      const gameScores = scores.filter(s => s.game_id === g.game_id);
      const rounds = new Set(gameScores.map(s => s.round_number)).size;

      return {
        ...g,
        player_count: activePlayers.length,
        round_count: rounds
      };
    });
  },

  async getGame(gameId) {
    initLocalDataIfEmpty();
    const games = getLocalData(LOCAL_STORAGE_GAMES_KEY) || [];
    const players = getLocalData(LOCAL_STORAGE_PLAYERS_KEY) || [];
    const scores = getLocalData(LOCAL_STORAGE_SCORES_KEY) || [];

    const game = games.find(g => g.game_id === gameId);
    if (!game) throw new Error('Game not found');

    const activePlayers = players.filter(p => p.game_id === gameId && p.status !== 'removed');
    const gameScores = scores.filter(s => s.game_id === gameId);

    return { game, players: activePlayers, scores: gameScores };
  },

  async createGame({ game_name, max_score, players }) {
    initLocalDataIfEmpty();
    const games = getLocalData(LOCAL_STORAGE_GAMES_KEY) || [];
    const allPlayers = getLocalData(LOCAL_STORAGE_PLAYERS_KEY) || [];

    const now = new Date().toISOString();
    const gameId = 'G_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    const newGame = {
      game_id: gameId,
      game_name: game_name.trim(),
      max_score: Number(max_score) || 100,
      status: 'active',
      created_at: now,
      updated_at: now
    };

    const newPlayers = players.map(pName => ({
      player_id: 'P_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      game_id: gameId,
      player_name: pName.trim(),
      status: 'active',
      created_at: now,
      updated_at: now
    }));

    games.unshift(newGame);
    setLocalData(LOCAL_STORAGE_GAMES_KEY, games);
    setLocalData(LOCAL_STORAGE_PLAYERS_KEY, [...allPlayers, ...newPlayers]);

    return { game: newGame, players: newPlayers, scores: [] };
  },

  async updateGame({ game_id, game_name, max_score, status }) {
    const games = getLocalData(LOCAL_STORAGE_GAMES_KEY) || [];
    const game = games.find(g => g.game_id === game_id);
    if (game) {
      if (game_name !== undefined) game.game_name = game_name.trim();
      if (max_score !== undefined) game.max_score = Number(max_score);
      if (status !== undefined) game.status = status;
      game.updated_at = new Date().toISOString();
      setLocalData(LOCAL_STORAGE_GAMES_KEY, games);
    }
    return this.getGame(game_id);
  },

  async archiveGame(gameId) {
    return this.updateGame({ game_id: gameId, status: 'completed' });
  },

  async addPlayer({ game_id, player_name }) {
    const players = getLocalData(LOCAL_STORAGE_PLAYERS_KEY) || [];
    const now = new Date().toISOString();
    const newPlayer = {
      player_id: 'P_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      game_id,
      player_name: player_name.trim(),
      status: 'active',
      created_at: now,
      updated_at: now
    };

    players.push(newPlayer);
    setLocalData(LOCAL_STORAGE_PLAYERS_KEY, players);
    return newPlayer;
  },

  async renamePlayer({ player_id, player_name }) {
    const players = getLocalData(LOCAL_STORAGE_PLAYERS_KEY) || [];
    const player = players.find(p => p.player_id === player_id);
    if (player) {
      player.player_name = player_name.trim();
      player.updated_at = new Date().toISOString();
      setLocalData(LOCAL_STORAGE_PLAYERS_KEY, players);
    }
    return player;
  },

  async removePlayer({ player_id }) {
    const players = getLocalData(LOCAL_STORAGE_PLAYERS_KEY) || [];
    const player = players.find(p => p.player_id === player_id);
    if (player) {
      player.status = 'removed';
      player.updated_at = new Date().toISOString();
      setLocalData(LOCAL_STORAGE_PLAYERS_KEY, players);
    }
    return player;
  },

  async addRound({ game_id, scores }) {
    const allScores = getLocalData(LOCAL_STORAGE_SCORES_KEY) || [];
    const gameScores = allScores.filter(s => s.game_id === game_id);

    const maxRound = gameScores.reduce((max, s) => Math.max(max, Number(s.round_number) || 0), 0);
    const nextRound = maxRound + 1;
    const now = new Date().toISOString();

    const newScores = scores.map(sc => ({
      score_id: 'S_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      game_id,
      round_number: nextRound,
      player_id: sc.player_id,
      score: Number(sc.score) || 0,
      created_at: now,
      updated_at: now
    }));

    setLocalData(LOCAL_STORAGE_SCORES_KEY, [...allScores, ...newScores]);
    return { round_number: nextRound, scores: newScores };
  },

  async updateScore({ game_id, round_number, player_id, score }) {
    const scores = getLocalData(LOCAL_STORAGE_SCORES_KEY) || [];
    const roundNum = Number(round_number);
    const scoreVal = Number(score);

    let existing = scores.find(s => s.game_id === game_id && Number(s.round_number) === roundNum && s.player_id === player_id);
    const now = new Date().toISOString();

    if (existing) {
      existing.score = scoreVal;
      existing.updated_at = now;
    } else {
      existing = {
        score_id: 'S_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        game_id,
        round_number: roundNum,
        player_id,
        score: scoreVal,
        created_at: now,
        updated_at: now
      };
      scores.push(existing);
    }

    setLocalData(LOCAL_STORAGE_SCORES_KEY, scores);
    return existing;
  },

  async deleteRound({ game_id, round_number }) {
    let scores = getLocalData(LOCAL_STORAGE_SCORES_KEY) || [];
    const roundNum = Number(round_number);

    scores = scores.filter(s => !(s.game_id === game_id && Number(s.round_number) === roundNum));
    setLocalData(LOCAL_STORAGE_SCORES_KEY, scores);
    return { deleted_round: roundNum };
  }
};

// ----------------------------------------------------------------------------
// GOOGLE APPS SCRIPT API PROVIDER
// ----------------------------------------------------------------------------

async function callGasApi(action, payload = {}) {
  const url = getGasUrl();
  if (!url) throw new Error("Google Apps Script URL is not configured");

  const fullPayload = { action, ...payload };

  try {
    // We send payload as GET parameter 'data' or POST JSON
    // GET with URL query is most reliable across CORS without preflight issues
    const queryUrl = `${url}?action=${encodeURIComponent(action)}&data=${encodeURIComponent(JSON.stringify(fullPayload))}`;

    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Server error occurred');
    }

    return data.data;
  } catch (err) {
    console.warn(`GAS API call '${action}' failed, falling back to local storage:`, err);
    throw err;
  }
}

const GasStorageProvider = {
  getGames: () => callGasApi('getGames'),
  getGame: (gameId) => callGasApi('getGame', { game_id: gameId }),
  createGame: (params) => callGasApi('createGame', params),
  updateGame: (params) => callGasApi('updateGame', params),
  archiveGame: (gameId) => callGasApi('archiveGame', { game_id: gameId }),
  addPlayer: (params) => callGasApi('addPlayer', params),
  renamePlayer: (params) => callGasApi('renamePlayer', params),
  removePlayer: (params) => callGasApi('removePlayer', params),
  addRound: (params) => callGasApi('addRound', params),
  updateScore: (params) => callGasApi('updateScore', params),
  deleteRound: (params) => callGasApi('deleteRound', params)
};

// ----------------------------------------------------------------------------
// UNIFIED STORAGE INTERFACE
// ----------------------------------------------------------------------------

export async function pingGasUrl(url) {
  const queryUrl = `${url}?action=ping`;
  const res = await fetch(queryUrl, { method: 'GET' });
  const json = await res.json();
  return json && json.success;
}

export const Api = new Proxy({}, {
  get(target, prop) {
    return async function(...args) {
      const gasUrl = getGasUrl();
      if (gasUrl && GasStorageProvider[prop]) {
        try {
          return await GasStorageProvider[prop](...args);
        } catch (err) {
          console.warn("GAS execution failed, attempting local fallback:", err);
          return await LocalStorageProvider[prop](...args);
        }
      }
      return await LocalStorageProvider[prop](...args);
    };
  }
});
