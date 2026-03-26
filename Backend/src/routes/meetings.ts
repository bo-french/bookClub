import type { FastifyInstance } from "fastify";

export default async function meetingRoutes(fastify: FastifyInstance) {
  // GET /meeting-windows/current
  // Returns the most recent meeting window, options with vote counts, user's votes, and selected book.
  fastify.get(
    "/meeting-windows/current",
    { preHandler: fastify.authenticate },
    async (request, _reply) => {
      const { userId } = request.user;
      const [user] = await fastify.db`SELECT id FROM users WHERE clerk_id = ${userId}`;

      const [window] = await fastify.db`
        SELECT id, opened_by, deadline, selected_option_id, created_at,
               deadline > NOW() AS is_active
        FROM meeting_windows
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (!window) {
        return { window: null, options: [], user_votes: [], selected_book: null };
      }

      // Auto-select winner when poll expires without being manually closed
      if (!window.is_active && window.selected_option_id === null) {
        const [winner] = await fastify.db`
          SELECT option_id
          FROM meeting_votes
          WHERE window_id = ${window.id}
          GROUP BY option_id
          ORDER BY COUNT(*) DESC, option_id ASC
          LIMIT 1
        `;
        if (winner) {
          await fastify.db`
            UPDATE meeting_windows SET selected_option_id = ${winner.option_id} WHERE id = ${window.id}
          `;
          window.selected_option_id = winner.option_id;
        }
      }

      const options = await fastify.db`
        SELECT mo.id, mo.meeting_date, mo.meeting_time, mo.location,
               COUNT(mv.id)::int AS vote_count
        FROM meeting_options mo
        LEFT JOIN meeting_votes mv ON mv.option_id = mo.id
        WHERE mo.window_id = ${window.id}
        GROUP BY mo.id
        ORDER BY mo.meeting_date ASC
      `;

      let userVotes: number[] = [];
      if (user) {
        const votes = await fastify.db`
          SELECT option_id FROM meeting_votes
          WHERE window_id = ${window.id} AND voter_id = ${user.id}
        `;
        userVotes = votes.map((v: any) => v.option_id);
      }

      const selectedBook = await getSelectedBook(fastify);

      return { window, options, user_votes: userVotes, selected_book: selectedBook };
    }
  );

  // GET /meeting-windows/past
  // Returns confirmed meetings with dates in the past, plus the book discussed at each.
  fastify.get(
    "/meeting-windows/past",
    { preHandler: fastify.authenticate },
    async (_request, _reply) => {
      const pastMeetings = await fastify.db`
        SELECT mw.id, mo.meeting_date, mo.meeting_time, mo.location
        FROM meeting_windows mw
        JOIN meeting_options mo ON mo.id = mw.selected_option_id
        WHERE mw.selected_option_id IS NOT NULL
          AND mo.meeting_date < CURRENT_DATE
        ORDER BY mo.meeting_date DESC
      `;

      const meetings = await Promise.all(
        pastMeetings.map(async (pm: any) => {
          // Find the most recent voting window that closed on or before this meeting date
          const [lastVotingWindow] = await fastify.db`
            SELECT id, nomination_window_id FROM voting_windows
            WHERE deadline::date <= ${pm.meeting_date}
            ORDER BY deadline DESC
            LIMIT 1
          `;

          if (!lastVotingWindow) return { ...pm, book: null };

          const [winner] = await fastify.db`
            SELECT n.title, n.author
            FROM nominations n
            LEFT JOIN votes v ON v.nomination_id = n.id
              AND v.voting_window_id = ${lastVotingWindow.id}
              AND v.rank = 1
            WHERE n.window_id = ${lastVotingWindow.nomination_window_id}
            GROUP BY n.id, n.title, n.author
            ORDER BY COUNT(v.id) DESC, n.created_at ASC
            LIMIT 1
          `;

          return { ...pm, book: winner ?? null };
        })
      );

      return { meetings };
    }
  );

  // GET /meeting-windows/upcoming
  // Returns upcoming confirmed meetings for dashboard display (meeting date >= today).
  fastify.get(
    "/meeting-windows/upcoming",
    { preHandler: fastify.authenticate },
    async (_request, _reply) => {
      const upcomingMeetings = await fastify.db`
        SELECT mw.id, mo.id AS option_id, mo.meeting_date, mo.meeting_time, mo.location
        FROM meeting_windows mw
        JOIN meeting_options mo ON mo.id = mw.selected_option_id
        WHERE mw.selected_option_id IS NOT NULL
          AND mo.meeting_date >= CURRENT_DATE
        ORDER BY mo.meeting_date ASC
      `;

      const meetings = await Promise.all(
        upcomingMeetings.map(async (um: any) => {
          const [lastVotingWindow] = await fastify.db`
            SELECT id, nomination_window_id FROM voting_windows
            WHERE deadline::date <= ${um.meeting_date}
            ORDER BY deadline DESC
            LIMIT 1
          `;

          if (!lastVotingWindow) return { ...um, book: null };

          const [winner] = await fastify.db`
            SELECT n.title, n.author
            FROM nominations n
            LEFT JOIN votes v ON v.nomination_id = n.id
              AND v.voting_window_id = ${lastVotingWindow.id}
              AND v.rank = 1
            WHERE n.window_id = ${lastVotingWindow.nomination_window_id}
            GROUP BY n.id, n.title, n.author
            ORDER BY COUNT(v.id) DESC, n.created_at ASC
            LIMIT 1
          `;

          return { ...um, book: winner ?? null };
        })
      );

      return { meetings };
    }
  );

  // POST /meeting-windows
  // Open a new meeting poll. Deadline auto-set to 3 days from now.
  // Body: { options: [{ date, time, location }] }
  fastify.post(
    "/meeting-windows",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { userId } = request.user;
      const { options } = request.body as {
        options: { date: string; time: string; location: string }[];
      };

      if (!options || !Array.isArray(options) || options.length === 0) {
        return reply.badRequest("options array is required");
      }

      const [user] = await fastify.db`SELECT id FROM users WHERE clerk_id = ${userId}`;
      if (!user) return reply.notFound("User not found");

      const [existing] = await fastify.db`
        SELECT id FROM meeting_windows WHERE deadline > NOW() LIMIT 1
      `;
      if (existing) return reply.conflict("A meeting poll is already active");

      const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const [newWindow] = await fastify.db`
        INSERT INTO meeting_windows (opened_by, deadline)
        VALUES (${user.id}, ${deadline})
        RETURNING id, opened_by, deadline, selected_option_id, created_at,
                  deadline > NOW() AS is_active
      `;

      const insertedOptions: any[] = [];
      for (const opt of options) {
        const timeValue = opt.time.length === 5 ? opt.time + ":00" : opt.time;
        const [inserted] = await fastify.db`
          INSERT INTO meeting_options (window_id, meeting_date, meeting_time, location)
          VALUES (${newWindow.id}, ${opt.date}, ${timeValue}, ${opt.location})
          RETURNING id, meeting_date, meeting_time, location, created_at
        `;
        insertedOptions.push({ ...inserted, vote_count: 0 });
      }

      return { window: newWindow, options: insertedOptions, user_votes: [] };
    }
  );

  // POST /meeting-votes
  // Submit availability votes — replaces any existing votes for this user in the active poll.
  // Body: { option_ids: number[] }
  fastify.post(
    "/meeting-votes",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { userId } = request.user;
      const { option_ids } = request.body as { option_ids: number[] };

      if (!Array.isArray(option_ids)) return reply.badRequest("option_ids array is required");

      const [user] = await fastify.db`SELECT id FROM users WHERE clerk_id = ${userId}`;
      if (!user) return reply.notFound("User not found");

      const [activeWindow] = await fastify.db`
        SELECT id FROM meeting_windows WHERE deadline > NOW() ORDER BY created_at DESC LIMIT 1
      `;
      if (!activeWindow) return reply.notFound("No active meeting poll");

      if (option_ids.length > 0) {
        const windowOptions = await fastify.db`
          SELECT id FROM meeting_options WHERE window_id = ${activeWindow.id}
        `;
        const validIds = new Set(windowOptions.map((o: any) => o.id));
        const allValid = option_ids.every((id) => validIds.has(id));
        if (!allValid) return reply.badRequest("Invalid option IDs");
      }

      await fastify.db.begin(async (sql: any) => {
        await sql`
          DELETE FROM meeting_votes WHERE window_id = ${activeWindow.id} AND voter_id = ${user.id}
        `;
        for (const optionId of option_ids) {
          await sql`
            INSERT INTO meeting_votes (window_id, option_id, voter_id)
            VALUES (${activeWindow.id}, ${optionId}, ${user.id})
          `;
        }
      });

      return { success: true };
    }
  );

  // POST /meeting-windows/:id/close
  // Close the meeting poll early and select the winning option (most votes).
  fastify.post(
    "/meeting-windows/:id/close",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const [window] = await fastify.db`
        SELECT id FROM meeting_windows WHERE id = ${id} AND deadline > NOW()
      `;
      if (!window) return reply.notFound("Active meeting window not found");

      const [winner] = await fastify.db`
        SELECT option_id
        FROM meeting_votes
        WHERE window_id = ${id}
        GROUP BY option_id
        ORDER BY COUNT(*) DESC, option_id ASC
        LIMIT 1
      `;

      const selectedOptionId = winner?.option_id ?? null;

      const [updated] = await fastify.db`
        UPDATE meeting_windows
        SET deadline = NOW() - interval '1 second',
            selected_option_id = ${selectedOptionId}
        WHERE id = ${id}
        RETURNING id, opened_by, deadline, selected_option_id, created_at,
                  deadline > NOW() AS is_active
      `;

      return { window: updated };
    }
  );

  // POST /meeting-windows/:id/cancel
  // Cancel the active meeting poll and delete all data.
  fastify.post(
    "/meeting-windows/:id/cancel",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const [window] = await fastify.db`
        SELECT id FROM meeting_windows WHERE id = ${id} AND deadline > NOW()
      `;
      if (!window) return reply.notFound("Active meeting window not found");

      await fastify.db`DELETE FROM meeting_votes WHERE window_id = ${id}`;
      await fastify.db`DELETE FROM meeting_options WHERE window_id = ${id}`;
      await fastify.db`DELETE FROM meeting_windows WHERE id = ${id}`;

      return { success: true };
    }
  );
}

async function getSelectedBook(
  fastify: FastifyInstance
): Promise<{ id: number; title: string; author: string } | null> {
  try {
    const [lastVotingWindow] = await fastify.db`
      SELECT id, nomination_window_id FROM voting_windows
      WHERE deadline <= NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (!lastVotingWindow) return null;

    const [winner] = await fastify.db`
      SELECT n.id, n.title, n.author
      FROM nominations n
      LEFT JOIN votes v ON v.nomination_id = n.id
        AND v.voting_window_id = ${lastVotingWindow.id}
        AND v.rank = 1
      WHERE n.window_id = ${lastVotingWindow.nomination_window_id}
      GROUP BY n.id, n.title, n.author
      ORDER BY COUNT(v.id) DESC, n.created_at ASC
      LIMIT 1
    `;

    return winner ?? null;
  } catch {
    return null;
  }
}
