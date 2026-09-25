import { cn } from "cn";
import Image from "next/image";

// Size it with className (e.g. "w-8"); the 2:3 aspect ratio sets the height.
export function TitlePoster({ url, className }: { url: string | null; className?: string }) {
  const classes = cn("block aspect-2/3 shrink-0 rounded bg-muted object-cover", className);
  if (!url) return <span className={classes} />;
  // unoptimized: TMDB and AniList already serve sized images, so Vercel optimization only adds cost.
  return <Image src={url} alt="" width={185} height={278} unoptimized className={classes} />;
}
