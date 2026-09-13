/**
 * Central State Management & Event Bus
 */
import { calculatePlayerTotals, evaluateRankings } from './ranking.js';
import { Api } from './api.js';

class AppState {
  constructor() {
    this.gamesList = [];
    this.activeGameId = null;
    this.activeGameData = null; // { game, players, scores }
    this.totalsMap = {};
    this.rankings = {};
    this.isLoading = false;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, data) {
    this.listeners.forEach(fn => fn(event, data, this));
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.notify('loadingChanged', loading);
  }

  async loadGamesList() {
    this.setLoading(true);
    try {
      this.gamesList = await Api.getGames();
      this.notify('gamesListUpdated', this.gamesList);
    } catch (err) {
      console.error('Failed to load games:', err);
      this.notify('error', 'Could not load games list.');
    } finally {
      this.setLoading(false);
    }
  }

  async loadActiveGame(gameId) {
    this.setLoading(true);
    this.activeGameId = gameId;
    try {
      const data = await Api.getGame(gameId);
      this.activeGameData = data;

      // Auto-create Round 1 if no rounds exist yet!
      const roundNumbers = new Set(data.scores.map(s => Number(s.round_number)));
      if (roundNumbers.size === 0 && data.players && data.players.length >= 2) {
        const initialScores = data.players.map(p => ({ player_id: p.player_id, score: 0 }));
        const res = await Api.addRound({ game_id: gameId, scores: initialScores });
        if (res && res.scores) {
          this.activeGameData.scores = res.scores;
        }
      }

      this.recalculate();
      this.notify('activeGameUpdated', this.activeGameData);
    } catch (err) {
      console.error(`Failed to load game ${gameId}:`, err);
      this.notify('error', 'Could not open game.');
    } finally {
      this.setLoading(false);
    }
  }

  recalculate() {
    if (!this.activeGameData) return;
    const { players, scores } = this.activeGameData;
    this.totalsMap = calculatePlayerTotals(players, scores);
    this.rankings = evaluateRankings(players, this.totalsMap);
  }

  async createNewGame(gameName, maxScore, playerNames) {
    this.setLoading(true);
    try {
      const data = await Api.createGame({
        game_name: gameName,
        max_score: maxScore,
        players: playerNames
      });
      await this.loadGamesList();
      await this.loadActiveGame(data.game.game_id);
      this.notify('toast', { type: 'success', message: `Game "${gameName}" created!` });
      return data;
    } catch (err) {
      console.error('Failed to create game:', err);
      this.notify('error', err.message || 'Could not create game');
      throw err;
    } finally {
      this.setLoading(false);
    }
  }

  async addRound(scoresArray) {
    if (!this.activeGameId || !this.activeGameData) return;
    this.setLoading(true);
    try {
      const result = await Api.addRound({
        game_id: this.activeGameId,
        scores: scoresArray
      });

      // Optimistic update local scores array
      if (result && result.scores) {
        this.activeGameData.scores.push(...result.scores);
      } else {
        await this.loadActiveGame(this.activeGameId);
      }

      this.recalculate();
      this.notify('activeGameUpdated', this.activeGameData);
      this.notify('toast', { type: 'success', message: `Round ${result.round_number} saved!` });
    } catch (err) {
      console.error('Failed to save round:', err);
      this.notify('error', err.message || 'Could not save round.');
    } finally {
      this.setLoading(false);
    }
  }

  async updateScore(roundNumber, playerId, scoreValue) {
    if (!this.activeGameId || !this.activeGameData) return;
    try {
      // Find and update local score optimistically
      let existing = this.activeGameData.scores.find(
        s => s.game_id === this.activeGameId && Number(s.round_number) === Number(roundNumber) && s.player_id === playerId
      );

      const oldScore = existing ? existing.score : null;
      if (existing) {
        existing.score = Number(scoreValue);
      } else {
        this.activeGameData.scores.push({
          score_id: 'temp_' + Date.now(),
          game_id: this.activeGameId,
          round_number: Number(roundNumber),
          player_id: playerId,
          score: Number(scoreValue)
        });
      }

      this.recalculate();
      this.notify('activeGameUpdated', this.activeGameData);

      // Async save to API
      await Api.updateScore({
        game_id: this.activeGameId,
        round_number: roundNumber,
        player_id: playerId,
        score: scoreValue
      });

      this.notify('toast', { type: 'success', message: 'Score updated ✓' });
    } catch (err) {
      console.error('Failed to update score:', err);
      // Reload on failure
      await this.loadActiveGame(this.activeGameId);
      this.notify('error', 'Failed to save score update.');
    }
  }

  async deleteRound(roundNumber) {
    if (!this.activeGameId || !this.activeGameData) return;
    this.setLoading(true);
    try {
      await Api.deleteRound({
        game_id: this.activeGameId,
        round_number: roundNumber
      });

      // Filter local scores
      this.activeGameData.scores = this.activeGameData.scores.filter(
        s => Number(s.round_number) !== Number(roundNumber)
      );

      this.recalculate();
      this.notify('activeGameUpdated', this.activeGameData);
      this.notify('toast', { type: 'success', message: `Round ${roundNumber} deleted` });
    } catch (err) {
      console.error(`Failed to delete round ${roundNumber}:`, err);
      this.notify('error', 'Could not delete round.');
    } finally {
      this.setLoading(false);
    }
  }

  async addPlayerToActiveGame(playerName) {
    if (!this.activeGameId || !this.activeGameData) return;
    this.setLoading(true);
    try {
      const newPlayer = await Api.addPlayer({
        game_id: this.activeGameId,
        player_name: playerName
      });

      this.activeGameData.players.push(newPlayer);
      this.recalculate();
      this.notify('activeGameUpdated', this.activeGameData);
      this.notify('toast', { type: 'success', message: `Player ${playerName} added!` });
    } catch (err) {
      console.error('Failed to add player:', err);
      this.notify('error', 'Could not add player.');
    } finally {
      this.setLoading(false);
    }
  }

  async removePlayerFromActiveGame(playerId) {
    if (!this.activeGameId || !this.activeGameData) return;
    this.setLoading(true);
    try {
      await Api.removePlayer({ player_id: playerId });

      this.activeGameData.players = this.activeGameData.players.filter(p => p.player_id !== playerId);
      this.recalculate();
      this.notify('activeGameUpdated', this.activeGameData);
      this.notify('toast', { type: 'success', message: 'Player removed' });
    } catch (err) {
      console.error('Failed to remove player:', err);
      this.notify('error', 'Could not remove player.');
    } finally {
      this.setLoading(false);
    }
  }

  async archiveActiveGame() {
    if (!this.activeGameId) return;
    this.setLoading(true);
    try {
      await Api.archiveGame(this.activeGameId);
      if (this.activeGameData) {
        this.activeGameData.game.status = 'completed';
      }
      await this.loadGamesList();
      this.notify('activeGameUpdated', this.activeGameData);
      this.notify('toast', { type: 'success', message: 'Game marked as completed!' });
    } catch (err) {
      console.error('Failed to archive game:', err);
      this.notify('error', 'Could not archive game.');
    } finally {
      this.setLoading(false);
    }
  }
}

export const state = new AppState();
