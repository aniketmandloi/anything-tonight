import { Badge } from "@/components/ui/badge";
import type { TitleType } from "@/lib/search/query";

const LABELS: Record<TitleType, string> = { movie: "Movie", tv: "Series", anime: "Anime" };

export function TitleTypeBadge({ type }: { type: TitleType }) {
  return <Badge variant="secondary">{LABELS[type]}</Badge>;
}
