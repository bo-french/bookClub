import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  getCurrentlyReading,
  getBookComments,
  postBookComment,
  type CurrentlyReadingBook,
  type BookComment,
} from "@/lib/api";
import { Header } from "./Header";
import { BookCover } from "./BookCover";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const MOCK_BOOK: CurrentlyReadingBook = {
  id: 999,
  title: "Project Hail Mary",
  author: "Andy Weir",
  started_at: "2026-03-21T00:00:00Z",
  read_by: "2026-04-10T19:00:00Z",
  set_by_first_name: "Alice",
  set_by_last_name: "Johnson",
};

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CurrentlyReadingPage() {
  const { getToken } = useAuth();
  const [book, setBook] = useState<CurrentlyReadingBook | null>(null);
  const [loading, setLoading] = useState(true);

  const [spoilersOpen, setSpoilersOpen] = useState(false);
  const [comments, setComments] = useState<BookComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [posting, setPosting] = useState(false);

  const useMock = new URLSearchParams(window.location.search).has("mock");

  useEffect(() => {
    if (useMock) {
      setBook(MOCK_BOOK);
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await getCurrentlyReading(token);
        setBook(data.book);
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken, useMock]);

  return (
    <>
      <Header />
      <main className="min-h-screen p-6 max-w-2xl mx-auto flex flex-col gap-10">
        <h1 className="text-2xl font-semibold">Currently Reading</h1>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : !book ? (
          <p className="text-sm text-muted-foreground">
            No book is currently being read by the club.
          </p>
        ) : (
          <>
          <Card>
            <CardContent className="pt-6 flex gap-5 items-start">
              <BookCover
                title={book.title}
                author={book.author}
                className="!w-24 !h-36"
              />
              <div className="flex flex-col gap-1.5">
                <h2 className="text-lg font-semibold">{book.title}</h2>
                <p className="text-sm text-muted-foreground">
                  by {book.author}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Started {formatDate(book.started_at)}
                </p>
                {book.read_by && (
                  <p className="text-sm font-medium text-foreground mt-1">
                    Read by {formatDate(book.read_by)}
                  </p>
                )}
                {(book.set_by_first_name || book.set_by_last_name) && (
                  <p className="text-xs text-muted-foreground">
                    Set by {[book.set_by_first_name, book.set_by_last_name].filter(Boolean).join(" ")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Spoiler discussion section */}
          <div className="flex flex-col gap-4">
            {!spoilersOpen ? (
              <Button
                variant="outline"
                className="self-start"
                onClick={async () => {
                  setSpoilersOpen(true);
                  setCommentsLoading(true);
                  try {
                    const token = await getToken();
                    if (!token) return;
                    const data = await getBookComments(token);
                    setComments(data.comments);
                  } catch {
                    // fail silently
                  } finally {
                    setCommentsLoading(false);
                  }
                }}
              >
                Show Discussion (contains spoilers)
              </Button>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Discussion</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSpoilersOpen(false)}
                  >
                    Hide Spoilers
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
                  Spoiler warning — this section may contain details about the book's plot.
                </p>

                {/* Comment input */}
                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!commentBody.trim()) return;
                    setPosting(true);
                    try {
                      const token = await getToken();
                      if (!token) return;
                      const data = await postBookComment(token, commentBody);
                      setComments((prev) => [...prev, data.comment]);
                      setCommentBody("");
                    } catch {
                      // fail silently
                    } finally {
                      setPosting(false);
                    }
                  }}
                >
                  <input
                    type="text"
                    placeholder="Share your thoughts..."
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button type="submit" size="sm" disabled={posting || !commentBody.trim()}>
                    {posting ? "Posting..." : "Post"}
                  </Button>
                </form>

                {/* Comments list */}
                {commentsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading comments...</p>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No comments yet. Be the first to share your thoughts!
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-3 items-start">
                        {c.image_url ? (
                          <img
                            src={c.image_url}
                            alt=""
                            className="w-8 h-8 rounded-full border border-border shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted border border-border shrink-0 flex items-center justify-center text-xs font-medium text-muted-foreground">
                            {(c.first_name?.[0] || "?").toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium">
                              {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Member"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {timeAgo(c.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground/90">{c.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          </>
        )}
      </main>
    </>
  );
}
