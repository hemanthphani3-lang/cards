/**
 * UI Renderer Component
 */
import { getGasUrl } from './api.js';

export const UI = {
  // Toast notifications
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button style="background:none;border:none;color:inherit;cursor:pointer;">✕</button>
    `;

    toast.querySelector('button').addEventListener('click', () => toast.remove());
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3500);
  },

  // Modal helpers
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  },

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  },

  // View Switcher
  showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
    }
  },

  // Render Storage Connection Status
  renderStorageStatus() {
    const gasUrl = getGasUrl();
    const textEl = document.getElementById('storage-status-text');
    const pillDot = document.querySelector('#storage-status-pill .status-dot');

    if (gasUrl) {
      if (textEl) textEl.textContent = 'Google Sheets Mode';
      if (pillDot) pillDot.className = 'status-dot active';
    } else {
      if (textEl) textEl.textContent = 'Local Storage Mode';
      if (pillDot) pillDot.className = 'status-dot';
    }

    const settingsLabel = document.getElementById('settings-status-label');
    if (settingsLabel) {
      settingsLabel.textContent = gasUrl ? 'Connected to Google Sheets API' : 'Local Storage (Offline Mode)';
      settingsLabel.style.color = gasUrl ? '#059669' : '#475569';
    }

    const gasInput = document.getElementById('input-gas-url');
    if (gasInput && document.activeElement !== gasInput) {
      gasInput.value = gasUrl;
    }
  },

  // Render My Games Dashboard List
  renderGamesList(games) {
    const grid = document.getElementById('games-grid');
    const emptyState = document.getElementById('games-empty-state');
    if (!grid || !emptyState) return;

    const totalBadge = document.getElementById('stat-total-games-badge');
    if (totalBadge) totalBadge.textContent = `${games ? games.length : 0} Saved Games`;

    if (!games || games.length === 0) {
      grid.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    grid.innerHTML = '';

    games.forEach(g => {
      const card = document.createElement('div');
      card.className = 'game-card card-interactive';
      card.dataset.gameId = g.game_id;

      const isCompleted = g.status === 'completed';
      const formattedDate = g.updated_at ? new Date(g.updated_at).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : '';

      card.innerHTML = `
        <div>
          <div class="game-card-header">
            <div class="game-card-title-group">
              <h3 class="game-card-title">${escapeHtml(g.game_name)}</h3>
              <div class="game-card-meta-chips">
                <span class="meta-chip">👥 ${g.player_count} Players</span>
                <span class="meta-chip">📝 ${g.round_count} Rounds</span>
                <span class="meta-chip">🎯 Max ${g.max_score}</span>
              </div>
            </div>
            <span class="badge ${isCompleted ? 'badge-tied' : 'badge-status'}">
              ${isCompleted ? 'Completed' : 'Active'}
            </span>
          </div>
        </div>
        <div class="game-card-footer">
          <span>Updated ${formattedDate}</span>
          <span style="font-weight: 800; color: var(--primary);">Open Scorekeeper →</span>
        </div>
      `;

      grid.appendChild(card);
    });
  },

  // Render Active Game Header & Scoreboard Table
  renderActiveGame(gameData, totalsMap, rankings) {
    if (!gameData || !gameData.game) return;

    const { game, players, scores } = gameData;

    // Header metadata
    document.getElementById('active-game-title').textContent = game.game_name;
    document.getElementById('badge-max-score').textContent = `🎯 Max Score: ${game.max_score}`;
    document.getElementById('badge-player-count').textContent = `👥 ${players.length} Players`;

    // Calculate total unique rounds
    const roundNumbers = Array.from(new Set(scores.map(s => Number(s.round_number)))).sort((a, b) => a - b);
    document.getElementById('badge-round-count').textContent = `📝 ${roundNumbers.length} Rounds`;

    const isCompleted = game.status === 'completed';
    const statusBadge = document.getElementById('badge-game-status');
    if (statusBadge) {
      statusBadge.textContent = isCompleted ? 'Completed' : 'Active';
      statusBadge.className = `badge ${isCompleted ? 'badge-tied' : 'badge-lowest'}`;
    }

    const tableWrapper = document.getElementById('scoreboard-table-wrapper');
    const emptyState = document.getElementById('scoreboard-empty-state');

    if (roundNumbers.length === 0) {
      if (tableWrapper) tableWrapper.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
    } else {
      if (tableWrapper) tableWrapper.style.display = 'block';
      if (emptyState) emptyState.style.display = 'none';
    }

    // Render Table Header (Player Columns)
    const headerRow = document.getElementById('table-header-row');
    headerRow.innerHTML = `<th class="col-round">ROUND</th>`;

    players.forEach(p => {
      const rankInfo = rankings[p.player_id] || { rank: 'tied', badgeClass: 'badge-tied', label: 'TIED', icon: '⚖️' };
      const initial = p.player_name ? p.player_name.trim().charAt(0).toUpperCase() : '?';

      const th = document.createElement('th');
      th.innerHTML = `
        <div class="player-header-cell">
          <div class="player-avatar-header">${initial}</div>
          <span class="player-name">${escapeHtml(p.player_name)}</span>
          <span class="badge ${rankInfo.badgeClass}">${rankInfo.icon} ${rankInfo.label}</span>
        </div>
      `;
      headerRow.appendChild(th);
    });

    // Render Table Body Rows (Round Scores)
    const tbody = document.getElementById('table-body-rows');
    tbody.innerHTML = '';

    // Build round-to-score matrix
    const scoreMatrix = {};
    scores.forEach(s => {
      const rNum = Number(s.round_number);
      if (!scoreMatrix[rNum]) scoreMatrix[rNum] = {};
      scoreMatrix[rNum][s.player_id] = s.score;
    });

    roundNumbers.forEach(rNum => {
      const tr = document.createElement('tr');

      // Round Label Cell with Delete Action
      const tdRound = document.createElement('td');
      tdRound.className = 'col-round';
      tdRound.innerHTML = `
        <span>Round ${rNum}</span>
        <button class="btn-icon btn-sm btn-delete-round-trigger" data-round="${rNum}" title="Delete Round ${rNum}">
          🗑️
        </button>
      `;
      tr.appendChild(tdRound);

      // Player Score Cells
      players.forEach(p => {
        const td = document.createElement('td');
        td.className = 'score-cell';
        td.dataset.round = rNum;
        td.dataset.playerId = p.player_id;
        td.dataset.playerName = p.player_name;

        const val = scoreMatrix[rNum] ? scoreMatrix[rNum][p.player_id] : null;
        td.textContent = (val !== null && val !== undefined) ? val : '-';

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    // Render Table Footer (TOTAL Row)
    const footerRow = document.getElementById('table-footer-row');
    footerRow.innerHTML = `<td class="col-round">TOTAL</td>`;

    players.forEach(p => {
      const total = totalsMap[p.player_id] || 0;
      const rankInfo = rankings[p.player_id] || { colorClass: 'rank-tied', label: 'TIED', icon: '⚖️' };
      const isMaxExceeded = total >= game.max_score;

      const td = document.createElement('td');
      td.className = `${rankInfo.colorClass}`;
      td.innerHTML = `
        <div class="total-cell-content">
          <span class="total-score-val">${total}</span>
          <span style="font-size: 0.72rem; font-weight: 700; opacity: 0.9;">
            ${rankInfo.icon} ${rankInfo.label}
          </span>
          ${isMaxExceeded ? `<span class="badge badge-highest" style="margin-top:2px;">⚠️ MAX REACHED</span>` : ''}
        </div>
      `;
      footerRow.appendChild(td);
    });
  },

  // Render Dynamic Player Rows in New Game Modal
  renderNewGamePlayerInputs(playersList = ['Rahul', 'Arjun', 'Kiran']) {
    const container = document.getElementById('new-game-players-list');
    if (!container) return;

    container.innerHTML = '';
    playersList.forEach((name, index) => {
      const div = document.createElement('div');
      div.className = 'dynamic-player-item';
      div.innerHTML = `
        <input type="text" class="form-input input-player-name" value="${escapeHtml(name)}" placeholder="Player ${index + 1} Name" required>
        ${playersList.length > 2 ? `<button type="button" class="btn-icon btn-remove-player-input">✕</button>` : ''}
      `;
      container.appendChild(div);
    });
  },

  // Render Add Round Inputs with Auto-Focus Setup
  renderAddRoundInputs(players, nextRoundNum) {
    const titleEl = document.getElementById('modal-add-round-title');
    if (titleEl) titleEl.textContent = `Add Round ${nextRoundNum}`;

    const container = document.getElementById('add-round-players-inputs');
    if (!container) return;

    const minHalf = Math.ceil(players.length / 2);
    container.innerHTML = `
      <div style="font-size: 0.82rem; color: var(--text-secondary); background: var(--bg-surface-subtle); padding: 8px 12px; border-radius: var(--radius-sm); margin-bottom: 12px; border-left: 3px solid var(--primary);">
        ⚡ Enter scores for at least <strong>${minHalf}</strong> of <strong>${players.length}</strong> players. Saving will automatically open Round ${nextRoundNum + 1}!
      </div>
    `;

    players.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'player-score-row';
      row.innerHTML = `
        <span class="player-score-label">${escapeHtml(p.player_name)}</span>
        <input type="number" class="form-input player-score-field input-add-score"
               data-player-id="${p.player_id}"
               data-index="${idx}"
               placeholder="0"
               inputmode="numeric"
               pattern="[0-9]*">
      `;
      container.appendChild(row);
    });
  },

  // Render Options Modal Players List
  renderOptionsPlayersList(players) {
    const container = document.getElementById('options-players-list');
    if (!container) return;

    container.innerHTML = '';
    players.forEach(p => {
      const item = document.createElement('div');
      item.className = 'dynamic-player-item';
      item.style.padding = '8px 12px';
      item.style.background = 'var(--bg-surface-subtle)';
      item.style.borderRadius = 'var(--radius-md)';
      item.style.justifyContent = 'space-between';

      item.innerHTML = `
        <span style="font-weight: 600;">${escapeHtml(p.player_name)}</span>
        <button class="btn btn-sm btn-danger btn-remove-game-player" data-player-id="${p.player_id}" data-player-name="${escapeHtml(p.player_name)}">
          Remove
        </button>
      `;
      container.appendChild(item);
    });
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
