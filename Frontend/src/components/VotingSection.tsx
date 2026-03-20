import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  getCurrentVotingWindow,
  openVotingWindow,
  castVote,
  closeVotingWindowEarly,
  cancelVotingWindow,
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

function VoteBar({
  nominee,
  totalVotes,
  isUserVote,
  onVote,
  canVote,
  voting,
}: {
  nominee: NomineeWithVotes;
  totalVotes: number;
  isUserVote: boolean;
  onVote: (id: number) => void;
  canVote: boolean;
  voting: boolean;
}) {
  const pct = totalVotes > 0 ? Math.round((nominee.vote_count / totalVotes) * 100) : 0;
  const nominatorName =
    [nominee.first_name, nominee.last_name].filter(Boolean).join(" ") || "A member";

  return (
    <div
      className={`border rounded-lg p-4 flex gap-3 transition-colors ${
        isUserVote ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <BookCover title={nominee.title} author={nominee.author} />
      <div className="flex flex-col gap-2 min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-base truncate">{nominee.title}</span>
            <span className="text-sm text-muted-foreground shrink-0">by {nominee.author}</span>
          </div>
          <p className="text-xs text-muted-foreground">Nominated by {nominatorName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-medium tabular-nums">
            {nominee.vote_count} {nominee.vote_count === 1 ? "vote" : "votes"}
          </span>
          {canVote && (
            <Button size="sm" variant="outline" disabled={voting} onClick={() => onVote(nominee.id)}>
              {voting ? "..." : "Vote"}
            </Button>
          )}
          {isUserVote && (
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              Your vote
            </span>
          )}
        </div>
      </div>

      {/* Horizontal bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isUserVote ? "bg-primary" : "bg-muted-foreground/40"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs text-muted-foreground">{pct}%</p>
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
  const [deadline, setDeadline] = useState("");
  const [openingWindow, setOpeningWindow] = useState(false);

  const [voting, setVoting] = useState(false);
  const [closingEarly, setClosingEarly] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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
      setDeadline("");
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

  async function handleVote(nominationId: number) {
    setVoting(true);
    try {
      const token = await getToken();
      if (!token) return;
      await castVote(token, nominationId);
      await fetchVoting();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cast vote");
    } finally {
      setVoting(false);
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

  const { voting_window, nominees } = data;
  const userVoteId = data.user_vote?.nomination_id ?? null;
  const isVotingActive = voting_window?.is_active ?? false;
  const totalVotes = nominees.reduce((sum, n) => sum + n.vote_count, 0);
  const deadlineLabel = voting_window
    ? new Date(voting_window.deadline).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
  const leader = nominees[0]; // already sorted desc by vote_count

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 mt-8 pt-8 border-t border-border">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Voting</h2>

        <div className="flex gap-2">
          {/* No voting window yet — nominations are closed */}
          {!voting_window && (
            <Button size="sm" onClick={() => setShowOpenModal(true)}>
              Open Voting
            </Button>
          )}

          {/* Active voting controls */}
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
              {" · "}{totalVotes} {totalVotes === 1 ? "vote" : "votes"} cast
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Voting closed on {deadlineLabel} · {totalVotes} {totalVotes === 1 ? "vote" : "votes"} cast
            </p>
          )}

          {/* Current leader callout */}
          {leader && leader.vote_count > 0 && (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 flex items-baseline justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">
                  {isVotingActive ? "Current leader" : "Winner"}
                </p>
                <p className="font-semibold">{leader.title}</p>
                <p className="text-sm text-muted-foreground">by {leader.author}</p>
              </div>
              <p className="text-2xl font-bold tabular-nums shrink-0">
                {leader.vote_count}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  {leader.vote_count === 1 ? "vote" : "votes"}
                </span>
              </p>
            </div>
          )}

          {/* User has voted or voting is closed */}
          {userVoteId && (
            <p className="text-sm text-muted-foreground">
              You voted for{" "}
              <span className="font-medium text-foreground">
                {nominees.find((n) => n.id === userVoteId)?.title ?? "a nomination"}
              </span>
              .
            </p>
          )}

          {/* Nominees with bars */}
          {nominees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No nominees to vote on.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {nominees.map((n) => (
                <VoteBar
                  key={n.id}
                  nominee={n}
                  totalVotes={totalVotes}
                  isUserVote={n.id === userVoteId}
                  onVote={handleVote}
                  canVote={isVotingActive && userVoteId === null}
                  voting={voting}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Cancel Voting Confirmation Modal */}
      {showCancelConfirm && voting_window && (
        <Modal
          title="Cancel voting?"
          onClose={() => setShowCancelConfirm(false)}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              This will delete all{" "}
              <span className="font-medium text-foreground">{totalVotes}</span>{" "}
              {totalVotes === 1 ? "vote" : "votes"} and remove the voting window. You'll be
              returned to the nominations view with the option to open voting again.
            </p>
            <div className="flex gap-2 self-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCancelConfirm(false)}
              >
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
                Members can cast their vote until this date and time.
              </p>
            </div>

            {/* Nominee summary */}
            {data.nominees.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">
                  Nominees ({data.nominees.length})
                </p>
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
              <Button type="submit" size="sm" disabled={openingWindow || data.nominees.length === 0}>
                {openingWindow ? "Opening..." : "Open Voting"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
