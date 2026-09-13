import assert from 'node:assert';
import { calculatePlayerTotals, evaluateRankings } from '../src/js/ranking.js';

console.log('🧪 Running Card Scorekeeper Unit Tests...\n');

// Test Case 1: Standard Scores
{
  const players = [{ player_id: 'P1' }, { player_id: 'P2' }, { player_id: 'P3' }];
  const scores = [
    { round_number: 1, player_id: 'P1', score: 5 },
    { round_number: 1, player_id: 'P2', score: 10 },
    { round_number: 1, player_id: 'P3', score: 12 },
    { round_number: 2, player_id: 'P1', score: 8 },
    { round_number: 2, player_id: 'P2', score: 4 },
    { round_number: 2, player_id: 'P3', score: 11 }
  ];

  const totals = calculatePlayerTotals(players, scores);
  assert.strictEqual(totals.P1, 13, 'P1 total should be 13');
  assert.strictEqual(totals.P2, 14, 'P2 total should be 14');
  assert.strictEqual(totals.P3, 23, 'P3 total should be 23');

  const ranks = evaluateRankings(players, totals);
  assert.strictEqual(ranks.P1.rank, 'lowest', 'P1 should be LOWEST (13)');
  assert.strictEqual(ranks.P2.rank, 'middle', 'P2 should be MIDDLE (14)');
  assert.strictEqual(ranks.P3.rank, 'highest', 'P3 should be HIGHEST (23)');
  console.log('✓ Test 1 Passed: Standard cumulative totals & rankings (Lowest/Middle/Highest)');
}

// Test Case 2: Tied Lowest
{
  const players = [{ player_id: 'P1' }, { player_id: 'P2' }, { player_id: 'P3' }];
  const totals = { P1: 10, P2: 10, P3: 25 };
  const ranks = evaluateRankings(players, totals);

  assert.strictEqual(ranks.P1.rank, 'lowest', 'P1 should be LOWEST in tie');
  assert.strictEqual(ranks.P2.rank, 'lowest', 'P2 should be LOWEST in tie');
  assert.strictEqual(ranks.P3.rank, 'highest', 'P3 should be HIGHEST');
  console.log('✓ Test 2 Passed: Tied lowest score gives both players Green LOWEST status');
}

// Test Case 3: Tied Highest
{
  const players = [{ player_id: 'P1' }, { player_id: 'P2' }, { player_id: 'P3' }];
  const totals = { P1: 5, P2: 30, P3: 30 };
  const ranks = evaluateRankings(players, totals);

  assert.strictEqual(ranks.P1.rank, 'lowest', 'P1 should be LOWEST');
  assert.strictEqual(ranks.P2.rank, 'highest', 'P2 should be HIGHEST in tie');
  assert.strictEqual(ranks.P3.rank, 'highest', 'P3 should be HIGHEST in tie');
  console.log('✓ Test 3 Passed: Tied highest score gives both players Red HIGHEST status');
}

// Test Case 4: Everyone Tied
{
  const players = [{ player_id: 'P1' }, { player_id: 'P2' }, { player_id: 'P3' }];
  const totals = { P1: 15, P2: 15, P3: 15 };
  const ranks = evaluateRankings(players, totals);

  assert.strictEqual(ranks.P1.rank, 'tied', 'P1 should be TIED');
  assert.strictEqual(ranks.P2.rank, 'tied', 'P2 should be TIED');
  assert.strictEqual(ranks.P3.rank, 'tied', 'P3 should be TIED');
  console.log('✓ Test 4 Passed: All equal totals resulting in neutral TIED status');
}

console.log('\n🎉 ALL UNIT TESTS PASSED SUCCESSFULLY!');
