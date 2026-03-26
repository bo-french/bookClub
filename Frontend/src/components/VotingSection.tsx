import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  getCurrentVotingWindow,
  openVotingWindow,
  castVote,
  closeVotingWindowEarly,
  cancelVotingWindow,
  setCurrentlyReading,
  type CurrentVotingResponse,
  type NomineeWithVotes,
} from "@/lib/api";
import { BookCover } from "@/components/BookCover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";

interface Props {
  currentUserClerkId: string;
  refreshKey?: number;
}

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
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1">{children}</div>
      </div>
    </div>
  );
}

function RankingInput({
  nominees,
  onSubmit,
  submitting,
}: {
  nominees: NomineeWithVotes[];
  onSubmit: (rankings: { nomination_id: number; rank: number }[]) => void;
  submitting: boolean;
}) {
  const [ordered, setOrdered] = useState([...nominees]);

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...ordered];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setOrdered(next);
  }

  function moveDown(index: number) {
    if (index === ordered.length - 1) return;
    const next = [...ordered];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setOrdered(next);
  }

  function handleSubmit() {
    const rankings = ordered.map((n, i) => ({ nomination_id: n.id, rank: i + 1 }));
    onSubmit(rankings);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Rank all books from most to least preferred using the arrows, then submit.
      </p>
      <div className="flex flex-col gap-2">
        {ordered.map((nominee, index) => {
          const nominatorName =
            [nominee.first_name, nominee.last_name].filter(Boolean).join(" ") || "A member";
          return (
            <div
              key={nominee.id}
              className="border border-border rounded-lg p-3 flex items-center gap-3"
            >
              <span className="text-base font-bold tabular-nums text-muted-foreground w-6 text-center shrink-0">
                {index + 1}
              </span>
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="font-semibold text-sm truncate">{nominee.title}</span>
                <span className="text-xs text-muted-foreground">
                  by {nominee.author} · Nominated by {nominatorName}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0 || submitting}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-tight px-1"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === ordered.length - 1 || submitting}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-tight px-1"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <Button size="sm" onClick={handleSubmit} disabled={submitting} className="self-end">
        {submitting ? "Submitting..." : "Submit Rankings"}
      </Button>
    </div>
  );
}

function VoteBar({
  nominee,
  voterCount,
  userRank,
  isWinner,
}: {
  nominee: NomineeWithVotes;
  voterCount: number;
  userRank: number | null;
  isWinner: boolean;
}) {
  const pct = voterCount > 0 ? Math.round((nominee.vote_count / voterCount) * 100) : 0;
  const nominatorName =
    [nominee.first_name, nominee.last_name].filter(Boolean).join(" ") || "A member";

  return (
    <div
      className={`border rounded-lg p-4 flex gap-3 transition-colors ${
        isWinner ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <BookCover title={nominee.title} author={nominee.author} />
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold text-base">{nominee.title}</span>
            <span className="text-sm text-muted-foreground">by {nominee.author}</span>
          </div>
          <p className="text-xs text-muted-foreground">Nominated by {nominatorName}</p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className="text-sm font-medium tabular-nums">
              {nominee.vote_count} 1st-choice
            </span>
            {isWinner && (
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Winner
              </span>
            )}
            {userRank !== null && (
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Your #{userRank}
              </span>
            )}
          </div>
        </div>

        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isWinner ? "bg-primary" : "bg-muted-foreground/40"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="text-xs text-muted-foreground">{pct}% of 1st-choice votes</p>
      </div>
    </div>
  );
}

export function VotingSection({ currentUserClerkId, refreshKey }: Props) {
  const { getToken } = useAuth();
  const [data, setData] = useState<CurrentVotingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [deadline, setDeadline] = useState(() =>
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [openingWindow, setOpeningWindow] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [closingEarly, setClosingEarly] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [settingReading, setSettingReading] = useState(false);
  const [readingSet, setReadingSet] = useState(false);

  async function fetchVoting() {
    try {
      const token = await getToken();
      if (!token) return;
      const result = await getCurrentVotingWindow(token);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load voting");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchVoting();
  }, [getToken, refreshKey]);

  async function handleOpenVoting(e: React.FormEvent) {
    e.preventDefault();
    setOpeningWindow(true);
    try {
      const token = await getToken();
      if (!token) return;
      await openVotingWindow(token, deadline);
      setShowOpenModal(false);
      setDeadline(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
      await fetchVoting();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open voting");
    } finally {
      setOpeningWindow(false);
    }
  }

  async function handleCloseEarly() {
    if (!data?.voting_window) return;
    setClosingEarly(true);
    try {
      const token = await getToken();
      if (!token) return;
      await closeVotingWindowEarly(token, data.voting_window.id);
      await fetchVoting();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close voting");
    } finally {
      setClosingEarly(false);
    }
  }

  async function handleCancel() {
    if (!data?.voting_window) return;
    setCancelling(true);
    try {
      const token = await getToken();
      if (!token) return;
      await cancelVotingWindow(token, data.voting_window.id);
      setShowCancelConfirm(false);
      await fetchVoting();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel voting");
    } finally {
      setCancelling(false);
    }
  }

  async function handleSubmitRankings(rankings: { nomination_id: number; rank: number }[]) {
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;
      await castVote(token, rankings);
      await fetchVoting();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit rankings");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetCurrentlyReading() {
    if (!winner) return;
    setSettingReading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await setCurrentlyReading(token, { title: winner.title, author: winner.author });
      setReadingSet(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set currently reading");
    } finally {
      setSettingReading(false);
    }
  }

  if (loading) return null;

  // Don't render anything while nominations are still active or no rounds exist
  if (!data || !data.nomination_window || data.nomination_window.is_active) {
    return null;
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  const { voting_window, nominees, voter_count, irv_result } = data;
  const userRankings = data.user_rankings ?? null;
  const hasRanked = userRankings !== null;
  const rankMap = new Map(userRankings?.map((r) => [r.nomination_id, r.rank]) ?? []);
  const isVotingActive = voting_window?.is_active ?? false;
  const deadlineLabel = voting_window
    ? new Date(voting_window.deadline).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  const winnerId = irv_result?.winner_id ?? null;
  const winner = winnerId !== null ? nominees.find((n) => n.id === winnerId) : null;

  // During active voting, leader by first-choice votes
  const leader = nominees[0];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 mt-8 pt-8 border-t border-border">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Voting</h2>

        <div className="flex gap-2">
          {!voting_window && (
            <Button size="sm" onClick={() => setShowOpenModal(true)}>
              Open Voting
            </Button>
          )}

          {voting_window && isVotingActive && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={closingEarly}
                onClick={handleCloseEarly}
              >
                {closingEarly ? "Closing..." : "Close Early"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowCancelConfirm(true)}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {!voting_window && (
        <p className="text-muted-foreground text-sm">
          The nomination window has closed. Open voting to let members choose the next book.
        </p>
      )}

      {voting_window && (
        <>
          {isVotingActive ? (
            <p className="text-sm text-muted-foreground">
              Voting open until{" "}
              <span className="font-medium text-foreground">{deadlineLabel}</span>
              {" · "}{voter_count} {voter_count === 1 ? "member has" : "members have"} ranked
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Voting closed on {deadlineLabel} · {voter_count}{" "}
              {voter_count === 1 ? "ballot" : "ballots"} cast
            </p>
          )}

          {/* Winner / current leader callout */}
          {!isVotingActive && winner && (
            <div className="rounded-lg border border-primary bg-primary/5 px-4 py-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-primary uppercase tracking-wide font-medium mb-0.5">
                  Winner (ranked choice)
                </p>
                <p className="font-semibold">{winner.title}</p>
                <p className="text-sm text-muted-foreground">by {winner.author}</p>
              </div>
              {readingSet ? (
                <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full shrink-0">
                  Now reading
                </span>
              ) : (
                <Button
                  size="sm"
                  disabled={settingReading}
                  onClick={handleSetCurrentlyReading}
                  className="shrink-0"
                >
                  {settingReading ? "Setting..." : "Start Reading"}
                </Button>
              )}
            </div>
          )}

          {isVotingActive && leader && leader.vote_count > 0 && (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 flex items-baseline justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">
                  Current leader (1st-choice votes)
                </p>
                <p className="font-semibold">{leader.title}</p>
                <p className="text-sm text-muted-foreground">by {leader.author}</p>
              </div>
              <p className="text-2xl font-bold tabular-nums shrink-0">
                {leader.vote_count}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  1st-choice
                </span>
              </p>
            </div>
          )}

          {/* Ranking input — shown when voting is active and user hasn't ranked yet */}
          {isVotingActive && !hasRanked && nominees.length > 0 && (
            <RankingInput
              nominees={nominees}
              onSubmit={handleSubmitRankings}
              submitting={submitting}
            />
          )}

          {/* Confirmation that user has submitted */}
          {isVotingActive && hasRanked && (
            <p className="text-sm text-muted-foreground">
              You've submitted your rankings.
            </p>
          )}

          {/* Results bars — shown after user has ranked or voting is closed */}
          {(hasRanked || !isVotingActive) && (
            <>
              {nominees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No nominees to vote on.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {nominees.map((n) => (
                    <VoteBar
                      key={n.id}
                      nominee={n}
                      voterCount={voter_count}
                      userRank={rankMap.get(n.id) ?? null}
                      isWinner={n.id === winnerId}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Cancel Voting Confirmation Modal */}
      {showCancelConfirm && voting_window && (
        <Modal title="Cancel voting?" onClose={() => setShowCancelConfirm(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              This will delete all{" "}
              <span className="font-medium text-foreground">{voter_count}</span>{" "}
              {voter_count === 1 ? "ballot" : "ballots"} and remove the voting window. You'll be
              returned to the nominations view with the option to open voting again.
            </p>
            <div className="flex gap-2 self-end">
              <Button variant="ghost" size="sm" onClick={() => setShowCancelConfirm(false)}>
                Keep it
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={cancelling}
                onClick={handleCancel}
              >
                {cancelling ? "Cancelling..." : "Yes, cancel voting"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Open Voting Modal */}
      {showOpenModal && (
        <Modal title="Open Voting" onClose={() => setShowOpenModal(false)}>
          <form onSubmit={handleOpenVoting} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vote-deadline">Voting deadline</Label>
              <Input
                id="vote-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Members rank all books until this date and time.
              </p>
            </div>

            {data.nominees.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">Nominees ({data.nominees.length})</p>
                <ul className="flex flex-col gap-1">
                  {data.nominees.map((n) => (
                    <li key={n.id} className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{n.title}</span> — {n.author}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.nominees.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No nominations were submitted for this round.
              </p>
            )}

            <div className="flex gap-2 self-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowOpenModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={openingWindow || data.nominees.length === 0}
              >
                {openingWindow ? "Opening..." : "Open Voting"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
