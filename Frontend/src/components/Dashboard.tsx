import { useUser, useAuth, useClerk } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient, getCurrentWindow, getCurrentVotingWindow } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

        const [nomData, votingData] = await Promise.all([
          getCurrentWindow(token),
          getCurrentVotingWindow(token),
        ]);

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
        <h1 className="text-2xl font-semibold">
          {getGreeting()}, {displayName}.
        </h1>

        {/* Upcoming Meetings */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Upcoming Meetings</h2>
          <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
        </section>

        {/* Actions */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Actions</h2>
          {!actionsLoaded ? null : actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You're all caught up — nothing needs your attention right now.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {actions.map((action) => (
                <Link key={action.label} to={action.href}>
                  <div className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <p className="font-medium text-sm">{action.label}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <span className="text-muted-foreground shrink-0">→</span>
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
