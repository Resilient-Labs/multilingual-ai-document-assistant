"use client";
import { useRouter, usePathname } from "next/navigation";
import { locales, type Locale } from "@/lib/dictionaries";

const labels: Record<Locale, { flag: string; label: string }> = {
  en: { flag: "🇺🇸", label: "English" },
  es: { flag: "🇪🇸", label: "Español" },
  fr: { flag: "🇫🇷", label: "Français" },
};

export default function LocaleSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(newLocale: string) {
    // Replace the current locale segment in the URL with the new one
    const newPath = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
    router.push(newPath);
  }

  return (
    <select
      value={currentLocale}
      onChange={(e) => handleChange(e.target.value)}
      className="text-sm border border-zinc-300 dark:border-zinc-700 rounded-md px-2 py-1 bg-transparent"
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {labels[locale].flag} {labels[locale].label}
        </option>
      ))}
    </select>
  );
}
