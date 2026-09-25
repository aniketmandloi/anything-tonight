import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { SearchCommand } from "@/components/search-command";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Link href="/tonight" className="font-semibold tracking-tight">
          Anything Tonight
        </Link>
        <div className="flex items-center gap-3">
          <SearchCommand />
          <UserButton />
        </div>
      </header>
      {children}
    </>
  );
}
