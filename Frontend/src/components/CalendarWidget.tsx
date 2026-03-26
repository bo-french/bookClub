interface CalendarWidgetProps {
  meetingDate: string; // YYYY-MM-DD or ISO string
  meetingTime: string; // HH:MM or HH:MM:SS
  location: string;
  book?: { title: string; author: string } | null; // omit to hide book row entirely
  highlighted?: boolean;
}

function formatTime(time: string): string {
  const [hoursStr, minutesStr] = time.split(":");
  const h = parseInt(hoursStr);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutesStr} ${period} EST`;
}

export function CalendarWidget({
  meetingDate,
  meetingTime,
  location,
  book,
  highlighted = false,
}: CalendarWidgetProps) {
  const [year, month, day] = meetingDate.slice(0, 10).split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  const monthName = dateObj.toLocaleString("default", { month: "long" });
  const dayName = dateObj.toLocaleString("default", { weekday: "long" });

  return (
    <div
      className={`flex flex-col border rounded-xl overflow-hidden w-72 ${
        highlighted ? "border-primary shadow-sm" : "border-border"
      }`}
    >
      <div className="bg-primary text-primary-foreground px-4 py-1 text-xs font-semibold uppercase w-full text-center tracking-widest">
        {monthName} {year}
      </div>
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex flex-col items-center shrink-0 w-10">
          <span className="text-3xl font-bold leading-none">{day}</span>
          <span className="text-xs text-muted-foreground mt-0.5">{dayName.slice(0, 3)}</span>
        </div>
        <div className="w-px bg-border self-stretch" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium">{formatTime(meetingTime)}</span>
          <span className="text-sm text-muted-foreground truncate">{location}</span>
          {book !== undefined && (
            <span className="text-xs text-muted-foreground mt-1 italic truncate">
              {book ? `${book.title} by ${book.author}` : "No book voted on yet!"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
