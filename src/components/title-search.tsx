"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { SearchIcon } from "lucide-react";
import { useEffect, useState, type Ref } from "react";

import { TitlePoster } from "@/components/title-poster";
import { TitleTypeBadge } from "@/components/title-type-badge";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { SearchResult } from "@/lib/search/query";

const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;

type Fetched = { query: string; results: SearchResult[]; failed: boolean };

export function TitleSearch({
  onSelect,
  autoFocus,
  inputRef,
}: {
  onSelect: (title: SearchResult) => void;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [input, setInput] = useState("");
  const query = useDebouncedValue(input.trim(), DEBOUNCE_MS);
  const [fetched, setFetched] = useState<Fetched>({ query: "", results: [], failed: false });

  useEffect(() => {
    if (query.length < MIN_QUERY) return;
    const controller = new AbortController();
    fetch(`/api/search?${new URLSearchParams({ q: query })}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`search failed: ${res.status}`);
        const { results } = (await res.json()) as { results: SearchResult[] };
        setFetched({ query, results, failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFetched({ query, results: [], failed: true });
      });
    return () => controller.abort();
  }, [query]);

  const active = input.trim().length >= MIN_QUERY;
  // Previous results stay visible while the next query loads, so the list doesn't flicker.
  const results = active ? fetched.results : [];
  const loading = active && fetched.query !== input.trim();

  let status: string | null = null;
  if (!active) status = "Search movies, series and anime";
  else if (loading && results.length === 0) status = "Searching…";
  else if (!loading && fetched.failed) status = "Search failed. Try again.";
  else if (!loading && results.length === 0) status = "No titles found";

  return (
    <Autocomplete.Root
      open
      inline
      items={results}
      filter={null}
      value={input}
      onValueChange={setInput}
      itemToStringValue={(r: SearchResult) => r.title}
      autoHighlight="always"
      keepHighlight
    >
      <Autocomplete.InputGroup className="flex items-center gap-2 border-b px-3">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Autocomplete.Input
          ref={inputRef}
          autoFocus={autoFocus}
          aria-label="Search titles"
          placeholder="Search titles…"
          className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
      </Autocomplete.InputGroup>
      <div
        className="max-h-[min(60dvh,24rem)] overflow-y-auto overscroll-contain"
        aria-busy={loading || undefined}
      >
        <Autocomplete.Status>
          {status && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{status}</p>}
        </Autocomplete.Status>
        <Autocomplete.List className="p-1">
          {(title: SearchResult) => (
            <Autocomplete.Item
              key={title.id}
              value={title}
              onClick={() => onSelect(title)}
              className="flex cursor-default items-center gap-3 rounded-lg p-1.5 outline-none select-none data-highlighted:bg-muted"
            >
              <TitlePoster url={title.posterUrl} className="w-8" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{title.title}</span>
                {title.year && <span className="text-xs text-muted-foreground">{title.year}</span>}
              </span>
              <TitleTypeBadge type={title.type} />
            </Autocomplete.Item>
          )}
        </Autocomplete.List>
      </div>
    </Autocomplete.Root>
  );
}
