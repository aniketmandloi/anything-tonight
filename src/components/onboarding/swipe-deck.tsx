"use client";

import { EyeOffIcon, HeartIcon, MehIcon, Undo2Icon, XIcon } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { TitlePoster } from "@/components/title-poster";
import { TitleTypeBadge } from "@/components/title-type-badge";
import { Button } from "@/components/ui/button";
import type { SwipeAnswer } from "@/lib/onboarding/answers";
import type { OnboardingCard } from "@/lib/onboarding/deck";

type Answer = { titleId: number; answer: SwipeAnswer };

// Left is "haven't seen", not "not interested": a casual left swipe shouldn't record a dislike.
const CHOICES: { answer: SwipeAnswer; label: string; key: string; icon: typeof HeartIcon }[] = [
  { answer: "unseen", label: "Haven't seen", key: "ArrowLeft", icon: EyeOffIcon },
  { answer: "dismissed", label: "Not interested", key: "ArrowDown", icon: XIcon },
  { answer: "meh", label: "Meh", key: "ArrowUp", icon: MehIcon },
  { answer: "loved", label: "Loved it", key: "ArrowRight", icon: HeartIcon },
];
const KEY_HINTS: Record<string, string> = { ArrowLeft: "←", ArrowDown: "↓", ArrowUp: "↑", ArrowRight: "→" };
const SWIPE_THRESHOLD = 90;

export function SwipeDeck({
  cards,
  onDone,
}: {
  cards: OnboardingCard[];
  onDone: (answers: Answer[]) => void;
}) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [drag, setDrag] = useState<{ startX: number; dx: number } | null>(null);
  const card = cards[answers.length];

  function answer(value: SwipeAnswer) {
    if (!card) return;
    const next = [...answers, { titleId: card.id, answer: value }];
    setAnswers(next);
    setDrag(null);
    if (next.length === cards.length) onDone(next);
  }

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const choice = CHOICES.find((c) => c.key === e.key);
    if (!choice || e.target instanceof HTMLInputElement) return;
    e.preventDefault();
    answer(choice.answer);
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!card) return null;
  const dx = drag?.dx ?? 0;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
        <span>
          {answers.length + 1} / {cards.length}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={answers.length === 0}
          onClick={() => setAnswers((a) => a.slice(0, -1))}
        >
          <Undo2Icon />
          Undo
        </Button>
      </div>

      <div
        key={card.id}
        className="flex w-full max-w-xs touch-pan-y flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm select-none"
        style={{
          transform: `translateX(${dx}px) rotate(${dx / 20}deg)`,
          transition: drag ? "none" : "transform 150ms",
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag({ startX: e.clientX, dx: 0 });
        }}
        onPointerMove={(e) => drag && setDrag({ ...drag, dx: e.clientX - drag.startX })}
        onPointerUp={() => {
          if (dx > SWIPE_THRESHOLD) answer("loved");
          else if (dx < -SWIPE_THRESHOLD) answer("unseen");
          else setDrag(null);
        }}
        onPointerCancel={() => setDrag(null)}
      >
        <TitlePoster url={card.posterUrl} className="pointer-events-none w-full rounded-lg" />
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold leading-tight">{card.title}</h2>
            {card.year && <span className="text-sm text-muted-foreground">{card.year}</span>}
            <TitleTypeBadge type={card.type} />
          </div>
          {card.overview && <p className="line-clamp-3 text-sm text-muted-foreground">{card.overview}</p>}
        </div>
      </div>

      <div className="grid w-full max-w-sm grid-cols-2 gap-2 sm:grid-cols-4">
        {CHOICES.map(({ answer: value, label, key, icon: Icon }) => (
          <Button key={value} variant={value === "loved" ? "default" : "outline"} onClick={() => answer(value)}>
            <Icon />
            {label}
            <kbd className="hidden text-[0.625rem] opacity-60 sm:inline">{KEY_HINTS[key]}</kbd>
          </Button>
        ))}
      </div>
    </div>
  );
}
