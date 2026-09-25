/**
 * Starter copy, used until an administrator publishes their own.
 * Deliberately contains NO prices, reviews, awards, partner names, years in
 * business, destination lists or contact details — those must come from the client.
 * Everything here is editable in /admin.
 */
import type { KindKey } from "./schema";

const bi = (en: string, ar: string) => ({ en, ar });

export const DEFAULT_COLORS = { primary: "#0B2545", accent: "#C9A24B", paper: "#FBFAF7" };

export const DEFAULTS: Partial<Record<KindKey, any>> = {
  site: {
    brand: {
      siteName: bi("ALYAS Travel", "الياس للسفر"),
      brandMain: bi("ALYAS", "الياس"),
      brandSub: bi("Travel", "للسفر"),
      tagline: bi("Flights, hotels, visas and tailored trips from Baghdad", "طيران وفنادق وتأشيرات ورحلات مصمَّمة من بغداد"),
    },
    colors: { primary: "", accent: "", paper: "" },
    contact: { address: bi("Baghdad, Iraq", "بغداد، العراق") },
    social: {
      facebook: "https://www.facebook.com/alyasgroupiq/",
      instagram: "https://www.instagram.com/alyas_travel_agency/",
      linkedin: "https://www.linkedin.com/company/alyasgroup",
    },
    seo: {
      description: bi(
        "ALYAS Travel is a Baghdad travel agency within ALYAS Group: flights, hotels, visa assistance, transportation and tailored trip planning.",
        "الياس للسفر وكالة سفر في بغداد ضمن مجموعة الياس: تذاكر طيران وحجوزات فنادق ومساعدة في التأشيرات وخدمات نقل وتخطيط رحلات مخصصة.",
      ),
    },
    footerNote: bi("A member of ALYAS Group", "إحدى شركات مجموعة الياس"),
  },
  home: {
    hero: {
      headline: bi("Explore", "استكشف"),
      sub: bi(
        "ALYAS Travel, based in Baghdad, arranges flights, hotels, visa assistance, transportation and tailored trips.",
        "الياس للسفر، ومقرّها بغداد، ترتّب لك تذاكر الطيران والفنادق والمساعدة في التأشيرات والنقل والرحلات المصمَّمة.",
      ),
      primaryCta: bi("Plan Your Trip", "خطّط لرحلتك"),
    },
    intro: {
      title: bi("Travel, simply arranged.", "سفرٌ منظَّم بلا تعقيد."),
      body: bi(
        "ALYAS Travel is the travel agency of ALYAS Group in Baghdad. Tell us where you need to be and when, and we help with the tickets, the stay, the paperwork and the ride in between.",
        "الياس للسفر هي وكالة السفر التابعة لمجموعة الياس في بغداد. أخبرنا إلى أين تريد الذهاب ومتى، ونساعدك في التذاكر والإقامة والأوراق ووسيلة التنقل بينها.",
      ),
    },
    services: {
      title: bi("What we arrange", "ما نتولّاه"),
      intro: bi("Choose a service to ask for details. We reply to every inquiry.", "اختر خدمة واطلب التفاصيل."),
    },
    offers: {
      title: bi("Current offers", "العروض الحالية"),
      intro: bi("Ask us for the full details of any offer.", "اطلب منّا تفاصيل أي عرض."),
    },
    floral: {
      title: bi("Flowers, from ALYAS Group", "الزهور، من مجموعة الياس"),
      body: bi(
        "Bespoke floral arrangements and event décor for occasions of every size.",
        "تنسيقات زهور مخصصة وديكورات للفعاليات والمناسبات.",
      ),
    },
    cta: {
      title: bi("Ready to plan your next trip?", "هل أنت مستعد لتخطيط رحلتك القادمة؟"),
      body: bi("Send us a few details and we will get back to you.", "أرسل لنا بعض التفاصيل وسنعاود التواصل معك."),
      button: bi("Plan Your Trip", "خطّط لرحلتك"),
    },
  },
  about: {
    title: bi("About ALYAS", "عن الياس"),
    lead: bi(
      "ALYAS Travel is part of ALYAS Group, a Baghdad company that brings together travel, event and conference management, and floral arrangements.",
      "الياس للسفر جزء من مجموعة الياس، شركة بغدادية تجمع بين خدمات السفر وإدارة الفعاليات والمؤتمرات وتنسيق الزهور.",
    ),
    body: bi(
      "We help individuals, families and organizations get where they need to go: flights, hotels, visa assistance and transportation, or a whole trip planned around you.\n\nBecause ALYAS Group also manages events and conferences, we understand group travel and tight schedules as well as personal journeys.",
      "نساعد الأفراد والعائلات والمؤسسات على الوصول إلى وجهاتهم: تذاكر طيران وفنادق ومساعدة في التأشيرات وخدمات نقل، أو رحلة كاملة تُخطَّط حولك.\n\nولأن مجموعة الياس تدير الفعاليات والمؤتمرات أيضاً، فنحن نفهم سفر المجموعات والجداول المزدحمة كما نفهم الرحلات الشخصية.",
    ),
    approachTitle: bi("How we work", "كيف نعمل"),
    approach: [
      { title: bi("We start with your plan", "نبدأ من خطتك"), body: bi("Dates, budget, who is travelling and why. That shapes every suggestion.", "التواريخ والميزانية والمسافرون وسبب السفر. هذا ما يحدد كل اقتراح.") },
      { title: bi("One team, the whole trip", "فريق واحد للرحلة كلها"), body: bi("Tickets, hotels, visas and transport handled together, so nothing falls between the gaps.", "التذاكر والفنادق والتأشيرات والنقل في مكان واحد، فلا يسقط شيء بين التفاصيل.") },
      { title: bi("Clear answers", "إجابات واضحة"), body: bi("You get a straight reply about what is possible and what the next step is.", "نجيبك بوضوح عمّا هو ممكن وما الخطوة التالية.") },
    ],
  },
  travel: {
    title: bi("Travel services", "خدمات السفر"),
    lead: bi(
      "Everything for the journey itself, from the ticket to the transfer. Ask about one service or several together.",
      "كل ما تحتاجه للرحلة نفسها، من التذكرة إلى التوصيل. اسأل عن خدمة واحدة أو عدة خدمات معاً.",
    ),
    ctaTitle: bi("Not sure what you need?", "لست متأكداً مما تحتاجه؟"),
    ctaBody: bi("Describe your trip and we will suggest where to start.", "صف لنا رحلتك وسنقترح عليك من أين نبدأ."),
  },
  events: {
    title: bi("Events & Conferences", "الفعاليات والمؤتمرات"),
    lead: bi(
      "ALYAS Group plans and coordinates meetings, conferences and events.",
      "تخطّط مجموعة الياس وتنسّق الاجتماعات والمؤتمرات والفعاليات.",
    ),
    management: {
      title: bi("Event and conference management", "إدارة الفعاليات والمؤتمرات"),
      body: bi(
        "From the first plan to the last detail on the day, our team handles planning, logistics and coordination for meetings, conferences, congresses and events.",
        "من الخطة الأولى إلى آخر تفصيل في يوم الحدث، يتولى فريقنا التخطيط والخدمات اللوجستية والتنسيق للاجتماعات والمؤتمرات والفعاليات.",
      ),
    },
    capabilities: [
      { title: bi("Planning", "التخطيط"), body: bi("Shaping the program, the schedule and the format.", "تحديد البرنامج والجدول وشكل الحدث.") },
      { title: bi("Logistics", "الخدمات اللوجستية"), body: bi("Venues, movement of guests and everything that keeps the day running.", "القاعات وتنقّل الضيوف وكل ما يُبقي اليوم سائراً.") },
      { title: bi("Coordination", "التنسيق"), body: bi("One point of contact between organizers, suppliers and guests.", "جهة اتصال واحدة بين المنظمين والموردين والضيوف.") },
    ],
    floral: {
      title: bi("Floral arrangements", "تنسيق الزهور"),
      body: bi(
        "ALYAS Group also creates bespoke floral arrangements and event décor, for a single occasion or as part of a full event.",
        "تصمم مجموعة الياس أيضاً تنسيقات زهور مخصصة وديكورات للفعاليات، لمناسبة واحدة أو ضمن حدث متكامل.",
      ),
    },
    upcomingTitle: bi("Upcoming events", "الفعاليات القادمة"),
    newsTitle: bi("News", "الأخبار"),
  },
  contact: {
    title: bi("Talk to us", "تواصل معنا"),
    lead: bi("Tell us about your trip or event. We will reply as soon as we can.", "أخبرنا عن رحلتك أو فعاليتك وسنردّ في أقرب وقت."),
    formIntro: bi("Share a few details and the team will get back to you.", "شاركنا بعض التفاصيل وسيعاود الفريق التواصل معك."),
    success: bi("Thank you. Your inquiry has been received and our team will get back to you.", "شكراً لك. وصلنا استفسارك وسيعاود فريقنا التواصل معك."),
  },
};

