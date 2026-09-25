"use client";

import { BookmarkIcon, HeartIcon, MehIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { rateTitle } from "@/lib/library/actions";
import { RATING_CHOICE_KEYS, RATING_CHOICES, type RatingChoice } from "@/lib/library/choices";

const ICONS: Record<RatingChoice, typeof HeartIcon> = {
  loved: HeartIcon,
  liked: ThumbsUpIcon,
  meh: MehIcon,
  disliked: ThumbsDownIcon,
  want: BookmarkIcon,
};

// Picking the current choice again clears it. onChange lets a parent that holds the choice in
// client state keep it in sync; without it, the optimistic value reverts once the action ends
// unless the server re-renders the page with the new choice.
export function RateButtons({
  titleId,
  choice,
  onChange,
}: {
  titleId: number;
  choice: RatingChoice | null;
  onChange?: (choice: RatingChoice | null) => void;
}) {
  const [shown, setShown] = useOptimistic(choice);
  const [, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function pick(key: RatingChoice) {
    const next = key === shown ? null : key;
    setFailed(false);
    startTransition(async () => {
      setShown(next);
      try {
        await rateTitle(titleId, next);
        onChange?.(next);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Rate this title" className="flex flex-wrap gap-1.5">
        {RATING_CHOICE_KEYS.map((key) => {
          const Icon = ICONS[key];
          return (
            <Button
              key={key}
              size="sm"
              variant={shown === key ? "default" : "outline"}
              aria-pressed={shown === key}
              onClick={() => pick(key)}
            >
              <Icon />
              {RATING_CHOICES[key].label}
            </Button>
          );
        })}
      </div>
      {failed && <p className="text-xs text-destructive">Couldn&apos;t save that. Try again.</p>}
    </div>
  );
}
