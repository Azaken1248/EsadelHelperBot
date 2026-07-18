import { describe, expect, it } from "vitest";

import { createEsadelEmbed, ESADEL_PALETTE } from "../../src/presentation/esadel-embed";

describe("createEsadelEmbed", () => {
  it("applies tone color, title, footer, and wrapped voice style by default", () => {
    const embed = createEsadelEmbed({
      description: "System is ready.",
      tone: "lavender",
    }).toJSON();

    expect(embed.color).toBe(ESADEL_PALETTE.lavender);
    expect(embed.title).toBe("Project Esadel Helper");
    expect(embed.footer?.text).toBe("Project Esadel Helper");
    expect(embed.description).toContain("Just a little update~");
    expect(embed.description).toContain("Let me know if you need anything!");
  });

  it("keeps raw description when voiceWrap is false", () => {
    const embed = createEsadelEmbed({
      description: "Raw payload",
      voiceWrap: false,
    }).toJSON();

    expect(embed.description).toBe("Raw payload");
  });

  it("defaults to the lavender tone", () => {
    const embed = createEsadelEmbed({
      description: "No tone provided",
      voiceWrap: false,
    }).toJSON();

    expect(embed.color).toBe(ESADEL_PALETTE.lavender);
  });

  it("adds provided fields", () => {
    const embed = createEsadelEmbed({
      description: "Test",
      fields: [
        {
          name: "Key",
          value: "Value",
          inline: true,
        },
      ],
    }).toJSON();

    expect(embed.fields).toHaveLength(1);
    expect(embed.fields?.[0]).toMatchObject({
      name: "Key",
      value: "Value",
      inline: true,
    });
  });
});
