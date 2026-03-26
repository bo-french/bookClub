import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { getCurrentlyReading, type CurrentlyReadingBook } from "@/lib/api";
import { Header } from "./Header";
import { BookCover } from "./BookCover";
import { Card, CardContent } from "@/components/ui/card";

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

export function CurrentlyReadingPage() {
  const { getToken } = useAuth();
  const [book, setBook] = useState<CurrentlyReadingBook | null>(null);
  const [loading, setLoading] = useState(true);

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
        )}
      </main>
    </>
  );
}
