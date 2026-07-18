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

// ARCHITECTURE.md §7.2 — identity pending final bot naming.
export const ESADEL_PERSONALITY_PROFILE: EsadelPersonalityProfile = {
  identity: "Project Esadel Helper",
  archetypeBlend: "Authentic Mizuki mannerisms from the PJSK database",
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

const DEFAULT_TITLE = "Project Esadel Helper";
const DEFAULT_FOOTER = "Project Esadel Helper";

// Tone-specific openers/closers (PERSONALITY_GUIDE.md §2.1).
const TONE_OPENERS: Readonly<Record<EsadelTone, string>> = {
  sakura: "Great news~! ",
  lavender: "Just a little update~ ",
  cream: "Hey there~ ",
  rose: "Hmm, just a heads up~ ",
  twilight: "Oh no~ ",
};

const TONE_NUDGES: Readonly<Record<EsadelTone, string>> = {
  sakura: " Keep it up, you're doing wonderfully ♡",
  lavender: " Let me know if you need anything!",
  cream: " I'm here if you need me ♡",
  rose: " We can figure this out together!",
  twilight: " Let's fix this together, okay?",
};

const buildEsadelVoiceDescription = (description: string, tone: EsadelTone): string => {
  const trimmedDescription = description.trim();
  return `${TONE_OPENERS[tone]}${trimmedDescription}${TONE_NUDGES[tone]}`;
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
    .setFooter({ text: DEFAULT_FOOTER })
    .setTimestamp();

  if (options.fields?.length) {
    embed.addFields(options.fields);
  }

  return embed;
};
