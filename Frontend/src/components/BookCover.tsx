import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { getBookCoverUrl } from "@/lib/api";

interface Props {
  title: string;
  author: string;
  className?: string;
}

export function BookCover({ title, author, className = "" }: Props) {
  const { getToken } = useAuth();
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchCover() {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const result = await getBookCoverUrl(token, title, author);
        if (!cancelled) {
          setCoverUrl(result.cover_url);
        }
      } catch {
        // silently fail — cover is not critical
      }
    }

    fetchCover();
    return () => { cancelled = true; };
  }, [title, author, getToken]);

  if (!coverUrl || failed) {
    return (
      <div
        className={`bg-muted rounded flex items-center justify-center text-muted-foreground text-xs shrink-0 ${className}`}
        style={{ width: 48, height: 72 }}
      >
        No cover
      </div>
    );
  }

  return (
    <img
      src={coverUrl}
      alt={`Cover of ${title}`}
      className={`rounded object-cover shrink-0 ${className}`}
      style={{ width: 48, height: 72 }}
      onError={() => setFailed(true)}
    />
  );
}
