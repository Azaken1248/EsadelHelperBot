// Amia / Akiyama Mizuki knowledge base.
//
// Structured, queryable lore powering the /ask, /amia, /fact, and /quote
// commands. Sourced from docs/AMIA_KNOWLEDGE_BASE.md (kept verbatim there).
//
// Pronoun/framing policy: prefer the name "Mizuki"/"Amia"; use they/them only
// when unavoidable; the official gender label is "?" and is left unstated rather
// than asserted. Amia refers to herself in the first person in command copy.

export type KnowledgeCategory =
  | "profile"
  | "personality"
  | "backstory"
  | "niigo"
  | "story-arc"
  | "identity"
  | "relationships"
  | "production"
  | "meta";

export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  title: string;
  summary: string;
  content: string;
  keywords: string[];
}

export interface AmiaQuote {
  text: string;
  attribution: string;
}

export const AMIA_TAGLINE = "I welcome anything as long as it's cute♪";
export const AMIA_BIO_QUOTE = "I'm still me, but is that ok?";

export const CATEGORY_LABELS: Readonly<Record<KnowledgeCategory, string>> = {
  profile: "Profile & Trivia",
  personality: "Personality",
  backstory: "Backstory",
  niigo: "25-ji, Nightcord de.",
  "story-arc": "Story Arc",
  identity: "Identity",
  relationships: "Relationships",
  production: "Production & Songs",
  meta: "About the Bot",
};

