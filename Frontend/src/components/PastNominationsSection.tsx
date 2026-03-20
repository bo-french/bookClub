import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  getPastVotingResults,
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

export function PastNominationsSection() {
  const { getToken } = useAuth();
  const [data, setData] = useState<PastVotingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
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
  }, [getToken]);

  // Don't render anything if there are no past results
  if (loading || !data?.voting_window || !data.nominees.length) {
    return null;
  }

  const { voting_window, nominees } = data;
  const totalVotes = nominees.reduce((sum, n) => sum + n.vote_count, 0);
  const winner = nominees[0]?.vote_count > 0 ? nominees[0] : null;
  const votingClosedDate = new Date(voting_window.deadline).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });

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
          title="Last Voting Results"
          onClose={() => setShowModal(false)}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Voting closed {votingClosedDate} &middot; {totalVotes}{" "}
              {totalVotes === 1 ? "vote" : "votes"} cast
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
        </Modal>
      )}
    </>
  );
}
