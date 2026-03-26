import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { getPastMeetings, type PastMeeting } from "@/lib/api";

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(time: string): string {
  const [hoursStr, minutesStr] = time.split(":");
  const h = parseInt(hoursStr);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutesStr} ${period} EST`;
}

function PastMeetingRow({ meeting }: { meeting: PastMeeting }) {
  return (
    <div className="flex flex-col gap-1 py-4 border-b border-border last:border-0">
      <p className="text-sm font-medium">{formatDate(meeting.meeting_date)}</p>
      <p className="text-sm text-muted-foreground">
        {formatTime(meeting.meeting_time)} · {meeting.location}
      </p>
      {meeting.book ? (
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground/70 font-medium">{meeting.book.title}</span>
          {" "}by {meeting.book.author}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground italic">No book on record</p>
      )}
    </div>
  );
}

export function PastMeetingsSection() {
  const { getToken } = useAuth();
  const [meetings, setMeetings] = useState<PastMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const token = await getToken();
        if (!token) return;
        const result = await getPastMeetings(token);
        setMeetings(result.meetings);
      } catch {
        // silently fail — past meetings is secondary info
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [getToken]);

  if (loading || meetings.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-2 mt-8">
      <h2 className="text-xl font-semibold">Past Meetings</h2>
      <div className="border border-border rounded-lg px-4 divide-y divide-border">
        {meetings.map((meeting) => (
          <PastMeetingRow key={meeting.id} meeting={meeting} />
        ))}
      </div>
    </div>
  );
}
