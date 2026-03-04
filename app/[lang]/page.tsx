import Image from "next/image";
import { getDictionary, type Locale } from "@/lib/dictionaries";
import LocaleSwitcher from "@/components/LocaleSwitcher";

export default async function Page({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  console.log(dict);

  return (
    <div className="flex flex-col min-h-screen gap-8 max-w-7xl mx-auto">
      <div className="flex justify-end p-4">
        <LocaleSwitcher currentLocale={lang} />
      </div>
      <div className="shrink-0 flex gap-4 items-end justify-center min-h-[calc(42svh-80px)]">
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
        <span className="text-2xl">{dict.home.tagline}</span>
      </div>
      <div className="flex-1 flex items-start justify-center">
        <div className="w-full max-w-2xl rounded-[28px] border border-zinc-300 dark:border-zinc-700 p-4"></div>
      </div>
    </div>
  );
}
