import type { Lang } from "@/content/schema";

export const LANGS: Lang[] = ["ar", "en"];
export const DEFAULT_LANG: Lang = "ar";
export const LANG_COOKIE = "alyas_lang";
export const isLang = (v: string | undefined | null): v is Lang => v === "ar" || v === "en";
export const dirOf = (l: Lang) => (l === "ar" ? "rtl" : "ltr");

type Dict = {
  nav: { home: string; about: string; travel: string; events: string; contact: string; menu: string; close: string; skip: string; primary: string };
  lang: { switchTo: string; short: string; name: string };
  cta: { aboutMore: string; allEvents: string; plan: string; details: string; askAbout: string; contactUs: string; openMaps: string; whatsapp: string; register: string; readMore: string; viewAll: string; whatsappShort: string; call: string; learnMore: string; contactActions: string; newTab: string };
  home: { alsoFrom: string; validUntil: string; heroLabel: string };
  sections: { about: string; services: string; offers: string; events: string; floral: string; how: string };
  events: { hostedBy: string; when: string; where: string; noUpcoming: string };
  form: {
    name: string; email: string; phone: string; interest: string; message: string; ref: string; send: string; sending: string;
    contactHint: string; required: string; privacy: string; sentTitle: string; another: string;
    interests: Record<string, string>;
    errors: Record<string, string>;
    network: string; spam: string;
  };
  footer: { explore: string; reach: string; follow: string; rights: string; contactSoon: string };
  notFound: { title: string; body: string; back: string };
  preview: { banner: string; exit: string };
};

