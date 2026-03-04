
export default function Page() {
  return (
    <div className="flex flex-col min-h-screen gap-8">

      <div className="shrink-0 flex gap-4 items-end justify-center min-h-[calc(42svh)]">
        <h1 className="text-2xl font-bold">Resilient Labs</h1>
        <span className="bg-red-500 h-7 w-[1px] opacity-90"></span>
        <span className="text-2xl">Breaking language barriers.</span>
      </div>

      <div className="flex-1 flex items-start justify-center">
        <div className="w-full max-w-2xl rounded-[28px] border border-zinc-300 dark:border-zinc-700 p-4"></div>
      </div>

    </div>
  );
}