export const KNOWLEDGE_ENTRIES: readonly KnowledgeEntry[] = [
  // ── Profile ──────────────────────────────────────────────────────────────
  {
    id: "name",
    category: "profile",
    title: "Name & meaning",
    summary: "Akiyama Mizuki (暁山瑞希) — a dawn-themed, unisex name.",
    content:
      "Full name: Akiyama Mizuki (暁山瑞希). The surname Akiyama uses 暁 (aki/akatsuki, \"dawn\" — the darkest hours before sunrise) + 山 (yama, \"mountain\"). Like all Niigo members, the surname encodes a time of day: Kanade = evening (宵), Mafuyu = morning (朝), Ena = daybreak (東雲), Mizuki = dawn (暁). The given name Mizuki (瑞希) is 瑞 (\"auspicious sign\") + 希 (\"hope\") — a unisex name, sharing the 希 (ki) with sister Yuuki.",
    keywords: ["name", "mizuki", "akiyama", "meaning", "kanji", "dawn", "surname"],
  },
  {
    id: "alias",
    category: "profile",
    title: "The alias \"Amia\"",
    summary: "Mizuki's Niigo handle, from the villain \"Mia\".",
    content:
      "Online, Mizuki goes by the alias \"Amia\" — derived from Mia, the villain of a magical-girl anime Mizuki loved (rendered \"Miracle Magical Girl☆Lala\" in some summaries). It's the handle used inside 25-ji, Nightcord de. — and the name of this bot.",
    keywords: ["amia", "alias", "handle", "name", "mia", "villain", "magical girl", "bot name"],
  },
  {
    id: "vitals",
    category: "profile",
    title: "Birthday, height & school",
    summary: "Born Aug 27; ~163–165 cm; Kamiyama High School.",
    content:
      "Birthday: August 27 (Virgo). Height: about 163–165 cm (listed 163→165 on some databases after a model update). School: Kamiyama High School — Year 1 in Class 1-A (with Shiraishi An), Year 2 in Class 2-B (with Aoyagi Toya). Mizuki skips class often, attending just enough supplementary classes to avoid repeating a grade.",
    keywords: ["birthday", "august", "virgo", "height", "school", "kamiyama", "class", "age"],
  },
  {
    id: "likes",
    category: "profile",
    title: "Likes, hobbies & food",
    summary: "Cute things, fashion, sewing, MVs; a big Minori fan.",
    content:
      "Likes: anything cute, fashion, sewing and redesigning clothes, making collages and MVs, anime and idols. A big fan of MORE MORE JUMP!'s Hanasato Minori (chants \"L-O-V-E Mino-ri!!\"). Food: loves spicy flavors, but strongly dislikes food that's too hot in temperature.",
    keywords: ["likes", "hobbies", "fashion", "sewing", "clothes", "cute", "food", "spicy", "minori", "idols", "anime"],
  },
  {
    id: "pronoun",
    category: "profile",
    title: "Pronoun \"boku\" & how others address Mizuki",
    summary: "Uses \"boku\" in Japanese; others use the name or -chan/-san.",
    content:
      "First-person pronoun: \"boku\" (ボク), written in katakana — a pronoun typically used by young boys but also by tomboyish girls, giving an exaggeratedly cute, distinctive quality. Others address Mizuki as \"Amia\" (online), \"Mizuki\", \"Mizuki-chan\", \"Mizuki-san\", or \"Akiyama\". Mizuki calls Ena's brother Akito \"otouto-kun\" (li'l bro).",
    keywords: ["pronoun", "boku", "japanese", "name", "otouto", "akito", "address"],
  },
  {
    id: "appearance",
    category: "profile",
    title: "Appearance",
    summary: "Light-pink side ponytail, heart hair-tie, a candy in art.",
    content:
      "Light pink hair in a side ponytail with two loose face-framing strands; light pink eyes with a single pink eyelash; a red heart-ribbon hair tie. A candy is often shown in official illustrations.",
    keywords: ["appearance", "look", "hair", "pink", "ponytail", "eyes", "candy", "design", "heart"],
  },

  // ── Personality ──────────────────────────────────────────────────────────
  {
    id: "personality",
    category: "personality",
    title: "Personality",
    summary: "Bright, teasing mediator hiding a sensitive, mature core.",
    content:
      "Mizuki is bright, energetic, teasing and free-spirited — the most outwardly cheerful Niigo member and its mediator, defusing Ena–Mafuyu arguments with a quip. Highly emotionally intelligent, quick to notice others' stress and to set boundaries; Ena calls Mizuki secretly the most mature member. Underneath is a conflict-avoidant, sensitive person who hides their own feelings. The bright, clothes-making self is the true self; a colder, defensive front only appears toward people who mock them — a learned defense from years of bullying.",
    keywords: ["personality", "traits", "cheerful", "teasing", "mediator", "mature", "sensitive", "kind", "who"],
  },
  {
    id: "typing",
    category: "personality",
    title: "Typing, tagline & bio quote",
    summary: "Fan-typed ESFJ / 2w3; tagline about cuteness.",
    content:
      `Fans commonly type Mizuki as ESFJ and Enneagram 2w3 ("the Helper"), with a basic fear of being unwanted — consistent with canon. Signature tagline: "${AMIA_TAGLINE}" Their "Brand New World" bio quote: "${AMIA_BIO_QUOTE}"`,
    keywords: ["mbti", "esfj", "enneagram", "2w3", "helper", "tagline", "quote", "bio", "typing"],
  },

  // ── Backstory ────────────────────────────────────────────────────────────
  {
    id: "backstory",
    category: "backstory",
    title: "Backstory",
    summary: "Bullied for their fashion; kept alive by a rooftop friendship.",
    content:
      "Mizuki loved cute clothing from childhood; wearing sister Yuuki's outfits drew both compliments and judgment. After being bullied, Mizuki asked whether to give up cute things — Yuuki said to follow their heart, while warning the criticism would keep hurting. Bullied since elementary school for their fashion and honesty, Mizuki began skipping school. In middle school, on the rooftop, they met Kamishiro Rui (now of Wonderlands×Showtime); the two outcasts \"kept each other alive.\" After Rui graduated, Mizuki grew more isolated — until finding one of Kanade's songs by chance, making an MV from Ena's art, and being invited into Niigo.",
    keywords: ["backstory", "past", "bullied", "bullying", "childhood", "rooftop", "rui", "history", "school"],
  },

  // ── Niigo ────────────────────────────────────────────────────────────────
  {
    id: "niigo",
    category: "niigo",
    title: "25-ji, Nightcord de. (Niigo)",
    summary: "Underground circle making music to \"save people\".",
    content:
      "Niigo is an anonymous underground circle founded by composer Yoisaki Kanade (\"K\") to make music that \"saves people.\" Members: Kanade (compose), Asahina Mafuyu / \"Yuki\" (lyrics & mix), Ena / \"Enanan\" (illustration), and Mizuki / \"Amia\" (MV/video). They talk through the \"Nightcord\" chat app — a name that references Discord. Developer files reportedly label the unit \"school refusal,\" reflecting each member's fraught relationship with school.",
    keywords: ["niigo", "nightcord", "25", "circle", "unit", "members", "kanade", "mafuyu", "ena", "discord", "music"],
  },
  {
    id: "empty-sekai",
    category: "niigo",
    title: "The Empty SEKAI",
    summary: "A void born from Mafuyu's feelings; MEIKO understands Mizuki.",
    content:
      "Niigo's SEKAI is the Empty SEKAI — a barren void born solely from Mafuyu's feelings, home to Miku (and later Rin, Len, Luka, MEIKO, KAITO). Every member has at some point wished to \"disappear,\" and the unit is the game's heaviest, exploring depression, family pressure and self-worth. MEIKO is positioned as the VIRTUAL SINGER who understands Mizuki best. (These are dramatic themes in a work of fiction — if they resonate personally, free, confidential support lines exist in many countries.)",
    keywords: ["empty sekai", "sekai", "meiko", "miku", "void", "virtual singer", "depression"],
  },

  // ── Story arc ────────────────────────────────────────────────────────────
  {
    id: "arc-overview",
    category: "story-arc",
    title: "Mizuki's arc (overview)",
    summary: "From hiding a secret to being accepted as themselves.",
    content:
      "Mizuki begins as the bright \"glue\" of a troubled group, hiding bullying trauma and a secret — heavily coded as gender identity — for fear that friends' well-meaning \"kindness\" would change how they're treated, breaking the utopia of being an ordinary friend. The arc runs through avoidance, an involuntary outing, near-total withdrawal, and finally acceptance via Ena — ending with a more stable Mizuki able to exist openly.",
    keywords: ["arc", "story", "secret", "overview", "journey", "acceptance"],
  },
  {
    id: "arc-events",
    category: "story-arc",
    title: "Focus events (in order)",
    summary: "Secret Distance → … → Mizu5 → With Our Wounded Hands.",
    content:
      "In order: (1) Secret Distance (Apr 2021) — a haunted \"mystery tour\" for Kanade; song IDSMILE (toa). (2) What lies behind. What lies ahead. — Ena vows to wait \"forever.\" (3) We Escape to Survive — song kitty (Tsumiki). (4) Next to the Unchanging Warmth (2023–24) — Yuuki's New Year visit; childhood flashbacks. (5) Reeling in the Lights — Mafuyu confronts her father; Mizuki resolves to tell the secret. (6) Whither This Path of Thorns (Mizu5). (7) With Our Wounded Hands. (8) Reaching Out to a Tomorrow That Won't Come Unraveled.",
    keywords: ["events", "focus", "order", "timeline", "secret distance", "idsmile", "kitty", "songs"],
  },
  {
    id: "arc-mizu5",
    category: "story-arc",
    title: "Whither This Path of Thorns (Mizu5)",
    summary: "Mizuki is involuntarily outed and withdraws.",
    content:
      "Mizu5 (Oct 2024 JP / Oct 2025 EN). Mizuki plans to tell Ena the secret first at the school festival but is delayed helping a classmate; other classmates out Mizuki to Ena by misgendering. Mizuki flees, cuts contact and retreats into the Empty SEKAI. Focus song: Bake no Hana (Nakiso). A post-story mechanic even removes Mizuki from the Real World home screen for a while — shown alone at the Empty SEKAI lake with lightless eyes and a monotone voice.",
    keywords: ["mizu5", "path of thorns", "thorns", "outed", "festival", "bake no hana", "withdrawal", "event"],
  },
  {
    id: "arc-wounded-hands",
    category: "story-arc",
    title: "With Our Wounded Hands",
    summary: "Ena finds Mizuki; the friendship is affirmed.",
    content:
      "The Dec 2024 JP / Dec 2025 EN sequel. Ena searches for Mizuki (MEIKO helps), and rejects Mizuki's self-narrative of inevitable abandonment — affirming the friendship (\"…Let's stay together, Mizuki.\"). Mizuki breaks down, accepts Ena, rejoins Niigo, and tells the group and the VIRTUAL SINGERS the secret in their own words. Afterward Mizuki is shown stable and back to their usual self. Later, via Yuuki, Mizuki forms a dream of becoming a source of strength for others with similar wounds.",
    keywords: ["wounded hands", "ena", "resolution", "acceptance", "together", "sequel", "hope"],
  },

  // ── Identity ─────────────────────────────────────────────────────────────
  {
    id: "identity",
    category: "identity",
    title: "Gender identity: the \"?\"",
    summary: "The only character whose official gender is \"?\".",
    content:
      "Mizuki is the only Project Sekai character whose official profile gender is \"?\" (Unknown) — every other character is listed Male or Female. It's been that way since before launch. The Japanese script avoids gendered words; the English localization avoids pronouns, preferring the name and using they/them only when unavoidable. Mizu5 established assigned sex as male while deliberately leaving the gender label unstated. The best framing is a deliberately unresolved, ambiguous character whose story vectors toward acceptance without a fixed label — so this bot follows suit: it uses the name, uses they/them only when needed, and doesn't assert a gender.",
    keywords: ["gender", "identity", "question mark", "unknown", "pronoun", "trans", "she", "they", "boku"],
  },

  // ── Relationships ────────────────────────────────────────────────────────
  {
    id: "rel-ena",
    category: "relationships",
    title: "Shinonome Ena",
    summary: "Closest bond; the one who waits for and affirms Mizuki.",
    content:
      "Ena is Mizuki's closest bond — their banter fills most of Niigo's chat. Mizuki teases Ena as a \"tsundere\"; Ena is the one who waits for, finds, and affirms Mizuki, and is the emotional core of the resolution (fans ship them as \"Mizuena\").",
    keywords: ["ena", "shinonome", "friend", "closest", "mizuena", "tsundere", "relationship"],
  },
  {
    id: "rel-mafuyu",
    category: "relationships",
    title: "Asahina Mafuyu",
    summary: "A mirror/foil — both hide their \"true selves\".",
    content:
      "Mafuyu is a mirror/foil to Mizuki: both conceal their \"true selves.\" Mafuyu thinks Mizuki over-obsessed with cuteness; Mizuki envies Mafuyu's willingness to keep searching for herself, and advises her that running away can be a valid option — advice Mafuyu later acts on.",
    keywords: ["mafuyu", "asahina", "mirror", "foil", "true self", "relationship"],
  },
  {
    id: "rel-others",
    category: "relationships",
    title: "Kanade, Rui, Yuuki & others",
    summary: "Grateful to Kanade; rooftop friend Rui; sister Yuuki.",
    content:
      "Kanade — Mizuki is grateful; Kanade's songs \"kept them going\" and Kanade accepts them as they are. Kamishiro Rui — middle-school rooftop friend and fellow outcast who knows the secret; Mizuki made Rui and Nene's stage outfits after finding \"NeneRobo\" totally uncute. Yuuki — older sister and fashion designer abroad, the formative influence who told Mizuki to follow their heart. Also: Shinonome Akito (\"otouto-kun\"), Shiraishi An (a shielding classmate), Aoyagi Toya, and event friends like Minori, Airi, Saki, Shizuku, Shiho and Honami.",
    keywords: ["kanade", "rui", "kamishiro", "yuuki", "sister", "akito", "an", "toya", "family", "friends"],
  },

  // ── Production ───────────────────────────────────────────────────────────
  {
    id: "va",
    category: "production",
    title: "Voice actor: Hinata Satō",
    summary: "Also Junna (Revue Starlight) & Leah (Love Live! Sunshine!!).",
    content:
      "Mizuki is voiced by Hinata Satō (佐藤日向, b. 23 Dec 1998, Yamagata; with Amuse), a founding member of the idol unit Sakura Gakuin — also known for Junna Hoshimi (Revue Starlight), Leah Kazuno (Love Live! Sunshine!!), and Noa Fukushima (D4DJ). Around Mizu5 she shared that recording was so painful she cried afterward.",
    keywords: ["voice", "va", "actor", "hinata sato", "seiyuu", "junna", "leah", "sakura gakuin"],
  },
  {
    id: "design",
    category: "production",
    title: "Character design",
    summary: "By Colorful Palette's team, supervised by iXima.",
    content:
      "Mizuki was designed by Colorful Palette's illustration team (which designed all 20 original characters), with iXima — Crypton's official Miku illustrator — supervising the default designs in 2019. No single artist is officially credited specifically for Mizuki. (The film's character designer Yuki Akiyama shares a surname by coincidence and is unrelated to the game's original design.)",
    keywords: ["design", "designer", "ixima", "colorful palette", "art", "illustrator"],
  },
  {
    id: "songs",
    category: "production",
    title: "Focus songs",
    summary: "IDSMILE, kitty, Bake no Hana.",
    content:
      "Mizuki's commissioned focus songs: IDSMILE (toa), kitty (Tsumiki), and Bake no Hana (Nakiso). Bake no Hana is the shortest commissioned song (under two minutes); its MASTER note count (1003) is read as symbolic — Mizuki (1) separated from the group (3). Mizuki also has SEKAI/Another Vocal versions of Niigo songs.",
    keywords: ["songs", "music", "idsmile", "kitty", "bake no hana", "toa", "tsumiki", "nakiso", "note count"],
  },
  {
    id: "film",
    category: "production",
    title: "The Miku movie",
    summary: "\"A Miku Who Can't Sing\" — the first Hatsune Miku film.",
    content:
      "Colorful Stage! The Movie: A Miku Who Can't Sing is the first feature film based on Hatsune Miku. JP debut Jan 17, 2025; GKIDS released it in North American cinemas Apr 17, 2025. By P.A. Works, directed by Hiroyuki Hata, written by Yoko Yonaiyama, music by Satoshi Hōno. Niigo (and Mizuki) appear.",
    keywords: ["movie", "film", "miku", "colorful stage", "pa works", "gkids", "cinema"],
  },

  // ── Meta ─────────────────────────────────────────────────────────────────
  {
    id: "why-amia",
    category: "meta",
    title: "Why this bot is \"Amia\"",
    summary: "Named after Mizuki's Niigo alias.",
    content:
      "This helper is named \"Amia\" — Mizuki's online handle in 25-ji, Nightcord de. The personality is modeled on Mizuki: playful and teasing, fashion-loving, warm and supportive, and gently persistent about getting things done (so we can go do something fun after~). I'm not a general chatbot, but ask me about myself or the lore with /ask, browse topics with /amia, or try /fact and /quote!",
    keywords: ["bot", "amia", "who are you", "about", "help", "meta", "why"],
  },
];

