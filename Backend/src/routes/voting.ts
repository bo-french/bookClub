import type { FastifyInstance } from "fastify";

function computeIRVWinner(
  ballots: { voter_id: number; nomination_id: number; rank: number }[],
  nominationIds: number[]
): { winner_id: number | null } {
  if (nominationIds.length === 0) return { winner_id: null };
  if (nominationIds.length === 1) return { winner_id: nominationIds[0] };

  const ballotsByVoter = new Map<number, Map<number, number>>();
  for (const { voter_id, nomination_id, rank } of ballots) {
    if (!ballotsByVoter.has(voter_id)) {
      ballotsByVoter.set(voter_id, new Map());
    }
    ballotsByVoter.get(voter_id)!.set(nomination_id, rank);
  }

  if (ballotsByVoter.size === 0) return { winner_id: null };

  let remaining = new Set(nominationIds);

  while (remaining.size > 1) {
    const counts = new Map<number, number>();
    for (const id of remaining) counts.set(id, 0);

    for (const voterRankings of ballotsByVoter.values()) {
      let bestRank = Infinity;
      let bestCandidate: number | null = null;
      for (const [nomId, rank] of voterRankings) {
        if (remaining.has(nomId) && rank < bestRank) {
          bestRank = rank;
          bestCandidate = nomId;
        }
      }
      if (bestCandidate !== null) {
        counts.set(bestCandidate, (counts.get(bestCandidate) ?? 0) + 1);
      }
    }

    const totalVoters = ballotsByVoter.size;
    for (const [nomId, count] of counts) {
      if (count > totalVoters / 2) {
        return { winner_id: nomId };
      }
    }

    const minVotes = Math.min(...counts.values());
    for (const [nomId, count] of counts) {
      if (count === minVotes) {
        remaining.delete(nomId);
      }
    }
  }

  return { winner_id: remaining.size === 1 ? [...remaining][0] : null };
}

