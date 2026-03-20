import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  getCurrentWindow,
  openNominationWindow,
  submitNomination,
  closeNominationWindowEarly,
  cancelNominationWindow,
  type CurrentWindowResponse,
  type Nomination,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";

interface Props {
  currentUserClerkId: string;
  onNominationWindowChange?: () => void;
}

function NominationCard({ nomination }: { nomination: Nomination }) {
  const nominatorName =
    [nomination.first_name, nomination.last_name].filter(Boolean).join(" ") ||
    "A member";
  return (
    <div className="border border-border rounded-lg p-4 flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-base">{nomination.title}</span>
        <span className="text-sm text-muted-foreground shrink-0">
          by {nomination.author}
        </span>
      </div>
      <p className="text-sm text-foreground/80">{nomination.summary}</p>
      {nomination.pitch && (
        <p className="text-sm italic text-muted-foreground mt-1">
          "{nomination.pitch}"
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-1">
        Nominated by {nominatorName}
      </p>
    </div>
  );
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

export function NominationsSection({ currentUserClerkId, onNominationWindowChange }: Props) {
  const { getToken } = useAuth();
  const [data, setData] = useState<CurrentWindowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / form visibility
  const [showOpenWindowModal, setShowOpenWindowModal] = useState(false);
  const [showNominationsModal, setShowNominationsModal] = useState(false);
  const [showNominationForm, setShowNominationForm] = useState(false);

  // Open-window form state
  const [deadline, setDeadline] = useState("");
  const [openingWindow, setOpeningWindow] = useState(false);

  // Nomination form state
  const [nomTitle, setNomTitle] = useState("");
  const [nomAuthor, setNomAuthor] = useState("");
  const [nomSummary, setNomSummary] = useState("");
  const [nomPitch, setNomPitch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Close early / cancel state
  const [closingEarly, setClosingEarly] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function fetchWindow() {
    try {
      const token = await getToken();
      if (!token) return;
      const result = await getCurrentWindow(token);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load nominations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWindow();
  }, [getToken]);

  async function handleOpenWindow(e: React.FormEvent) {
    e.preventDefault();
    setOpeningWindow(true);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await openNominationWindow(token, deadline);
      setData(result);
      setShowOpenWindowModal(false);
      setDeadline("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open window");
    } finally {
      setOpeningWindow(false);
    }
  }

  async function handleSubmitNomination(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;
      await submitNomination(token, {
        title: nomTitle,
        author: nomAuthor,
        summary: nomSummary,
        pitch: nomPitch || undefined,
      });
      setNomTitle("");
      setNomAuthor("");
      setNomSummary("");
      setNomPitch("");
      setShowNominationForm(false);
      await fetchWindow();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit nomination");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCloseEarly() {
    if (!data?.window) return;
    setClosingEarly(true);
    try {
      const token = await getToken();
      if (!token) return;
      await closeNominationWindowEarly(token, data.window.id);
      await fetchWindow();
      onNominationWindowChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close window");
    } finally {
      setClosingEarly(false);
    }
  }

  async function handleCancel() {
    if (!data?.window) return;
    setCancelling(true);
    try {
      const token = await getToken();
      if (!token) return;
      await cancelNominationWindow(token, data.window.id);
      setData({ window: null, nominations: [] });
      setShowCancelConfirm(false);
      onNominationWindowChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading nominations...</p>;
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  const window = data?.window ?? null;
  const nominations = data?.nominations ?? [];
  const isActive = window?.is_active ?? false;
  const userHasNominated = nominations.some(
    (n) => n.nominated_by_clerk_id === currentUserClerkId
  );

  const deadlineLabel = window
    ? new Date(window.deadline).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Book Nominations</h2>

        {/* No window at all */}
        {!window && (
          <Button size="sm" onClick={() => setShowOpenWindowModal(true)}>
            Open Nominations
          </Button>
        )}

        {/* Active window controls */}
        {window && isActive && (
          <div className="flex gap-2">
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
          </div>
        )}

        {/* Closed window */}
        {window && !isActive && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNominationsModal(true)}
            >
              View Nominations
            </Button>
            <Button size="sm" onClick={() => setShowOpenWindowModal(true)}>
              Start New Round
            </Button>
          </div>
        )}
      </div>

      {/* No window state */}
      {!window && (
        <p className="text-muted-foreground text-sm">
          No nominations are open right now. Anyone can start a new round.
        </p>
      )}

      {/* Closed window state */}
      {window && !isActive && (
        <p className="text-muted-foreground text-sm">
          The nomination window closed on {deadlineLabel}. {nominations.length}{" "}
          book{nominations.length !== 1 ? "s" : ""} were nominated.
        </p>
      )}

      {/* Active window state */}
      {window && isActive && (
        <>
          <p className="text-sm text-muted-foreground">
            Nominations open until <span className="font-medium text-foreground">{deadlineLabel}</span>
          </p>

          {userHasNominated ? (
            <p className="text-sm text-muted-foreground">
              You've submitted your nomination for this round.
            </p>
          ) : (
            <>
              {!showNominationForm && (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => setShowNominationForm(true)}
                >
                  Add My Nomination
                </Button>
              )}
              {showNominationForm && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Nominate a Book</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmitNomination} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="nom-title">Title</Label>
                        <Input
                          id="nom-title"
                          value={nomTitle}
                          onChange={(e) => setNomTitle(e.target.value)}
                          placeholder="Book title"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="nom-author">Author</Label>
                        <Input
                          id="nom-author"
                          value={nomAuthor}
                          onChange={(e) => setNomAuthor(e.target.value)}
                          placeholder="Author name"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="nom-summary">Summary</Label>
                        <textarea
                          id="nom-summary"
                          value={nomSummary}
                          onChange={(e) => setNomSummary(e.target.value)}
                          placeholder="Brief description of the book"
                          rows={3}
                          required
                          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:outline-1 ring-ring/10 outline-ring/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="nom-pitch">
                          Your pitch{" "}
                          <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <textarea
                          id="nom-pitch"
                          value={nomPitch}
                          onChange={(e) => setNomPitch(e.target.value)}
                          placeholder="Why should the club read this?"
                          rows={2}
                          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:outline-1 ring-ring/10 outline-ring/50"
                        />
                      </div>
                      <div className="flex gap-2 self-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowNominationForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={submitting}>
                          {submitting ? "Submitting..." : "Submit"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Live nominations list */}
          {nominations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No nominations yet — be the first!
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">
                {nominations.length} nomination{nominations.length !== 1 ? "s" : ""} so far
              </p>
              {nominations.map((n) => (
                <NominationCard key={n.id} nomination={n} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Open Nominations Window Modal */}
      {showOpenWindowModal && (
        <Modal
          title="Open Nominations"
          onClose={() => setShowOpenWindowModal(false)}
        >
          <form onSubmit={handleOpenWindow} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deadline">Nomination deadline</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Members can submit nominations until this date and time.
              </p>
            </div>
            <div className="flex gap-2 self-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowOpenWindowModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={openingWindow}>
                {openingWindow ? "Opening..." : "Open Nominations"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Read-only Nominations Modal (for closed windows) */}
      {showNominationsModal && window && !isActive && (
        <Modal
          title={`Nominations — closed ${deadlineLabel}`}
          onClose={() => setShowNominationsModal(false)}
        >
          {nominations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No nominations were submitted.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {nominations.map((n) => (
                <NominationCard key={n.id} nomination={n} />
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <Modal
          title="Cancel nomination window?"
          onClose={() => setShowCancelConfirm(false)}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete the nomination window and all{" "}
              <span className="font-medium text-foreground">{nominations.length}</span>{" "}
              nomination{nominations.length !== 1 ? "s" : ""} submitted so far. This cannot be undone.
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
                {cancelling ? "Cancelling..." : "Yes, cancel it"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
