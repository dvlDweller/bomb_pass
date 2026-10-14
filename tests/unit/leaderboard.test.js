const LeaderboardService = require('../../src/services/LeaderboardService');

const p = (id, nickname, score, penalty_count, status, eliminated_at) => ({
  id,
  nickname,
  score,
  penalty_count,
  status,
  eliminated_at: eliminated_at ? new Date(eliminated_at) : null,
});

describe('LeaderboardService.rankings', () => {
  test('active players first, then higher score, then fewer penalties', () => {
    const players = [
      p(1, 'low', 100, 0, 'active'),
      p(2, 'high', 300, 0, 'active'),
      p(3, 'mid', 200, 1, 'active'),
      p(4, 'mid-clean', 200, 0, 'active'),
      p(5, 'out', 999, 0, 'eliminated', '2026-01-01T00:00:00Z'),
    ];
    const rankings = LeaderboardService.rankings(players);
    expect(rankings.map((r) => r.nickname)).toEqual([
      'high',
      'mid-clean',
      'mid',
      'low',
      'out',
    ]);
    expect(rankings.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  test('eliminated players ranked after all active, latest eliminated higher', () => {
    const players = [
      p(1, 'first-out', 0, 3, 'eliminated', '2026-01-01T00:00:00Z'),
      p(2, 'last-out', 0, 3, 'eliminated', '2026-01-03T00:00:00Z'),
      p(3, 'still-in', 0, 0, 'active'),
      p(4, 'mid-out', 0, 3, 'eliminated', '2026-01-02T00:00:00Z'),
    ];
    const rankings = LeaderboardService.rankings(players);
    expect(rankings.map((r) => r.nickname)).toEqual(['still-in', 'last-out', 'mid-out', 'first-out']);
  });

  test('empty player list returns empty rankings', () => {
    expect(LeaderboardService.rankings([])).toEqual([]);
  });
});
