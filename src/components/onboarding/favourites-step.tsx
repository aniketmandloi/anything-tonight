"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";

import { TitlePoster } from "@/components/title-poster";
import { TitleSearch } from "@/components/title-search";
import { Button } from "@/components/ui/button";
import { MAX_FAVOURITES } from "@/lib/onboarding/answers";
import type { SearchResult } from "@/lib/search/query";

export function FavouritesStep({
  pending,
  onFinish,
}: {
  pending: boolean;
  onFinish: (favouriteIds: number[]) => void;
}) {
  const [favourites, setFavourites] = useState<SearchResult[]>([]);

  function add(title: SearchResult) {
    setFavourites((f) => (f.some((t) => t.id === title.id) || f.length >= MAX_FAVOURITES ? f : [...f, title]));
  }

  return (
    <div className="flex flex-col gap-4">
      {favourites.length > 0 && (
        <ul className="flex flex-col gap-2">
          {favourites.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-lg border p-2">
              <TitlePoster url={t.posterUrl} className="w-8" />
              <span className="flex-1 truncate font-medium">{t.title}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${t.title}`}
                onClick={() => setFavourites((f) => f.filter((x) => x.id !== t.id))}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {favourites.length < MAX_FAVOURITES && (
        <div className="rounded-xl border">
          <TitleSearch onSelect={add} />
        </div>
      )}
      <div className="flex gap-2">
        <Button disabled={pending} onClick={() => onFinish(favourites.map((t) => t.id))}>
          {pending ? "Saving…" : "Finish"}
        </Button>
        {favourites.length === 0 && (
          <Button variant="ghost" disabled={pending} onClick={() => onFinish([])}>
            Skip
          </Button>
        )}
      </div>
    </div>
  );
}
