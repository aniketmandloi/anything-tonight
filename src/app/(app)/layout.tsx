import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { SearchCommand } from "@/components/search-command";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <nav className="flex items-center gap-4">
          <Link href="/tonight" className="font-semibold tracking-tight">
            Anything Tonight
          </Link>
          <Link href="/library" className="text-sm text-muted-foreground hover:text-foreground">
            Library
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <SearchCommand />
          <UserButton />
        </div>
      </header>
      {children}
    </>
  );
}
