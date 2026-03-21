import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiClient } from "@/lib/api";
import { Header } from "./Header";
import { NominationsSection } from "./NominationsSection";
import { VotingSection } from "./VotingSection";
import { PastNominationsSection } from "./PastNominationsSection";

export function NominationsVotingPage() {
  const { getToken } = useAuth();
  const [userClerkId, setUserClerkId] = useState<string | null>(null);
  const [votingRefreshKey, setVotingRefreshKey] = useState(0);

  useEffect(() => {
    async function fetchUser() {
      const token = await getToken();
      if (!token) return;
      await apiClient("/users/sync", { method: "POST" }, token);
      const data = await apiClient("/me", {}, token);
      setUserClerkId(data.clerk_id);
    }
    fetchUser();
  }, [getToken]);

  if (!userClerkId) return null;

  return (
    <>
      <Header />
      <main className="min-h-screen p-6">
        <PastNominationsSection />
        <NominationsSection
          currentUserClerkId={userClerkId}
          onNominationWindowChange={() => setVotingRefreshKey((k) => k + 1)}
        />
        <VotingSection
          currentUserClerkId={userClerkId}
          refreshKey={votingRefreshKey}
        />
      </main>
    </>
  );
}
