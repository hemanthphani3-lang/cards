/**
 * Main Application Controller & Event Handler
 */
import { state } from './state.js';
import { UI } from './ui.js';
import { getGasUrl, setGasUrl, pingGasUrl } from './api.js';

let pendingDeleteRoundNumber = null;

document.addEventListener('DOMContentLoaded', async () => {
  initEventListeners();
  subscribeToState();

  UI.renderStorageStatus();
  await state.loadGamesList();

  // Always open on Dashboard (My Games) by default so user can inspect previous games
  UI.showView('view-games');
});

// Subscribe to state updates
function subscribeToState() {
  state.subscribe((event, data) => {
    switch (event) {
      case 'gamesListUpdated':
        UI.renderGamesList(data);
        break;

      case 'activeGameUpdated':
        if (data) {
          UI.renderActiveGame(data, state.totalsMap, state.rankings);
          UI.renderOptionsPlayersList(data.players);
        }
        break;

      case 'toast':
        UI.showToast(data.message, data.type);
        break;

      case 'error':
        UI.showToast(data, 'error');
        break;
    }
  });
}

// Wire Event Listeners
function initEventListeners() {
  // Navigation & Header
  document.getElementById('btn-home')?.addEventListener('click', () => {
    state.loadGamesList();
    UI.showView('view-games');
  });

  document.getElementById('btn-back-to-games')?.addEventListener('click', () => {
    state.loadGamesList();
    UI.showView('view-games');
  });

  // Modal Close Buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => UI.closeAllModals());
  });

  // Overlay click to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) UI.closeAllModals();
    });
  });

  // New Game Trigger
  const openNewGame = () => {
    UI.renderNewGamePlayerInputs(['Rahul', 'Arjun', 'Kiran']);
    UI.openModal('modal-new-game');
    setTimeout(() => document.getElementById('input-game-name')?.focus(), 100);
  };

  document.getElementById('btn-header-new-game')?.addEventListener('click', openNewGame);
  document.getElementById('btn-dashboard-new-game')?.addEventListener('click', openNewGame);
  document.getElementById('btn-empty-new-game')?.addEventListener('click', openNewGame);

  // 1-Click Quick Template Cards
  document.querySelectorAll('.btn-quick-template').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      const maxScore = Number(btn.dataset.max);
      const players = btn.dataset.players.split(',').map(s => s.trim());

      try {
        await state.createNewGame(name, maxScore, players);
        UI.showView('view-scoreboard');
      } catch (err) {
        // Error handled by state
      }
    });
  });

  // Dynamic player input addition in New Game modal
  document.getElementById('btn-add-player-input')?.addEventListener('click', () => {
    const inputs = Array.from(document.querySelectorAll('.input-player-name')).map(i => i.value);
    inputs.push('');
    UI.renderNewGamePlayerInputs(inputs);
  });

  document.getElementById('new-game-players-list')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-remove-player-input')) {
      const row = e.target.closest('.dynamic-player-item');
      if (row) row.remove();
    }
  });

  // New Game Form Submit
  document.getElementById('form-new-game')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const gameName = document.getElementById('input-game-name').value.trim();
    const maxScore = Number(document.getElementById('input-max-score').value);
    const playerInputs = Array.from(document.querySelectorAll('.input-player-name'))
      .map(i => i.value.trim())
      .filter(name => name.length > 0);

    if (!gameName) {
      UI.showToast('Please enter a game name', 'error');
      return;
    }
    if (isNaN(maxScore) || maxScore <= 0) {
      UI.showToast('Maximum score must be a positive number', 'error');
      return;
    }
    if (playerInputs.length < 2) {
      UI.showToast('Please enter at least 2 player names', 'error');
      return;
    }

    try {
      await state.createNewGame(gameName, maxScore, playerInputs);
      UI.closeAllModals();
      UI.showView('view-scoreboard');
    } catch (err) {
      // Error handled by state toast
    }
  });

  // Open Game Card from Dashboard
  document.getElementById('games-grid')?.addEventListener('click', async (e) => {
    const card = e.target.closest('.game-card');
    if (card && card.dataset.gameId) {
      await state.loadActiveGame(card.dataset.gameId);
      UI.showView('view-scoreboard');
    }
  });

  // Add Round Trigger
  const openAddRound = () => {
    if (!state.activeGameData) return;
    const { players, scores } = state.activeGameData;
    if (!players || players.length === 0) {
      UI.showToast('Please add players to this game first', 'error');
      return;
    }

    const roundNumbers = Array.from(new Set(scores.map(s => Number(s.round_number))));
    const nextRoundNum = roundNumbers.length > 0 ? Math.max(...roundNumbers) + 1 : 1;

    UI.renderAddRoundInputs(players, nextRoundNum);
    UI.openModal('modal-add-round');

    // Auto-focus 1st score input
    setTimeout(() => {
      const firstInput = document.querySelector('.input-add-score[data-index="0"]');
      if (firstInput) firstInput.focus();
    }, 150);
  };

  document.getElementById('btn-add-round')?.addEventListener('click', openAddRound);
  document.getElementById('btn-empty-add-round')?.addEventListener('click', openAddRound);

  // Fast Score Entry: Keyboard Navigation (Enter key progression)
  document.getElementById('add-round-players-inputs')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('input-add-score')) {
      e.preventDefault();
      const currentIndex = Number(e.target.dataset.index);
      const nextInput = document.querySelector(`.input-add-score[data-index="${currentIndex + 1}"]`);

      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      } else {
        // Last input: Submit the form!
        document.getElementById('form-add-round')?.requestSubmit();
      }
    }
  });

  // Add Round Form Submit
  document.getElementById('form-add-round')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputs = document.querySelectorAll('.input-add-score');
    const scoresArray = [];

    const totalPlayers = inputs.length;
    const minRequired = Math.ceil(totalPlayers / 2);

    let filledCount = 0;
    let hasInvalid = false;

    inputs.forEach(input => {
      const playerId = input.dataset.playerId;
      const raw = input.value.trim();

      if (raw !== '') {
        const val = Number(raw);
        if (isNaN(val)) {
          hasInvalid = true;
        } else {
          filledCount++;
          scoresArray.push({ player_id: playerId, score: val });
        }
      } else {
        // Default empty player scores to 0
        scoresArray.push({ player_id: playerId, score: 0 });
      }
    });

    if (hasInvalid) {
      UI.showToast('Please enter valid numeric scores', 'error');
      return;
    }

    if (filledCount < minRequired) {
      UI.showToast(`Please enter scores for at least ${minRequired} of ${totalPlayers} players (at least half)`, 'error');
      return;
    }

    await state.addRound(scoresArray);
    UI.closeAllModals();

    // Auto-open next round immediately without needing to click "+ Add Round" manually!
    setTimeout(() => {
      openAddRound();
    }, 200);
  });

  // Direct Excel Spreadsheet Input Handling (No Popups!)
  let updateDebounceTimer = null;

  document.getElementById('scoreboard-table')?.addEventListener('input', (e) => {
    if (e.target.classList.contains('excel-score-input')) {
      const input = e.target;
      const roundNum = Number(input.dataset.round);
      const playerId = input.dataset.playerId;
      const raw = input.value.trim();
      const val = raw === '' ? 0 : Number(raw);

      if (!isNaN(val) && state.activeGameData) {
        // Live update score in memory
        let s = state.activeGameData.scores.find(
          sc => Number(sc.round_number) === roundNum && sc.player_id === playerId
        );
        if (s) {
          s.score = val;
        } else {
          state.activeGameData.scores.push({
            score_id: 'temp_' + Date.now(),
            game_id: state.activeGameId,
            round_number: roundNum,
            player_id: playerId,
            score: val
          });
        }

        // Live recalculate totals & rankings
        state.recalculate();

        // Update total row and badges without losing focus
        const totalsMap = state.totalsMap;
        const rankings = state.rankings;
        const game = state.activeGameData.game;

        state.activeGameData.players.forEach(p => {
          const total = totalsMap[p.player_id] || 0;
          const rankInfo = rankings[p.player_id] || { colorClass: 'rank-tied', label: 'TIED', icon: '⚖️' };
          const isMaxExceeded = total >= game.max_score;

          const footerTd = document.querySelector(`#table-footer-row td.${rankInfo.colorClass}, #table-footer-row td:nth-child(${state.activeGameData.players.indexOf(p) + 2})`);
          if (footerTd) {
            footerTd.className = rankInfo.colorClass;
            footerTd.innerHTML = `
              <div class="total-cell-content">
                <span class="total-score-val">${total}</span>
                <span style="font-size: 0.72rem; font-weight: 700; opacity: 0.9;">
                  ${rankInfo.icon} ${rankInfo.label}
                </span>
                ${isMaxExceeded ? `<span class="badge badge-highest" style="margin-top:2px;">⚠️ MAX REACHED</span>` : ''}
              </div>
            `;
          }

          // Update header badges
          const headerTh = document.querySelector(`#table-header-row th:nth-child(${state.activeGameData.players.indexOf(p) + 2})`);
          if (headerTh) {
            const badgeSpan = headerTh.querySelector('.badge');
            if (badgeSpan) {
              badgeSpan.className = `badge ${rankInfo.badgeClass}`;
              badgeSpan.innerHTML = `${rankInfo.icon} ${rankInfo.label}`;
            }
          }
        });

        // Debounced persistent save to API
        clearTimeout(updateDebounceTimer);
        updateDebounceTimer = setTimeout(() => {
          state.updateScore(roundNum, playerId, val);
        }, 600);
      }
    }
  });

  // Excel Keyboard Navigation (Tab, Enter, Arrow Keys) & Auto-Row Generation
  document.getElementById('scoreboard-table')?.addEventListener('keydown', async (e) => {
    if (!e.target.classList.contains('excel-score-input')) return;

    const input = e.target;
    const rIdx = Number(input.dataset.roundIndex);
    const pIdx = Number(input.dataset.playerIndex);
    const totalPlayers = state.activeGameData ? state.activeGameData.players.length : 1;

    let targetR = rIdx;
    let targetP = pIdx;

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      targetR = rIdx + 1;
    } else if (e.key === 'Tab' || e.key === 'ArrowRight') {
      if (e.key === 'Tab') e.preventDefault();
      targetP = pIdx + 1;
      if (targetP >= totalPlayers) {
        targetP = 0;
        targetR = rIdx + 1;
      }
    } else if (e.key === 'ArrowLeft') {
      targetP = pIdx - 1;
      if (targetP < 0 && rIdx > 0) {
        targetP = totalPlayers - 1;
        targetR = rIdx - 1;
      }
    } else if (e.key === 'ArrowUp') {
      targetR = rIdx - 1;
    } else {
      return;
    }

    // Check if targetR exceeds existing rounds
    const existingRounds = Array.from(new Set(state.activeGameData.scores.map(s => Number(s.round_number)))).sort((a,b)=>a-b);
    if (targetR >= existingRounds.length) {
      // Check if at least half of players in current round have non-zero/non-empty scores
      const currentRoundNum = existingRounds[rIdx];
      const filledInCurrentRound = state.activeGameData.scores.filter(
        s => Number(s.round_number) === currentRoundNum && s.score !== null && s.score !== undefined && String(s.score).trim() !== ''
      ).length;

      const minHalf = Math.ceil(totalPlayers / 2);
      if (filledInCurrentRound >= minHalf || targetR > existingRounds.length) {
        // Auto-create next round row in table!
        const nextRoundNum = existingRounds.length > 0 ? Math.max(...existingRounds) + 1 : 1;
        const newScores = state.activeGameData.players.map(p => ({ player_id: p.player_id, score: 0 }));
        await state.addRound(newScores);
      }
    }

    // Focus on target cell input
    setTimeout(() => {
      const nextCellInput = document.querySelector(
        `.excel-score-input[data-round-index="${targetR}"][data-player-index="${targetP}"]`
      );
      if (nextCellInput) {
        nextCellInput.focus();
        nextCellInput.select();
      }
    }, 60);
  });

  // Table round delete trigger
  document.getElementById('scoreboard-table')?.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.btn-delete-round-trigger');
    if (deleteBtn && deleteBtn.dataset.round) {
      e.stopPropagation();
      pendingDeleteRoundNumber = Number(deleteBtn.dataset.round);
      document.getElementById('delete-round-confirm-msg').textContent =
        `Delete Round ${pendingDeleteRoundNumber}? This will remove all scores from this round.`;
      UI.openModal('modal-confirm-delete');
    }
  });

  // Edit Score Form Submit
  document.getElementById('form-edit-score')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const roundNum = Number(document.getElementById('edit-score-round').value);
    const playerId = document.getElementById('edit-score-player-id').value;
    const scoreVal = Number(document.getElementById('input-edit-score').value);

    if (isNaN(scoreVal)) {
      UI.showToast('Please enter a valid numeric score', 'error');
      return;
    }

    await state.updateScore(roundNum, playerId, scoreVal);
    UI.closeAllModals();
  });

  // Confirm Delete Round Button
  document.getElementById('btn-confirm-delete-round')?.addEventListener('click', async () => {
    if (pendingDeleteRoundNumber !== null) {
      await state.deleteRound(pendingDeleteRoundNumber);
      pendingDeleteRoundNumber = null;
      UI.closeAllModals();
    }
  });

  // Game Options Modal
  document.getElementById('btn-game-options')?.addEventListener('click', () => {
    if (state.activeGameData) {
      UI.renderOptionsPlayersList(state.activeGameData.players);
      UI.openModal('modal-game-options');
    }
  });

  // Add Player in Options Modal
  document.getElementById('btn-submit-add-player')?.addEventListener('click', async () => {
    const input = document.getElementById('input-add-player-name');
    const name = input.value.trim();
    if (!name) {
      UI.showToast('Enter player name', 'error');
      return;
    }
    await state.addPlayerToActiveGame(name);
    input.value = '';
    UI.renderOptionsPlayersList(state.activeGameData.players);
  });

  // Remove Player in Options Modal
  document.getElementById('options-players-list')?.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-remove-game-player')) {
      const playerId = e.target.dataset.playerId;
      const playerName = e.target.dataset.playerName;

      if (confirm(`Removing ${playerName} will remove them from the active scoreboard. Continue?`)) {
        await state.removePlayerFromActiveGame(playerId);
        UI.renderOptionsPlayersList(state.activeGameData.players);
      }
    }
  });

  // Finish / Archive Game Button
  document.getElementById('btn-finish-game')?.addEventListener('click', async () => {
    if (confirm('Finish and archive this game? It will remain saved under My Games.')) {
      await state.archiveActiveGame();
      UI.closeAllModals();
    }
  });

  // Settings Modal (Google Apps Script URL)
  document.getElementById('btn-open-settings')?.addEventListener('click', () => {
    UI.renderStorageStatus();
    UI.openModal('modal-settings');
  });

  // Test GAS URL Connection
  document.getElementById('btn-test-gas-url')?.addEventListener('click', async () => {
    const url = document.getElementById('input-gas-url').value.trim();
    if (!url) {
      UI.showToast('Please enter a Google Apps Script Web App URL first', 'error');
      return;
    }

    UI.showToast('Testing Google Sheets connection...', 'info');
    try {
      const isPong = await pingGasUrl(url);
      if (isPong) {
        UI.showToast('Connection Successful! Google Sheets API is ready.', 'success');
      } else {
        UI.showToast('Server responded, but ping test failed.', 'error');
      }
    } catch (err) {
      UI.showToast('Could not connect. Check Web App deployment permissions (Access: Anyone).', 'error');
    }
  });

  // Save Settings
  document.getElementById('btn-save-gas-url')?.addEventListener('click', async () => {
    const url = document.getElementById('input-gas-url').value.trim();
    setGasUrl(url);
    UI.renderStorageStatus();
    UI.closeAllModals();
    UI.showToast(url ? 'Google Sheets API connected!' : 'Switched to Local Storage Mode', 'success');
    await state.loadGamesList();
  });
}
