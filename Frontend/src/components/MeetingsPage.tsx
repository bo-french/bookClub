import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiClient } from "@/lib/api";
import { Header } from "./Header";
import { MeetingPollSection } from "./MeetingPollSection";
import { PastMeetingsSection } from "./PastMeetingsSection";

export function MeetingsPage() {
  const { getToken } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const token = await getToken();
      if (!token) return;
      await apiClient("/users/sync", { method: "POST" }, token);
      setReady(true);
    }
    init();
  }, [getToken]);

  if (!ready) return null;

  return (
    <>
      <Header />
      <main className="min-h-screen p-6">
        <MeetingPollSection />
        <PastMeetingsSection />
      </main>
    </>
  );
}
