"use client";

import { CheckIcon } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { saveServices } from "@/lib/services/actions";
import type { Provider } from "@/lib/services/queries";

// Regions list dozens of providers (mostly add-on channels); the rest sit behind "Show all".
const SHOWN = 16;

export function ServicesPicker({
  regions,
  providers,
  initialRegion,
  initialProviderIds,
  submitLabel = "Save",
  onSaved,
}: {
  regions: { code: string; name: string }[];
  providers: Record<string, Provider[]>;
  initialRegion: string;
  initialProviderIds: number[];
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const [region, setRegion] = useState(initialRegion);
  const [selected, setSelected] = useState(() => new Set(initialProviderIds));
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [saving, startTransition] = useTransition();

  const list = providers[region] ?? [];
  const visible = expanded ? list : list.filter((p, i) => i < SHOWN || selected.has(p.id));

  function toggle(id: number) {
    setStatus("idle");
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      try {
        // Ids from another region are dropped server-side (the action keeps only this region's).
        await saveServices(region, [...selected]);
        setStatus("saved");
        onSaved?.();
      } catch {
        setStatus("failed");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Country
        <select
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setStatus("idle");
          }}
          className="h-9 rounded-lg border border-input bg-transparent px-2 text-base md:text-sm"
        >
          {regions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Your services</legend>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No services listed for this country yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {visible.map((p) => {
              const on = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(p.id)}
                  className="relative flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:bg-muted"
                >
                  {p.logoUrl ? (
                    <Image src={p.logoUrl} alt="" width={40} height={40} unoptimized className="size-10 rounded-md" />
                  ) : (
                    <span className="size-10 rounded-md bg-muted" />
                  )}
                  <span className="line-clamp-2">{p.name}</span>
                  {on && (
                    <CheckIcon className="absolute top-1 right-1 size-3.5 text-primary" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        )}
        {!expanded && list.length > visible.length && (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setExpanded(true)}>
            Show all {list.length}
          </Button>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
        <span role="status" className="text-sm text-muted-foreground">
          {status === "saved" && "Saved"}
          {status === "failed" && "Couldn't save. Try again."}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Streaming availability data from JustWatch.</p>
    </div>
  );
}
