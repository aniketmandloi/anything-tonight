"use client";

import { ArrowLeftIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { RateButtons } from "@/components/rate-buttons";
import { TitlePoster } from "@/components/title-poster";
import { TitleSearch } from "@/components/title-search";
import { TitleTypeBadge } from "@/components/title-type-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { RatingChoice } from "@/lib/library/choices";
import type { SearchResult } from "@/lib/search/query";

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  // Ratings made in this session; the search results that carried the old choice are stale.
  const [rated, setRated] = useState<Record<number, RatingChoice | null>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setSelected(null);
  }

  function back() {
    setSelected(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const choice = selected && (selected.id in rated ? rated[selected.id] : selected.choice);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" aria-label="Search titles" className="text-muted-foreground" />}
      >
        <SearchIcon />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border px-1 font-mono text-[0.625rem] sm:inline">⌘K</kbd>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="top-[10dvh] translate-y-0 gap-0 p-0 sm:max-w-lg">
        {/* Kept mounted while rating so going back keeps the query and results. */}
        <div hidden={selected != null}>
          <DialogTitle className="sr-only">Search titles</DialogTitle>
          <TitleSearch autoFocus inputRef={inputRef} onSelect={setSelected} />
        </div>
        {selected && (
          <div className="flex flex-col gap-4 p-3">
            <Button variant="ghost" size="sm" autoFocus onClick={back} className="self-start">
              <ArrowLeftIcon />
              Back to results
            </Button>
            <div className="flex gap-3">
              <TitlePoster url={selected.posterUrl} className="w-16" />
              <div className="flex min-w-0 flex-col items-start gap-1.5">
                <p className="font-medium">{selected.title}</p>
                {selected.year && <p className="text-xs text-muted-foreground">{selected.year}</p>}
                <TitleTypeBadge type={selected.type} />
              </div>
            </div>
            <RateButtons
              titleId={selected.id}
              choice={choice}
              onChange={(next) => setRated((r) => ({ ...r, [selected.id]: next }))}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
