"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { TitleSearch } from "@/components/title-search";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function SearchCommand() {
  const [open, setOpen] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" aria-label="Search titles" className="text-muted-foreground" />}
      >
        <SearchIcon />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border px-1 font-mono text-[0.625rem] sm:inline">⌘K</kbd>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="top-[10dvh] translate-y-0 gap-0 p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Search titles</DialogTitle>
        <TitleSearch autoFocus onSelect={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
