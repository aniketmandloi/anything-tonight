import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const moods = ["Cozy", "Mind-bending", "Dark", "Laugh", "Cry", "Adrenaline"];

export default function TonightPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">
        What are we watching tonight?
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Pick a mood</CardTitle>
          <CardDescription>
            Movies, anime and series matched to your taste.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {moods.map((mood) => (
              <Button key={mood} variant="outline">
                {mood}
              </Button>
            ))}
          </div>
          <Input placeholder="Or describe it: like Dark, but less depressing" />
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/onboarding" className="underline underline-offset-4 hover:text-foreground">
          Tune your picks in a minute
        </Link>
      </p>
    </main>
  );
}
