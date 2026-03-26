import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  getCurrentMeetingWindow,
  openMeetingWindow,
  castMeetingVotes,
  closeMeetingWindowEarly,
  cancelMeetingWindow,
  type CurrentMeetingResponse,
  type MeetingOptionDefault,
} from "@/lib/api";
import { CalendarWidget } from "@/components/CalendarWidget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";

function getNextMonthTuesdays(): MeetingOptionDefault[] {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const year = nextMonth.getFullYear();
  const month = nextMonth.getMonth();

  const options: MeetingOptionDefault[] = [];
  for (let day = 1; day <= 31; day++) {
    const d = new Date(year, month, day);
    if (d.getMonth() !== month) break;
    if (d.getDay() === 2) {
      options.push({
        date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        time: "17:00",
        location: "TeaHaus",
      });
    }
  }
  return options;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(time: string): string {
  const [hoursStr, minutesStr] = time.split(":");
  const h = parseInt(hoursStr);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutesStr} ${period} EST`;
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
        className="bg-background border border-border rounded-xl shadow-lg w-full max-w-lg mx-4 max-h-[85vh] flex flex-col"
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

export function MeetingPollSection() {
  const { getToken } = useAuth();
  const [data, setData] = useState<CurrentMeetingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showOpenPollModal, setShowOpenPollModal] = useState(false);
  const [draftOptions, setDraftOptions] = useState<MeetingOptionDefault[]>([]);
  const [openingPoll, setOpeningPoll] = useState(false);

  const [pendingVotes, setPendingVotes] = useState<Set<number>>(new Set());
  const [savingVotes, setSavingVotes] = useState(false);

  const [closingEarly, setClosingEarly] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function fetchData() {
    try {
      const token = await getToken();
      if (!token) return;
      const result = await getCurrentMeetingWindow(token);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meeting poll");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [getToken]);

  useEffect(() => {
    if (data) {
      setPendingVotes(new Set(data.user_votes));
    }
  }, [data]);

  function handleOpenPollModal() {
    setDraftOptions(getNextMonthTuesdays());
    setShowOpenPollModal(true);
  }

  async function handleOpenPoll(e: React.FormEvent) {
    e.preventDefault();
    setOpeningPoll(true);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await openMeetingWindow(token, draftOptions);
      setData({ ...result, selected_book: data?.selected_book ?? null });
      setShowOpenPollModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open meeting poll");
    } finally {
      setOpeningPoll(false);
    }
  }

  function updateDraftOption(index: number, field: keyof MeetingOptionDefault, value: string) {
    setDraftOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt))
    );
  }

  async function handleSaveVotes() {
    setSavingVotes(true);
    try {
      const token = await getToken();
      if (!token) return;
      await castMeetingVotes(token, [...pendingVotes]);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save availability");
    } finally {
      setSavingVotes(false);
    }
  }

  async function handleCloseEarly() {
    if (!data?.window) return;
    setClosingEarly(true);
    try {
      const token = await getToken();
      if (!token) return;
      await closeMeetingWindowEarly(token, data.window.id);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close poll");
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
      await cancelMeetingWindow(token, data.window.id);
      setData({
        window: null,
        options: [],
        user_votes: [],
        selected_book: data?.selected_book ?? null,
      });
      setShowCancelConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel poll");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <p className="text-muted-foreground text-sm">Loading meeting poll...</p>;
  if (error) return <p className="text-destructive text-sm">{error}</p>;

  const meetingWindow = data?.window ?? null;
  const options = data?.options ?? [];
  const isActive = meetingWindow?.is_active ?? false;
  const selectedOption = options.find((o) => o.id === meetingWindow?.selected_option_id) ?? null;

  const deadlineLabel = meetingWindow
    ? new Date(meetingWindow.deadline).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  const leadingOption = options.length > 0
    ? [...options].sort((a, b) => b.vote_count - a.vote_count || a.id - b.id)[0]
    : null;
  const hasAnyVotes = leadingOption !== null && leadingOption.vote_count > 0;

  const hasExistingVotes = (data?.user_votes.length ?? 0) > 0;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Meeting Poll</h2>

        {!meetingWindow && (
          <Button size="sm" onClick={handleOpenPollModal}>
            Open Meeting Poll
          </Button>
        )}

        {meetingWindow && isActive && (
          <div className="flex gap-2 flex-wrap">
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

        {meetingWindow && !isActive && (
          <Button size="sm" onClick={handleOpenPollModal}>
            Start New Poll
          </Button>
        )}
      </div>

      {/* Current book banner */}
      {data?.selected_book && (
        <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Current Book
          </p>
          <p className="text-sm font-semibold">{data.selected_book.title}</p>
          <p className="text-sm text-muted-foreground">by {data.selected_book.author}</p>
        </div>
      )}

      {/* No window */}
      {!meetingWindow && (
        <p className="text-sm text-muted-foreground">
          No meeting poll is open right now. Anyone can start one.
        </p>
      )}

      {/* Active window */}
      {meetingWindow && isActive && (
        <>
          <p className="text-sm text-muted-foreground">
            Poll closes on{" "}
            <span className="font-medium text-foreground">{deadlineLabel}</span>. Check all
            dates that work for you.
          </p>

          <div className="flex flex-col gap-2">
            {options.map((option) => {
              const checked = pendingVotes.has(option.id);
              return (
                <label
                  key={option.id}
                  className={`flex items-center gap-4 border rounded-lg p-4 cursor-pointer transition-colors select-none ${
                    checked
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-primary shrink-0"
                    checked={checked}
                    onChange={() => {
                      setPendingVotes((prev) => {
                        const next = new Set(prev);
                        if (next.has(option.id)) next.delete(option.id);
                        else next.add(option.id);
                        return next;
                      });
                    }}
                  />
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                    <p className="text-sm font-medium">{formatDate(option.meeting_date)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatTime(option.meeting_time)} · {option.location}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground shrink-0">
                    {option.vote_count} vote{option.vote_count !== 1 ? "s" : ""}
                  </span>
                </label>
              );
            })}
          </div>

          <Button
            size="sm"
            className="self-start"
            disabled={savingVotes}
            onClick={handleSaveVotes}
          >
            {savingVotes
              ? "Saving..."
              : hasExistingVotes
              ? "Update Availability"
              : "Save Availability"}
          </Button>

          {/* Current leader */}
          {hasAnyVotes && leadingOption && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-sm font-medium text-muted-foreground">Current leader</p>
              <CalendarWidget
                meetingDate={leadingOption.meeting_date}
                meetingTime={leadingOption.meeting_time}
                location={leadingOption.location}
                highlighted
              />
            </div>
          )}
        </>
      )}

      {/* Closed window */}
      {meetingWindow && !isActive && (
        <>
          {selectedOption ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Meeting scheduled — poll closed on {deadlineLabel}.
              </p>
              <CalendarWidget
                meetingDate={selectedOption.meeting_date}
                meetingTime={selectedOption.meeting_time}
                location={selectedOption.location}
                book={data?.selected_book ?? null}
                highlighted
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Meeting poll closed on {deadlineLabel}. No votes were cast.
            </p>
          )}
        </>
      )}

      {/* Open Poll Modal */}
      {showOpenPollModal && (
        <Modal title="Open Meeting Poll" onClose={() => setShowOpenPollModal(false)}>
          <form onSubmit={handleOpenPoll} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Edit the options below. The poll will close automatically in 3 days.
            </p>
            {draftOptions.map((opt, i) => (
              <div key={i} className="border border-border rounded-lg p-4 flex flex-col gap-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Option {i + 1}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor={`opt-date-${i}`}
                      className="text-xs text-muted-foreground"
                    >
                      Date
                    </Label>
                    <Input
                      id={`opt-date-${i}`}
                      type="date"
                      value={opt.date}
                      onChange={(e) => updateDraftOption(i, "date", e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor={`opt-time-${i}`}
                      className="text-xs text-muted-foreground"
                    >
                      Time
                    </Label>
                    <Input
                      id={`opt-time-${i}`}
                      type="time"
                      value={opt.time}
                      onChange={(e) => updateDraftOption(i, "time", e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor={`opt-loc-${i}`}
                      className="text-xs text-muted-foreground"
                    >
                      Location
                    </Label>
                    <Input
                      id={`opt-loc-${i}`}
                      type="text"
                      value={opt.location}
                      onChange={(e) => updateDraftOption(i, "location", e.target.value)}
                      placeholder="Location"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex gap-2 self-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowOpenPollModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={openingPoll}>
                {openingPoll ? "Opening..." : "Open Poll"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <Modal
          title="Cancel meeting poll?"
          onClose={() => setShowCancelConfirm(false)}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete the meeting poll and all votes. This cannot be
              undone.
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
