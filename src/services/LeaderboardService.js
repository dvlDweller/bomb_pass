const PlayerRepository = require('../repositories/PlayerRepository');
const LeaderboardRepository = require('../repositories/LeaderboardRepository');

// Ranking [TBD: formula not finalized]: active players first, then higher
// score, then fewer penalties; eliminated players after, latest eliminated
// ranked higher.
class LeaderboardService {
  static sortPlayers(players) {
    return [...players].sort((a, b) => {
      const aActive = a.status === 'active' ? 0 : 1;
      const bActive = b.status === 'active' ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      if (aActive === 1) {
        // Both eliminated: latest eliminated_at ranks higher.
        const aTime = a.eliminated_at ? new Date(a.eliminated_at).getTime() : 0;
        const bTime = b.eliminated_at ? new Date(b.eliminated_at).getTime() : 0;
        return bTime - aTime;
      }
      if (b.score !== a.score) return b.score - a.score;
      return a.penalty_count - b.penalty_count;
    });
  }

  static rankings(players) {
    const sorted = LeaderboardService.sortPlayers(players);
    return sorted.map((p, i) => ({
      rank: i + 1,
      nickname: p.nickname,
      score: p.score,
      penalty_count: p.penalty_count,
      status: p.status,
    }));
  }

  static async getForSession(sessionId) {
    const players = await PlayerRepository.listBySession(sessionId);
    return LeaderboardService.rankings(players);
  }

  static async writeFinal(client, sessionId, players) {
    const rankings = LeaderboardService.rankings(players);
    await LeaderboardRepository.upsert(sessionId, rankings, client);
    return rankings;
  }
}

module.exports = LeaderboardService;
