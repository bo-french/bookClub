import { useUser, useAuth, useClerk } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

export function Dashboard() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function syncAndFetchUser() {
      try {
        setLoading(true);
        setError(null);

        const token = await getToken();

        // Sync the user with the backend
        await apiClient("/users/sync", { method: "POST" }, token);

        // Fetch the user's info
        const data = await apiClient("/me", {}, token);
        setUserInfo(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load user data");
      } finally {
        setLoading(false);
      }
    }

    syncAndFetchUser();
  }, [getToken]);

  const displayName = userInfo
    ? [userInfo.first_name, userInfo.last_name].filter(Boolean).join(" ") || "User"
    : user?.fullName || "User";

  const handleSignOut = () => {
    signOut();
  };

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
            <Button onClick={handleSignOut} variant="outline" className="w-full">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Book Club</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {(userInfo?.image_url || user?.imageUrl) && (
            <img
              src={userInfo?.image_url || user?.imageUrl}
              alt={displayName}
              className="w-20 h-20 rounded-full border-2 border-muted"
            />
          )}
          <div className="text-center space-y-1">
            <p className="text-lg font-semibold">
              {displayName}
            </p>
            <p className="text-sm text-muted-foreground">
              {userInfo?.email || user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
          <Button onClick={handleSignOut} variant="outline" className="w-full mt-4">
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