export default async function votingRoutes(fastify: FastifyInstance) {
  // GET /voting-windows/current
  // Returns the current voting window, nominees with first-choice vote counts,
  // the current user's rankings, unique voter count, and IRV result.
  fastify.get(
    "/voting-windows/current",
    { preHandler: fastify.authenticate },
    async (request, _reply) => {
      const { userId } = request.user;

      const [user] = await fastify.db`
        SELECT id FROM users WHERE clerk_id = ${userId}
      `;

      const [nominationWindow] = await fastify.db`
        SELECT id, deadline, deadline > NOW() AS is_active
        FROM nomination_windows
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (!nominationWindow) {
        return { voting_window: null, nomination_window: null, nominees: [], user_rankings: null, voter_count: 0, irv_result: null };
      }

      const [votingWindow] = await fastify.db`
        SELECT id, nomination_window_id, opened_by, deadline, created_at,
               deadline > NOW() AS is_active
        FROM voting_windows
        WHERE nomination_window_id = ${nominationWindow.id}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const nomineesBase = await fastify.db`
        SELECT
          n.id,
          n.title,
          n.author,
          n.summary,
          n.pitch,
          n.created_at,
          u.clerk_id AS nominated_by_clerk_id,
          u.first_name,
          u.last_name
        FROM nominations n
        JOIN users u ON n.nominated_by = u.id
        WHERE n.window_id = ${nominationWindow.id}
        ORDER BY n.created_at ASC
      `;

      if (!votingWindow) {
        return {
          voting_window: null,
          nomination_window: nominationWindow,
          nominees: nomineesBase.map((n: any) => ({ ...n, vote_count: 0 })),
          user_rankings: null,
          voter_count: 0,
          irv_result: null,
        };
      }

      // First-choice vote counts per nominee
      const firstChoiceCounts = await fastify.db`
        SELECT nomination_id, COUNT(*)::int AS vote_count
        FROM votes
        WHERE voting_window_id = ${votingWindow.id} AND rank = 1
        GROUP BY nomination_id
      `;
      const countMap = new Map(firstChoiceCounts.map((r: any) => [r.nomination_id, r.vote_count]));

      const nominees = nomineesBase
        .map((n: any) => ({ ...n, vote_count: countMap.get(n.id) ?? 0 }))
        .sort((a: any, b: any) => b.vote_count - a.vote_count || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Unique voter count
      const [{ voter_count }] = await fastify.db`
        SELECT COUNT(DISTINCT voter_id)::int AS voter_count
        FROM votes
        WHERE voting_window_id = ${votingWindow.id}
      `;

      // User's rankings
      let userRankings = null;
      if (user) {
        const rankings = await fastify.db`
          SELECT nomination_id, rank FROM votes
          WHERE voting_window_id = ${votingWindow.id} AND voter_id = ${user.id}
          ORDER BY rank ASC
        `;
        userRankings = rankings.length > 0 ? rankings : null;
      }

      // IRV winner
      const allBallots = await fastify.db`
        SELECT voter_id, nomination_id, rank
        FROM votes
        WHERE voting_window_id = ${votingWindow.id}
      `;
      const nominationIds = nomineesBase.map((n: any) => n.id);
      const irvResult = computeIRVWinner(allBallots, nominationIds);

      return {
        voting_window: votingWindow,
        nomination_window: nominationWindow,
        nominees,
        user_rankings: userRankings,
        voter_count,
        irv_result: irvResult,
      };
    }
  );

  // POST /voting-windows
  // Open a voting window for the most recently closed nomination window.
  fastify.post(
    "/voting-windows",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { userId } = request.user;
      const { deadline } = request.body as { deadline: string };

      if (!deadline) {
        return reply.badRequest("deadline is required");
      }

      const deadlineDate = new Date(deadline);
      if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
        return reply.badRequest("deadline must be a future date and time");
      }

      const [user] = await fastify.db`
        SELECT id FROM users WHERE clerk_id = ${userId}
      `;
      if (!user) return reply.notFound("User not found");

      const [nominationWindow] = await fastify.db`
        SELECT id FROM nomination_windows
        WHERE deadline <= NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (!nominationWindow) {
        return reply.badRequest("No closed nomination window found");
      }

      const [existingVoting] = await fastify.db`
        SELECT id FROM voting_windows
        WHERE nomination_window_id = ${nominationWindow.id}
      `;
      if (existingVoting) {
        return reply.conflict("Voting has already been opened for this nomination round");
      }

      const [newWindow] = await fastify.db`
        INSERT INTO voting_windows (nomination_window_id, opened_by, deadline)
        VALUES (${nominationWindow.id}, ${user.id}, ${deadlineDate})
        RETURNING id, nomination_window_id, opened_by, deadline, created_at,
                  deadline > NOW() AS is_active
      `;

      return { voting_window: newWindow };
    }
  );

  // POST /votes
  // Submit a ranked choice ballot for the active voting window.
  // Body: { rankings: [{ nomination_id: number, rank: number }, ...] }
  // Rankings must cover every nomination in the window with consecutive ranks starting at 1.
  fastify.post(
    "/votes",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { userId } = request.user;
      const { rankings } = request.body as { rankings: { nomination_id: number; rank: number }[] };

      if (!rankings || !Array.isArray(rankings) || rankings.length === 0) {
        return reply.badRequest("rankings array is required");
      }

      const [user] = await fastify.db`
        SELECT id FROM users WHERE clerk_id = ${userId}
      `;
      if (!user) return reply.notFound("User not found");

      const [activeVoting] = await fastify.db`
        SELECT id, nomination_window_id FROM voting_windows
        WHERE deadline > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (!activeVoting) {
        return reply.notFound("No active voting window");
      }

      // Validate rankings cover exactly all nominations in this window
      const nominations = await fastify.db`
        SELECT id FROM nominations WHERE window_id = ${activeVoting.nomination_window_id}
      `;
      const nominationIds = new Set(nominations.map((n: any) => n.id));

      if (rankings.length !== nominationIds.size) {
        return reply.badRequest(`Must rank all ${nominationIds.size} nominations`);
      }

      for (const { nomination_id } of rankings) {
        if (!nominationIds.has(nomination_id)) {
          return reply.badRequest("Rankings include a nomination not in this voting window");
        }
      }

      const sortedRanks = rankings.map((r) => r.rank).sort((a, b) => a - b);
      for (let i = 0; i < sortedRanks.length; i++) {
        if (sortedRanks[i] !== i + 1) {
          return reply.badRequest("Ranks must be consecutive integers starting at 1");
        }
      }

      // Check user hasn't already voted
      const [existingVote] = await fastify.db`
        SELECT id FROM votes
        WHERE voting_window_id = ${activeVoting.id} AND voter_id = ${user.id}
        LIMIT 1
      `;
      if (existingVote) {
        return reply.conflict("You have already voted in this window");
      }

      // Insert all rankings in a transaction
      await fastify.db.begin(async (sql: any) => {
        for (const { nomination_id, rank } of rankings) {
          await sql`
            INSERT INTO votes (voting_window_id, voter_id, nomination_id, rank)
            VALUES (${activeVoting.id}, ${user.id}, ${nomination_id}, ${rank})
          `;
        }
      });

      return { success: true };
    }
  );

  // POST /voting-windows/:id/close
  // Close the voting window early (sets deadline to now).
  fastify.post(
    "/voting-windows/:id/close",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const [window] = await fastify.db`
        SELECT id FROM voting_windows WHERE id = ${id} AND deadline > NOW()
      `;

      if (!window) {
        return reply.notFound("Active voting window not found");
      }

      const [updated] = await fastify.db`
        UPDATE voting_windows
        SET deadline = NOW() - interval '1 second'
        WHERE id = ${id}
        RETURNING id, nomination_window_id, opened_by, deadline, created_at,
                  deadline > NOW() AS is_active
      `;

      return { voting_window: updated };
    }
  );

  // POST /voting-windows/:id/cancel
  // Cancel the voting window and delete all votes. Returns to nominations-closed state.
  fastify.post(
    "/voting-windows/:id/cancel",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const [window] = await fastify.db`
        SELECT id FROM voting_windows WHERE id = ${id} AND deadline > NOW()
      `;

      if (!window) {
        return reply.notFound("Active voting window not found");
      }

      await fastify.db`DELETE FROM votes WHERE voting_window_id = ${id}`;
      await fastify.db`DELETE FROM voting_windows WHERE id = ${id}`;

      return { success: true };
    }
  );
}
