import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  getPastVotingResults,
  type PastVotingCycle,
  type PastVotingResponse,
  type NomineeWithVotes,
} from "@/lib/api";
import { BookCover } from "@/components/BookCover";
import { Button } from "@/components/ui/button";

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-xl shadow-lg w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1">{children}</div>
      </div>
    </div>
  );
}

function PastNomineeCard({
  nominee,
  isWinner,
  totalVotes,
}: {
  nominee: NomineeWithVotes;
  isWinner: boolean;
  totalVotes: number;
}) {
  const nominatorName =
    [nominee.first_name, nominee.last_name].filter(Boolean).join(" ") ||
    "A member";
  const pct = totalVotes > 0 ? Math.round((nominee.vote_count / totalVotes) * 100) : 0;

  return (
    <div
      className={`border rounded-lg p-4 flex gap-3 transition-colors ${
        isWinner ? "border-yellow-500/50 bg-yellow-500/5" : "border-border"
      }`}
    >
      <BookCover title={nominee.title} author={nominee.author} />
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              {isWinner && (
                <span className="text-lg" title="Winner">
                  &#127942;
                </span>
              )}
              <span className="font-semibold text-base truncate">{nominee.title}</span>
            </div>
            <span className="text-sm text-muted-foreground">by {nominee.author}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium tabular-nums">
              {nominee.vote_count} {nominee.vote_count === 1 ? "vote" : "votes"}
            </span>
            {isWinner && (
              <span className="text-xs font-medium text-yellow-700 bg-yellow-500/15 px-2 py-0.5 rounded-full">
                Winner
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-foreground/80">{nominee.summary}</p>
        {nominee.pitch && (
          <p className="text-sm italic text-muted-foreground">"{nominee.pitch}"</p>
        )}
        <p className="text-xs text-muted-foreground">Nominated by {nominatorName}</p>

        {/* Vote bar */}
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isWinner ? "bg-yellow-500" : "bg-muted-foreground/40"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{pct}%</p>
      </div>
    </div>
  );
}

function CycleSection({ cycle }: { cycle: PastVotingCycle }) {
  const { voting_window, nominees } = cycle;
  const totalVotes = nominees.reduce((sum, n) => sum + n.vote_count, 0);
  const winner = nominees[0]?.vote_count > 0 ? nominees[0] : null;
  const votingClosedDate = new Date(voting_window.deadline).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Cycle header */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <h3 className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
          {votingClosedDate}
        </h3>
        <div className="h-px flex-1 bg-border" />
      </div>

      <p className="text-sm text-muted-foreground">
        {totalVotes} {totalVotes === 1 ? "vote" : "votes"} cast
      </p>

      {/* Winner callout */}
      {winner && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">&#127942;</span>
            <div>
              <p className="font-semibold">{winner.title}</p>
              <p className="text-sm text-muted-foreground">by {winner.author}</p>
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums shrink-0">
            {winner.vote_count}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              {winner.vote_count === 1 ? "vote" : "votes"}
            </span>
          </p>
        </div>
      )}

      {/* All nominees */}
      <div className="flex flex-col gap-3">
        {nominees.map((n) => (
          <PastNomineeCard
            key={n.id}
            nominee={n}
            isWinner={winner?.id === n.id}
            totalVotes={totalVotes}
          />
        ))}
      </div>
    </div>
  );
}

const MOCK_CYCLES: PastVotingCycle[] = [
  {
    voting_window: {
      id: 999, nomination_window_id: 999, opened_by: 1,
      deadline: "2026-03-20T23:59:59Z", created_at: "2026-03-15T00:00:00Z", is_active: false,
    },
    nomination_window: { id: 999, deadline: "2026-03-14T23:59:59Z", created_at: "2026-03-10T00:00:00Z" },
    nominees: [
      { id: 1, title: "Project Hail Mary", author: "Andy Weir",
        summary: "An astronaut wakes up alone on a spaceship with no memory of how he got there, and must save Earth from an extinction-level threat.",
        pitch: "If you liked The Martian, this is even better.", vote_count: 5,
        created_at: "2026-03-11T00:00:00Z", nominated_by_clerk_id: "mock_1", first_name: "Alice", last_name: "Johnson" },
      { id: 2, title: "The Midnight Library", author: "Matt Haig",
        summary: "A woman finds herself in a library between life and death, where each book lets her live a different version of her life.",
        pitch: "A beautiful story about regret and second chances.", vote_count: 3,
        created_at: "2026-03-11T00:00:00Z", nominated_by_clerk_id: "mock_2", first_name: "Bob", last_name: "Smith" },
      { id: 3, title: "Klara and the Sun", author: "Kazuo Ishiguro",
        summary: "An Artificial Friend observes the world from a store shelf, waiting to be chosen, and learns what it means to love.",
        pitch: null, vote_count: 1,
        created_at: "2026-03-12T00:00:00Z", nominated_by_clerk_id: "mock_3", first_name: "Carol", last_name: null },
    ],
  },
  {
    voting_window: {
      id: 998, nomination_window_id: 998, opened_by: 1,
      deadline: "2026-02-28T23:59:59Z", created_at: "2026-02-20T00:00:00Z", is_active: false,
    },
    nomination_window: { id: 998, deadline: "2026-02-19T23:59:59Z", created_at: "2026-02-15T00:00:00Z" },
    nominees: [
      { id: 4, title: "Dune", author: "Frank Herbert",
        summary: "A young nobleman must navigate the deadly politics of a desert planet that holds the key to the most valuable substance in the universe.",
        pitch: "The greatest sci-fi novel ever written.", vote_count: 7,
        created_at: "2026-02-16T00:00:00Z", nominated_by_clerk_id: "mock_4", first_name: "Dave", last_name: "Wilson" },
      { id: 5, title: "Piranesi", author: "Susanna Clarke",
        summary: "A man lives in a mysterious labyrinthine house filled with statues and tidal waters, slowly uncovering the truth of his existence.",
        pitch: "Utterly unique and hauntingly beautiful.", vote_count: 4,
        created_at: "2026-02-16T00:00:00Z", nominated_by_clerk_id: "mock_5", first_name: "Eve", last_name: "Garcia" },
    ],
  },
];

export function PastNominationsSection() {
  const { getToken } = useAuth();
  const [data, setData] = useState<PastVotingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const useMock = new URLSearchParams(window.location.search).has("mock");

  useEffect(() => {
    if (useMock) {
      setData({ cycles: MOCK_CYCLES });
      setLoading(false);
      return;
    }

    async function fetchPast() {
      try {
        const token = await getToken();
        if (!token) return;
        const result = await getPastVotingResults(token);
        setData(result);
      } catch {
        // silently fail — past results are not critical
      } finally {
        setLoading(false);
      }
    }

    fetchPast();
  }, [getToken, useMock]);

  if (loading || !data?.cycles.length) {
    return null;
  }

  return (
    <>
      <div className="w-full max-w-2xl mx-auto flex justify-end mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowModal(true)}
        >
          Past Results
        </Button>
      </div>

      {showModal && (
        <Modal
          title="Past Voting Results"
          onClose={() => setShowModal(false)}
        >
          <div className="flex flex-col gap-6">
            {data.cycles.map((cycle) => (
              <CycleSection key={cycle.voting_window.id} cycle={cycle} />
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
