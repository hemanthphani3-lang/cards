/**
 * Ranking Engine for Card Game Scorekeeper
 * Rule: LOWER cumulative score is better.
 */

export function calculatePlayerTotals(players, scores) {
  // Map player_id -> cumulative score
  const totalsMap = {};
  players.forEach(p => {
    totalsMap[p.player_id] = 0;
  });

  scores.forEach(s => {
    if (totalsMap[s.player_id] !== undefined && s.score !== null && !isNaN(s.score)) {
      totalsMap[s.player_id] += Number(s.score);
    }
  });

  return totalsMap;
}

export function evaluateRankings(players, totalsMap) {
  if (!players || players.length === 0) return {};

  const totals = players.map(p => totalsMap[p.player_id] || 0);
  const lowest = Math.min(...totals);
  const highest = Math.max(...totals);

  const rankings = {};

  // If all players have the exact same score, everyone is tied
  const allTied = lowest === highest;

  players.forEach(p => {
    const total = totalsMap[p.player_id] || 0;

    if (allTied) {
      rankings[p.player_id] = {
        rank: 'tied',
        label: 'TIED',
        colorClass: 'rank-tied',
        badgeClass: 'badge-tied',
        icon: '⚖️'
      };
    } else if (total === lowest) {
      rankings[p.player_id] = {
        rank: 'lowest',
        label: 'LOWEST',
        colorClass: 'rank-lowest',
        badgeClass: 'badge-lowest',
        icon: '🟢'
      };
    } else if (total === highest) {
      rankings[p.player_id] = {
        rank: 'highest',
        label: 'HIGHEST',
        colorClass: 'rank-highest',
        badgeClass: 'badge-highest',
        icon: '🔴'
      };
    } else {
      rankings[p.player_id] = {
        rank: 'middle',
        label: 'MIDDLE',
        colorClass: 'rank-middle',
        badgeClass: 'badge-middle',
        icon: '🟠'
      };
    }
  });

  return rankings;
}
