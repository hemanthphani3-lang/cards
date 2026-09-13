/**
 * ============================================================================
 * CARD GAME SCOREKEEPER - GOOGLE APPS SCRIPT BACKEND
 * ============================================================================
 * Instructions:
 * 1. Open Google Sheets (https://sheets.new)
 * 2. Click Extensions > Apps Script
 * 3. Delete any code in Code.gs and paste this ENTIRE file into Code.gs
 * 4. Click Deploy > New deployment
 * 5. Select type: "Web app"
 * 6. Execute as: "Me"
 * 7. Who has access: "Anyone" (or "Anyone with Google account")
 * 8. Click "Deploy", authorize permissions, and copy the Web App URL!
 * 9. Paste the Web App URL into the Card Scorekeeper app Settings.
 * ============================================================================
 */

// Helper to format JSON response
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Generate unique ID with prefix
function generateId(prefix) {
  return prefix + '_' + new Date().getTime().toString(36) + Math.random().toString(36).substring(2, 7);
}

// Auto-initialize normalized sheets & headers if missing
function setupSheets(ss) {
  var sheets = {
    'Games': ['game_id', 'game_name', 'max_score', 'status', 'created_at', 'updated_at'],
    'Players': ['player_id', 'game_id', 'player_name', 'status', 'created_at', 'updated_at'],
    'Scores': ['score_id', 'game_id', 'round_number', 'player_id', 'score', 'created_at', 'updated_at']
  };

  for (var name in sheets) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(sheets[name]);
      sheet.getRange(1, 1, 1, sheets[name].length).setFontWeight('bold');
    }
  }

  // Remove default Sheet1 if custom sheets exist
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }
}

// Main HTTP GET entrypoint
function doGet(e) {
  return handleRequest(e);
}

// Main HTTP POST entrypoint
function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.tryLock(10000);
  } catch (err) {
    return jsonResponse({ success: false, error: "Server busy, please try again." });
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    setupSheets(ss);

    // Extract payload from GET query params or POST body
    var params = {};
    if (e && e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (ex) {
        params = e.parameter || {};
      }
    } else if (e && e.parameter) {
      params = e.parameter;
      if (params.data) {
        try { params = JSON.parse(params.data); } catch(ex) {}
      }
    }

    var action = params.action;
    if (!action) {
      return jsonResponse({ success: true, message: "Card Game Scorekeeper API is online!" });
    }

    var result;
    switch (action) {
      case 'ping':
        result = { pong: true, time: new Date().toISOString() };
        break;
      case 'getGames':
        result = getGames(ss);
        break;
      case 'getGame':
        result = getGame(ss, params.game_id);
        break;
      case 'createGame':
        result = createGame(ss, params);
        break;
      case 'updateGame':
        result = updateGame(ss, params);
        break;
      case 'archiveGame':
        result = archiveGame(ss, params.game_id);
        break;
      case 'addPlayer':
        result = addPlayer(ss, params);
        break;
      case 'renamePlayer':
        result = renamePlayer(ss, params);
        break;
      case 'removePlayer':
        result = removePlayer(ss, params);
        break;
      case 'addRound':
        result = addRound(ss, params);
        break;
      case 'updateScore':
        result = updateScore(ss, params);
        break;
      case 'deleteRound':
        result = deleteRound(ss, params);
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }

    return jsonResponse({ success: true, data: result });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message || String(error) });
  } finally {
    lock.releaseLock();
  }
}

// ----------------------------------------------------------------------------
// HANDLERS
// ----------------------------------------------------------------------------

function getGames(ss) {
  var gamesSheet = ss.getSheetByName('Games');
  var playersSheet = ss.getSheetByName('Players');
  var scoresSheet = ss.getSheetByName('Scores');

  var gamesData = getSheetRows(gamesSheet);
  var playersData = getSheetRows(playersSheet);
  var scoresData = getSheetRows(scoresSheet);

  var gamesList = gamesData.map(function(g) {
    var activePlayers = playersData.filter(function(p) {
      return p.game_id === g.game_id && p.status !== 'removed';
    });

    var gameScores = scoresData.filter(function(s) {
      return s.game_id === g.game_id;
    });

    var roundsSet = {};
    gameScores.forEach(function(s) { roundsSet[s.round_number] = true; });
    var roundCount = Object.keys(roundsSet).length;

    return {
      game_id: g.game_id,
      game_name: g.game_name,
      max_score: Number(g.max_score) || 100,
      status: g.status || 'active',
      created_at: g.created_at,
      updated_at: g.updated_at,
      player_count: activePlayers.length,
      round_count: roundCount
    };
  });

  return gamesList;
}

