import Image from "next/image";
import dynamic from "next/dynamic";
import {Alert} from "@/components/ui/alert";



// Dynamic import for DBWidget to avoid SSR issues (Don't fully understand, but EntityDB doesn't work with SSR)
//====== Two -layer approach to avoid SSR issues
const DBWidget = dynamic(() => import("@/components/db/DBWidget"), {
  ssr: false,
  loading: () => <Alert variant="destructive">Loading local vector DB...</Alert>,
});
const AddExampleChunk = dynamic(() => import("@/components/db/AddExampleChunk"), { ssr: false });
const UpdateChunk = dynamic(() => import("@/components/db/UpdateChunk"), { ssr: false });
const ScamTeam = dynamic(() => import("@/components/db/ScamTeam"), { ssr: false });

export default async function Page() {
  return (
    <div className="flex flex-col min-h-screen gap-8 max-w-7xl mx-auto">
      <div className="shrink-0 flex gap-4 items-end justify-center min-h-[calc(42svh)]">
        <h1 className="text-2xl font-bold flex items-end gap-2 justify-center">
          <Image
            src="/logo.svg"
            alt="Resilient Labs"
            width={100}
            height={100}
            className="h-10 w-auto rounded-full translate-y-1"
          />
          Resilient Labs
        </h1>
        <span className="bg-red-500 h-7 w-[1px] opacity-90"></span>
        <span className="text-2xl">Breaking Language Barriers</span>
      </div>
      <div className="flex-1 flex items-start justify-center">
        <div className="w-full max-w-2xl rounded-[28px] border border-zinc-300 dark:border-zinc-700 p-4"></div>
      </div>
      <DBWidget />
      <AddExampleChunk />
      <UpdateChunk />
      <ScamTeam />
    </div>
  );
}