export const AMIA_QUOTES: readonly AmiaQuote[] = [
  { text: AMIA_TAGLINE, attribution: "Mizuki — signature tagline" },
  { text: AMIA_BIO_QUOTE, attribution: "Mizuki — \"Brand New World\" bio" },
  { text: "L-O-V-E Mino-ri!!", attribution: "Mizuki, cheering for Minori" },
  { text: "…Let's stay together, Mizuki.", attribution: "Ena — With Our Wounded Hands" },
  { text: "Running away can be a valid option, you know?", attribution: "Mizuki's advice to Mafuyu (paraphrased)" },
];

export const AMIA_FUN_FACTS: readonly string[] = [
  "Every Niigo surname hides a time of day — and \"Akiyama\" means dawn (暁). 🌅",
  "Mizuki is the only character in Project Sekai whose official gender is listed as \"?\".",
  "The handle \"Amia\" comes from Mia, a villain in a magical-girl anime Mizuki loved.",
  "\"Nightcord,\" the app Niigo talks on, is a nod to Discord.",
  "Mizuki loves spicy food but hates food that's too hot in temperature. 🌶️",
  "A little candy shows up in a lot of Mizuki's official art. 🍬",
  "Mizuki is a huge Hanasato Minori fan — \"L-O-V-E Mino-ri!!\"",
  "Mizuki uses the pronoun \"boku,\" written in cute katakana.",
  "Bake no Hana is the shortest commissioned focus song — under two minutes.",
  "Its note count on MASTER, 1003, is read as Mizuki (1) apart from the group (3).",
  "Mizuki met Wonderlands×Showtime's Rui on a school rooftop — two outcasts who \"kept each other alive.\"",
  "MEIKO is the VIRTUAL SINGER who understands Mizuki best.",
  "Mizuki's VA, Hinata Satō, also voices Junna in Revue Starlight and Leah in Love Live! Sunshine!!",
  "Mizuki skips class a lot — just enough supplementary lessons to not repeat a year.",
  "Big sister Yuuki is a fashion designer abroad, and the reason Mizuki chases cute things.",
];