function getGame(ss, game_id) {
  if (!game_id) throw new Error("game_id is required");

  var gamesSheet = ss.getSheetByName('Games');
  var playersSheet = ss.getSheetByName('Players');
  var scoresSheet = ss.getSheetByName('Scores');

  var games = getSheetRows(gamesSheet);
  var game = games.find(function(g) { return g.game_id === game_id; });
  if (!game) throw new Error("Game not found: " + game_id);

  var players = getSheetRows(playersSheet).filter(function(p) {
    return p.game_id === game_id && p.status !== 'removed';
  });

  var scores = getSheetRows(scoresSheet).filter(function(s) {
    return s.game_id === game_id;
  }).map(function(s) {
    return {
      score_id: s.score_id,
      game_id: s.game_id,
      round_number: Number(s.round_number),
      player_id: s.player_id,
      score: Number(s.score),
      created_at: s.created_at,
      updated_at: s.updated_at
    };
  });

  return {
    game: {
      game_id: game.game_id,
      game_name: game.game_name,
      max_score: Number(game.max_score) || 100,
      status: game.status || 'active',
      created_at: game.created_at,
      updated_at: game.updated_at
    },
    players: players,
    scores: scores
  };
}

function createGame(ss, params) {
  var name = (params.game_name || '').trim();
  var maxScore = Number(params.max_score);
  var players = params.players || [];

  if (!name) throw new Error("Game name is required");
  if (isNaN(maxScore) || maxScore <= 0) throw new Error("Maximum score must be a positive number");
  if (!Array.isArray(players) || players.length < 2) throw new Error("At least 2 players are required");

  var now = new Date().toISOString();
  var gameId = generateId('G');

  var gamesSheet = ss.getSheetByName('Games');
  gamesSheet.appendRow([gameId, name, maxScore, 'active', now, now]);

  var playersSheet = ss.getSheetByName('Players');
  var createdPlayers = [];

  players.forEach(function(pName) {
    var trimmed = String(pName || '').trim();
    if (trimmed) {
      var playerId = generateId('P');
      playersSheet.appendRow([playerId, gameId, trimmed, 'active', now, now]);
      createdPlayers.push({
        player_id: playerId,
        game_id: gameId,
        player_name: trimmed,
        status: 'active',
        created_at: now,
        updated_at: now
      });
    }
  });

  return {
    game: {
      game_id: gameId,
      game_name: name,
      max_score: maxScore,
      status: 'active',
      created_at: now,
      updated_at: now
    },
    players: createdPlayers,
    scores: []
  };
}

function updateGame(ss, params) {
  var gameId = params.game_id;
  if (!gameId) throw new Error("game_id is required");

  var gamesSheet = ss.getSheetByName('Games');
  var rows = gamesSheet.getDataRange().getValues();
  var headers = rows[0];
  var gameIdIdx = headers.indexOf('game_id');

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][gameIdIdx] === gameId) {
      var now = new Date().toISOString();
      if (params.game_name !== undefined) gamesSheet.getRange(i + 1, headers.indexOf('game_name') + 1).setValue(params.game_name.trim());
      if (params.max_score !== undefined) gamesSheet.getRange(i + 1, headers.indexOf('max_score') + 1).setValue(Number(params.max_score));
      if (params.status !== undefined) gamesSheet.getRange(i + 1, headers.indexOf('status') + 1).setValue(params.status);
      gamesSheet.getRange(i + 1, headers.indexOf('updated_at') + 1).setValue(now);
      break;
    }
  }

  return getGame(ss, gameId);
}

function archiveGame(ss, gameId) {
  return updateGame(ss, { game_id: gameId, status: 'completed' });
}

function addPlayer(ss, params) {
  var gameId = params.game_id;
  var name = (params.player_name || '').trim();
  if (!gameId || !name) throw new Error("game_id and player_name are required");

  var now = new Date().toISOString();
  var playerId = generateId('P');

  var playersSheet = ss.getSheetByName('Players');
  playersSheet.appendRow([playerId, gameId, name, 'active', now, now]);

  touchGame(ss, gameId);

  return {
    player_id: playerId,
    game_id: gameId,
    player_name: name,
    status: 'active',
    created_at: now,
    updated_at: now
  };
}

function renamePlayer(ss, params) {
  var playerId = params.player_id;
  var newName = (params.player_name || '').trim();
  if (!playerId || !newName) throw new Error("player_id and player_name are required");

  var playersSheet = ss.getSheetByName('Players');
  var rows = playersSheet.getDataRange().getValues();
  var headers = rows[0];
  var pIdIdx = headers.indexOf('player_id');

  var gameId = null;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][pIdIdx] === playerId) {
      var now = new Date().toISOString();
      playersSheet.getRange(i + 1, headers.indexOf('player_name') + 1).setValue(newName);
      playersSheet.getRange(i + 1, headers.indexOf('updated_at') + 1).setValue(now);
      gameId = rows[i][headers.indexOf('game_id')];
      break;
    }
  }

  if (gameId) touchGame(ss, gameId);
  return { player_id: playerId, player_name: newName };
}