export const DICT: Record<Lang, Dict> = {
  en: {
    nav: { home: "Home", about: "About", travel: "Travel services", events: "Events & conferences", contact: "Contact", menu: "Menu", close: "Close menu", skip: "Skip to content", primary: "Main navigation" },
    lang: { switchTo: "Switch to Arabic", short: "العربية", name: "English" },
    cta: { aboutMore: "More about ALYAS", allEvents: "All events and news", plan: "Plan Your Trip", details: "Request Details", askAbout: "Ask about this", contactUs: "Contact us", openMaps: "Open in maps", whatsapp: "Message on WhatsApp", register: "Registration and info", readMore: "Read more", viewAll: "See all travel services", whatsappShort: "WhatsApp", call: "Call us", learnMore: "Learn more", contactActions: "Contact ALYAS Travel", newTab: "(opens in a new tab)" },
    home: { alsoFrom: "Also from ALYAS Group", validUntil: "Valid until", heroLabel: "ALYAS Travel" },
    sections: { about: "About ALYAS", services: "Travel services", offers: "Offers", events: "Events & conferences", floral: "From ALYAS Group", how: "How we work" },
    events: { hostedBy: "ALYAS Group", when: "When", where: "Where", noUpcoming: "" },
    form: {
      name: "Full name", email: "Email", phone: "Phone or WhatsApp", interest: "What do you need?", message: "Tell us about your trip or event", ref: "About",
      send: "Send inquiry", sending: "Sending…", contactHint: "Add an email or a phone number so we can reach you.", required: "Required",
      privacy: "We use your details only to answer this inquiry.", sentTitle: "Inquiry sent", another: "Send another inquiry",
      interests: { flights: "Flights", hotels: "Hotels", visa: "Visa assistance", transport: "Transportation", tailored: "A tailored trip", events: "Events & conferences", floral: "Floral arrangements", other: "Something else" },
      errors: {
        name: "Please enter your name.", email: "Enter a valid email address.", phone: "Enter a valid phone number.", message: "Please write a few words about what you need.",
        contact: "Add an email or a phone number.", interest: "Choose an option.", generic: "Please check this field.",
      },
      network: "We could not send your inquiry. Check your connection and try again.", spam: "Please complete the spam check.",
    },
    footer: { explore: "Explore", reach: "Reach us", follow: "Follow", rights: "All rights reserved.", contactSoon: "Contact details will be published here soon." },
    notFound: { title: "This page is not here", body: "The page you were looking for does not exist or has moved.", back: "Back to the home page" },
    preview: { banner: "Preview of unpublished changes. Visitors do not see this.", exit: "Back to admin" },
  },
  ar: {
    nav: { home: "الرئيسية", about: "من نحن", travel: "خدمات السفر", events: "الفعاليات والمؤتمرات", contact: "تواصل معنا", menu: "القائمة", close: "إغلاق القائمة", skip: "انتقل إلى المحتوى", primary: "التنقل الرئيسي" },
    lang: { switchTo: "التبديل إلى الإنجليزية", short: "English", name: "العربية" },
    cta: { aboutMore: "المزيد عنّا", allEvents: "كل الفعاليات والأخبار", plan: "خطّط لرحلتك", details: "اطلب التفاصيل", askAbout: "اسأل عن هذا", contactUs: "تواصل معنا", openMaps: "افتح في الخرائط", whatsapp: "راسلنا على واتساب", register: "التسجيل والمعلومات", readMore: "اقرأ المزيد", viewAll: "كل خدمات السفر", whatsappShort: "واتساب", call: "اتصل بنا", learnMore: "اعرف المزيد", contactActions: "تواصل مع الياس للسفر", newTab: "(يفتح في نافذة جديدة)" },
    home: { alsoFrom: "ومن مجموعة الياس أيضاً", validUntil: "ساري حتى", heroLabel: "الياس للسفر" },
    sections: { about: "عن الياس", services: "خدمات السفر", offers: "العروض", events: "الفعاليات والمؤتمرات", floral: "من مجموعة الياس", how: "كيف نعمل" },
    events: { hostedBy: "مجموعة الياس", when: "الموعد", where: "المكان", noUpcoming: "" },
    form: {
      name: "الاسم الكامل", email: "البريد الإلكتروني", phone: "الهاتف أو واتساب", interest: "ماذا تحتاج؟", message: "أخبرنا عن رحلتك أو فعاليتك", ref: "بخصوص",
      send: "أرسل الاستفسار", sending: "جارٍ الإرسال…", contactHint: "أضف بريداً إلكترونياً أو رقم هاتف لنتمكن من الوصول إليك.", required: "مطلوب",
      privacy: "نستخدم بياناتك فقط للرد على هذا الاستفسار.", sentTitle: "تم إرسال الاستفسار", another: "أرسل استفساراً آخر",
      interests: { flights: "تذاكر الطيران", hotels: "الفنادق", visa: "المساعدة في التأشيرات", transport: "خدمات النقل", tailored: "رحلة مصمَّمة لك", events: "الفعاليات والمؤتمرات", floral: "تنسيق الزهور", other: "شيء آخر" },
      errors: {
        name: "يرجى إدخال اسمك.", email: "أدخل بريداً إلكترونياً صحيحاً.", phone: "أدخل رقم هاتف صحيحاً.", message: "اكتب بضع كلمات عمّا تحتاجه.",
        contact: "أضف بريداً إلكترونياً أو رقم هاتف.", interest: "اختر أحد الخيارات.", generic: "يرجى مراجعة هذا الحقل.",
      },
      network: "تعذّر إرسال استفسارك. تحقق من الاتصال وحاول مرة أخرى.", spam: "يرجى إكمال فحص الحماية من الرسائل المزعجة.",
    },
    footer: { explore: "استكشف", reach: "تواصل", follow: "تابعنا", rights: "جميع الحقوق محفوظة.", contactSoon: "سيتم نشر بيانات التواصل هنا قريباً." },
    notFound: { title: "هذه الصفحة غير موجودة", body: "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.", back: "العودة إلى الرئيسية" },
    preview: { banner: "معاينة لتغييرات غير منشورة. لا يراها الزوار.", exit: "العودة إلى لوحة الإدارة" },
  },
};

export function formatDate(iso: string, lang: Lang): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00Z");
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}
export function dateParts(iso: string, lang: Lang) {
  const d = new Date(iso + "T12:00:00Z");
  const loc = lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB";
  return {
    day: new Intl.DateTimeFormat(loc, { day: "numeric", timeZone: "UTC" }).format(d),
    month: new Intl.DateTimeFormat(loc, { month: "short", timeZone: "UTC" }).format(d),
    year: new Intl.DateTimeFormat(loc, { year: "numeric", timeZone: "UTC" }).format(d),
  };
}
