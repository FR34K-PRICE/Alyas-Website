import { cookies, headers } from "next/headers";
import { DICT, LANG_COOKIE, isLang } from "@/i18n/dict";

export default async function NotFound() {
  const h = await headers();
  const fromHeader = h.get("x-alyas-lang");
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(fromHeader) ? fromHeader : isLang(saved) ? saved : "ar";
  const t = DICT[lang].notFound;
  return (
    <main className="notfound" id="main">
      <div className="wrap">
        <h1>{t.title}</h1>
        <p>{t.body}</p>
        <a className="btn btn--navy" href={`/${lang}`}>
          {t.back}
        </a>
      </div>
    </main>
  );
}