function removePlayer(ss, params) {
  var playerId = params.player_id;
  if (!playerId) throw new Error("player_id is required");

  var playersSheet = ss.getSheetByName('Players');
  var rows = playersSheet.getDataRange().getValues();
  var headers = rows[0];
  var pIdIdx = headers.indexOf('player_id');

  var gameId = null;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][pIdIdx] === playerId) {
      var now = new Date().toISOString();
      playersSheet.getRange(i + 1, headers.indexOf('status') + 1).setValue('removed');
      playersSheet.getRange(i + 1, headers.indexOf('updated_at') + 1).setValue(now);
      gameId = rows[i][headers.indexOf('game_id')];
      break;
    }
  }

  if (gameId) touchGame(ss, gameId);
  return { player_id: playerId, status: 'removed' };
}

function addRound(ss, params) {
  var gameId = params.game_id;
  var scores = params.scores; // Array of { player_id, score }
  if (!gameId || !Array.isArray(scores)) throw new Error("game_id and scores array are required");

  var scoresSheet = ss.getSheetByName('Scores');
  var existingScores = getSheetRows(scoresSheet).filter(function(s) { return s.game_id === gameId; });

  // Calculate next round number
  var maxRound = 0;
  existingScores.forEach(function(s) {
    var r = Number(s.round_number);
    if (r > maxRound) maxRound = r;
  });
  var roundNum = maxRound + 1;
  var now = new Date().toISOString();

  var inserted = [];
  scores.forEach(function(sc) {
    var val = Number(sc.score);
    if (isNaN(val)) throw new Error("Invalid score for player " + sc.player_id);
    var scoreId = generateId('S');
    scoresSheet.appendRow([scoreId, gameId, roundNum, sc.player_id, val, now, now]);
    inserted.push({
      score_id: scoreId,
      game_id: gameId,
      round_number: roundNum,
      player_id: sc.player_id,
      score: val,
      created_at: now,
      updated_at: now
    });
  });

  touchGame(ss, gameId);
  return { round_number: roundNum, scores: inserted };
}

function updateScore(ss, params) {
  var gameId = params.game_id;
  var roundNumber = Number(params.round_number);
  var playerId = params.player_id;
  var newScore = Number(params.score);

  if (!gameId || isNaN(roundNumber) || !playerId || isNaN(newScore)) {
    throw new Error("game_id, round_number, player_id, and score are required");
  }

  var scoresSheet = ss.getSheetByName('Scores');
  var rows = scoresSheet.getDataRange().getValues();
  var headers = rows[0];
  var gIdx = headers.indexOf('game_id');
  var rIdx = headers.indexOf('round_number');
  var pIdx = headers.indexOf('player_id');

  var found = false;
  var now = new Date().toISOString();

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][gIdx] === gameId && Number(rows[i][rIdx]) === roundNumber && rows[i][pIdx] === playerId) {
      scoresSheet.getRange(i + 1, headers.indexOf('score') + 1).setValue(newScore);
      scoresSheet.getRange(i + 1, headers.indexOf('updated_at') + 1).setValue(now);
      found = true;
      break;
    }
  }

  if (!found) {
    var scoreId = generateId('S');
    scoresSheet.appendRow([scoreId, gameId, roundNumber, playerId, newScore, now, now]);
  }

  touchGame(ss, gameId);
  return { game_id: gameId, round_number: roundNumber, player_id: playerId, score: newScore };
}

function deleteRound(ss, params) {
  var gameId = params.game_id;
  var roundNumber = Number(params.round_number);
  if (!gameId || isNaN(roundNumber)) throw new Error("game_id and round_number are required");

  var scoresSheet = ss.getSheetByName('Scores');
  var rows = scoresSheet.getDataRange().getValues();
  var headers = rows[0];
  var gIdx = headers.indexOf('game_id');
  var rIdx = headers.indexOf('round_number');

  // Delete from bottom up to avoid index shifting problems
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][gIdx] === gameId && Number(rows[i][rIdx]) === roundNumber) {
      scoresSheet.deleteRow(i + 1);
    }
  }

  touchGame(ss, gameId);
  return { deleted_round: roundNumber };
}

// ----------------------------------------------------------------------------
// UTILITY HELPERS
// ----------------------------------------------------------------------------

function getSheetRows(sheet) {
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var results = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    results.push(obj);
  }
  return results;
}

function touchGame(ss, gameId) {
  var gamesSheet = ss.getSheetByName('Games');
  var rows = gamesSheet.getDataRange().getValues();
  var headers = rows[0];
  var gIdx = headers.indexOf('game_id');
  var uIdx = headers.indexOf('updated_at');

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][gIdx] === gameId) {
      gamesSheet.getRange(i + 1, uIdx + 1).setValue(new Date().toISOString());
      break;
    }
  }
}
