import { auth } from "@clerk/nextjs/server";

import { RateButtons } from "@/components/rate-buttons";
import { TitlePoster } from "@/components/title-poster";
import { TitleTypeBadge } from "@/components/title-type-badge";
import { db } from "@/db/client";
import { listLibrary, type LibraryEntry } from "@/lib/library/user-titles";

export default async function LibraryPage() {
  const { userId } = await auth.protect();
  const entries = await listLibrary(db, userId);
  const want = entries.filter((e) => e.choice === "want");
  const watched = entries.filter((e) => e.choice !== "want");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Your library</h1>
      {entries.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing here yet. Search for titles you&apos;ve watched (⌘K) and rate them.
        </p>
      ) : (
        <>
          <Section heading="Watched" entries={watched} />
          <Section heading="Want to watch" entries={want} />
        </>
      )}
    </main>
  );
}

function Section({ heading, entries }: { heading: string; entries: LibraryEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">
        {heading} <span className="text-muted-foreground">{entries.length}</span>
      </h2>
      <ul className="flex flex-col divide-y">
        {entries.map((e) => (
          <li key={e.id} className="flex gap-3 py-3">
            <TitlePoster url={e.posterUrl} className="w-14" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{e.title}</span>
                {e.year && <span className="text-sm text-muted-foreground">{e.year}</span>}
                <TitleTypeBadge type={e.type} />
              </div>
              <RateButtons titleId={e.id} choice={e.choice} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