export const DEFAULT_SERVICES: { slug: string; sort: number; data: any }[] = [
  {
    slug: "flights", sort: 10,
    data: { icon: "flights", title: bi("Flights", "تذاكر الطيران"), summary: bi("Help finding and booking flights for the route and dates you need.", "مساعدة في إيجاد وحجز رحلات الطيران المناسبة لوجهتك وتواريخك.") },
  },
  {
    slug: "hotels", sort: 20,
    data: { icon: "hotels", title: bi("Hotels", "الفنادق"), summary: bi("Hotel reservations that fit your dates, budget and reason for travel.", "حجوزات فندقية تناسب تواريخك وميزانيتك وسبب سفرك.") },
  },
  {
    slug: "visa-assistance", sort: 30,
    data: { icon: "visa", title: bi("Visa assistance", "المساعدة في التأشيرات"), summary: bi("Guidance on visa requirements and support preparing your application. Decisions rest with each embassy.", "إرشاد حول متطلبات التأشيرة ودعم في إعداد طلبك. القرار النهائي يعود لكل سفارة.") },
  },
  {
    slug: "transportation", sort: 40,
    data: { icon: "transport", title: bi("Transportation", "خدمات النقل"), summary: bi("Transfers and ground transport arranged for your trip.", "توصيل ونقل بري مرتّب لرحلتك.") },
  },
  {
    slug: "tailored-trips", sort: 50,
    data: { icon: "tailored", title: bi("Tailored trips", "رحلات مصمَّمة لك"), summary: bi("A trip planned around you, with flights, stay and transport pulled into one plan.", "رحلة تُخطَّط حولك، تجمع الطيران والإقامة والنقل في خطة واحدة.") },
  },
];

/**
 * Earlier shipped defaults. A stored value that is exactly one of these was never customised (saving a form
 * stores the defaults it was showing), so it is upgraded to the current default. Edited text is never touched.
 */
export const LEGACY_DEFAULTS: { kind: KindKey; path: string[]; old: { ar: string; en: string }[] }[] = [
  {
    kind: "home",
    path: ["hero", "sub"],
    old: [
      {
        en: "Flights, hotels, visa assistance and transport, arranged by our team in Baghdad.",
        ar: "تذاكر الطيران والفنادق والمساعدة في التأشيرات والنقل، ينظّمها فريقنا في بغداد.",
      },
      {
        // the wording of the previous branch commit; upgraded too, so nobody keeps it by accident
        en: "ALYAS Travel arranges flights, hotels, visa assistance, transportation and tailored trips from Baghdad.",
        ar: "الياس للسفر من بغداد: نرتّب لك تذاكر الطيران والفنادق والمساعدة في التأشيرات والنقل والرحلات المصمَّمة لك.",
      },
    ],
  },
  {
    kind: "site",
    path: ["brand", "tagline"],
    old: [{ en: "Travel, events and flowers from Baghdad", ar: "سفر وفعاليات وزهور من بغداد" }],
  },
];
