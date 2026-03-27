import { useUser, useAuth, useClerk } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient, getCurrentWindow, getCurrentVotingWindow, getCurrentMeetingWindow, getUpcomingMeetings, type UpcomingMeeting } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarWidget } from "@/components/CalendarWidget";
import { Header } from "./Header";

interface UserInfo {
  id: number;
  clerk_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

interface ActionItem {
  label: string;
  description: string;
  href: string;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Dashboard() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [actionsLoaded, setActionsLoaded] = useState(false);
  const [upcomingMeetings, setUpcomingMeetings] = useState<UpcomingMeeting[]>([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        if (!token) return;

        await apiClient("/users/sync", { method: "POST" }, token);
        const data: UserInfo = await apiClient("/me", {}, token);
        setUserInfo(data);

        const [nomData, votingData, meetingData, meetingsData] = await Promise.all([
          getCurrentWindow(token),
          getCurrentVotingWindow(token),
          getCurrentMeetingWindow(token).catch(() => null),
          getUpcomingMeetings(token).catch(() => ({ meetings: [] })),
        ]);

        setUpcomingMeetings(meetingsData.meetings);

        const pending: ActionItem[] = [];

        if (nomData.window?.is_active) {
          const userHasNominated = nomData.nominations.some(
            (n) => n.nominated_by_clerk_id === data.clerk_id
          );
          if (!userHasNominated) {
            pending.push({
              label: "Nominate a book",
              description: "Nominations are open. Submit your pick for the next read.",
              href: "/nominations-voting",
            });
          }
        }

        if (votingData.voting_window?.is_active && !votingData.user_rankings) {
          pending.push({
            label: "Rank books for voting",
            description: "Voting is open. Rank the nominated books to cast your ballot.",
            href: "/nominations-voting",
          });
        }

        if (meetingData?.window?.is_active && meetingData.user_votes.length === 0) {
          pending.push({
            label: "Vote on meeting time",
            description: "A meeting poll is open. Mark which dates work for you.",
            href: "/meetings",
          });
        }

        setActions(pending);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
        setActionsLoaded(true);
      }
    }

    load();
  }, [getToken]);

  const displayName = userInfo?.first_name || user?.firstName || "there";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground text-lg">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-destructive text-center mb-4">{error}</p>
            <Button onClick={() => signOut()} variant="outline" className="w-full">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen p-6 max-w-2xl mx-auto flex flex-col gap-10">
        {/* Greeting */}
        <h1 className="text-4xl font-bold tracking-tight">
          {getGreeting()}, {displayName}.
        </h1>

        {/* Upcoming Meetings */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold uppercase tracking-wide text-primary">Upcoming Meetings</h2>
          {upcomingMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No upcoming meetings.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {upcomingMeetings.map((meeting) => (
                <CalendarWidget
                  key={meeting.id}
                  meetingDate={meeting.meeting_date}
                  meetingTime={meeting.meeting_time}
                  location={meeting.location}
                  book={meeting.book}
                />
              ))}
            </div>
          )}
        </section>

        {/* Actions */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold uppercase tracking-wide text-primary">Actions</h2>
          {!actionsLoaded ? null : actions.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              You're all caught up — nothing needs your attention right now.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {actions.map((action) => (
                <Link key={action.label} to={action.href}>
                  <div className="border-2 border-primary/20 rounded-lg p-4 hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <p className="font-bold text-sm">{action.label}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <span className="text-primary font-bold shrink-0">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
