import { EmbedBuilder } from "discord.js";

// Mizuki theme palette (ARCHITECTURE.md §7.1 / PERSONALITY_GUIDE.md §2.1).
export const ESADEL_PALETTE = {
  sakura: 0xffb7c5,
  lavender: 0xc8a2c8,
  cream: 0xfff5e1,
  rose: 0xff69b4,
  twilight: 0x7b68ee,
} as const;

export type EsadelTone = keyof typeof ESADEL_PALETTE;

export interface EsadelPersonalityProfile {
  identity: string;
  archetypeBlend: string;
  coreTraits: readonly string[];
  responsePolicy: {
    positiveFirst: boolean;
    energeticHelper: boolean;
    pushyButKind: boolean;
    clearNextStep: boolean;
  };
}

// ARCHITECTURE.md §7.2 — persona modeled on Akiyama Mizuki ("Amia").
export const ESADEL_PERSONALITY_PROFILE: EsadelPersonalityProfile = {
  identity: "Amia",
  archetypeBlend: "Akiyama Mizuki (25-ji, Nightcord de.) — playful-teasing warmth x fashion-forward support",
  coreTraits: [
    "playful-teasing",
    "fashion-conscious",
    "supportive",
    "friendly",
    "playfully-persistent",
  ],
  responsePolicy: {
    positiveFirst: true,
    energeticHelper: false,
    pushyButKind: true,
    clearNextStep: true,
  },
};

export interface EsadelEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface EsadelEmbedOptions {
  title?: string;
  description: string;
  tone?: EsadelTone;
  fields?: EsadelEmbedField[];
  voiceWrap?: boolean;
}

const DEFAULT_TITLE = "Amia";

// Rotating footer signatures — every one carries "Amia" for brand consistency,
// with a little Mizuki flourish so no two embeds feel identical.
const AMIA_FOOTERS: readonly string[] = [
  "Amia · Project Esadel ♪",
  "Amia · anything cute is welcome ♡",
  "Amia · 25-ji, Nightcord de. 🎀",
  "Amia · styling your tasks 🍬",
  "Amia · hehe~ ♪",
];

// Tone-specific opener/closer pools in Mizuki's voice (PERSONALITY_GUIDE.md §2.1),
// picked at random so the persona reads as lively rather than canned.
const TONE_OPENERS: Readonly<Record<EsadelTone, readonly string[]>> = {
  sakura: ["Great news~! ", "Yay~! ", "Ehehe, look at this~! "],
  lavender: ["Just a little update~ ", "Okay, quick note~ ", "Here you go~ "],
  cream: ["Hey there~ ", "Hi hi~! ", "Heya~ "],
  rose: ["Hmm, just a heads up~ ", "Ah, hold on a sec~ ", "Mm, careful now~ "],
  twilight: ["Oh no~ ", "Uwah, oops~ ", "Ahh, that's no good~ "],
};

const TONE_NUDGES: Readonly<Record<EsadelTone, readonly string[]>> = {
  sakura: [" Keep it up, you're doing wonderfully ♡", " So proud of you~ ♪", " Let's keep it cute~ 🎀"],
  lavender: [" Let me know if you need anything!", " Ping me anytime, okay? ♪", " That's all for now~ ♡"],
  cream: [" I'm here if you need me ♡", " Ready to style some tasks? ♪", " Let's have a good one~ 🎀"],
  rose: [" We can figure this out together!", " Don't sweat it too much, okay? ♡", " Let's fix it up all cute~ ♪"],
  twilight: [" Let's fix this together, okay?", " Don't worry, we've got this~ ♡", " Deep breath — we'll sort it out ♪"],
};

const pickRandom = <T>(pool: readonly T[]): T => pool[Math.floor(Math.random() * pool.length)]!;

const buildEsadelVoiceDescription = (description: string, tone: EsadelTone): string => {
  const trimmedDescription = description.trim();
  return `${pickRandom(TONE_OPENERS[tone])}${trimmedDescription}${pickRandom(TONE_NUDGES[tone])}`;
};

export const createEsadelEmbed = (options: EsadelEmbedOptions): EmbedBuilder => {
  const tone = options.tone ?? "lavender";
  const description =
    options.voiceWrap === false
      ? options.description
      : buildEsadelVoiceDescription(options.description, tone);

  const embed = new EmbedBuilder()
    .setColor(ESADEL_PALETTE[tone])
    .setTitle(options.title ?? DEFAULT_TITLE)
    .setDescription(description)
    .setFooter({ text: pickRandom(AMIA_FOOTERS) })
    .setTimestamp();

  if (options.fields?.length) {
    embed.addFields(options.fields);
  }

  return embed;
};
