"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FavouritesStep } from "@/components/onboarding/favourites-step";
import { SwipeDeck } from "@/components/onboarding/swipe-deck";
import { ServicesPicker } from "@/components/services-picker";
import { completeOnboarding } from "@/lib/onboarding/actions";
import type { SwipeAnswer } from "@/lib/onboarding/answers";
import type { OnboardingCard } from "@/lib/onboarding/deck";
import type { Provider } from "@/lib/services/queries";

type Step = "services" | "swipe" | "favourites";

const HEADINGS: Record<Step, { title: string; description: string }> = {
  services: { title: "Where do you watch?", description: "Pick your country and the services you have." },
  swipe: { title: "Seen any of these?", description: "Rate what you've watched so picks match your taste." },
  favourites: { title: "Any all-time favourites?", description: "Add up to three. Optional." },
};

export function OnboardingFlow({
  regions,
  providers,
  initialRegion,
  initialProviderIds,
  cards,
}: {
  regions: { code: string; name: string }[];
  providers: Record<string, Provider[]>;
  initialRegion: string;
  initialProviderIds: number[];
  cards: OnboardingCard[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("services");
  const [answers, setAnswers] = useState<{ titleId: number; answer: SwipeAnswer }[]>([]);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const steps: Step[] = cards.length > 0 ? ["services", "swipe", "favourites"] : ["services", "favourites"];

  function finish(favouriteIds: number[]) {
    setFailed(false);
    startTransition(async () => {
      try {
        await completeOnboarding(answers, favouriteIds);
        router.replace("/tonight");
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          Step {steps.indexOf(step) + 1} of {steps.length}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{HEADINGS[step].title}</h1>
        <p className="text-muted-foreground">{HEADINGS[step].description}</p>
      </div>

      {step === "services" && (
        <ServicesPicker
          regions={regions}
          providers={providers}
          initialRegion={initialRegion}
          initialProviderIds={initialProviderIds}
          submitLabel="Continue"
          onSaved={() => setStep(steps[1])}
        />
      )}
      {step === "swipe" && (
        <SwipeDeck
          cards={cards}
          onDone={(a) => {
            setAnswers(a);
            setStep("favourites");
          }}
        />
      )}
      {step === "favourites" && <FavouritesStep pending={pending} onFinish={finish} />}
      {failed && <p className="text-sm text-destructive">Couldn&apos;t save your answers. Try again.</p>}
    </main>
  );
}
