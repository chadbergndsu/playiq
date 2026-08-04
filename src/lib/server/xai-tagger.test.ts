import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tagPlays, xaiChatCompletion } from "./xai-tagger";

describe("tagPlays", () => {
  it("uses heuristics when forceHeuristic is set", async () => {
    const res = await tagPlays(
      [
        {
          playId: "p1",
          signal: {
            side: "offense",
            visionHint: "shotgun trips inside zone left",
            yardsGained: 5,
          },
        },
      ],
      { forceHeuristic: true },
    );
    assert.equal(res.mode, "heuristic");
    assert.equal(res.results.length, 1);
    assert.ok(res.results[0]!.tags.some((t) => t.label === "Inside zone"));
  });

  it("uses LLM when fetch returns valid JSON and key present", async () => {
    const prev = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = "test-key-not-real";
    try {
      const fetchImpl: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    plays: [
                      {
                        playId: "p1",
                        tags: [
                          {
                            category: "formation",
                            label: "Empty",
                            confidence: 0.91,
                          },
                          {
                            category: "concept",
                            label: "Mesh",
                            confidence: 0.88,
                          },
                        ],
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      const res = await tagPlays(
        [
          {
            playId: "p1",
            signal: { side: "offense", visionHint: "empty mesh" },
          },
        ],
        { fetchImpl },
      );
      assert.equal(res.mode, "llm");
      assert.ok(res.results[0]!.tags.some((t) => t.label === "Mesh"));
      assert.ok(res.results[0]!.tags.every((t) => t.source === "ai"));
    } finally {
      if (prev === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = prev;
    }
  });

  it("falls back to heuristics when LLM HTTP fails", async () => {
    const prev = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = "test-key-not-real";
    try {
      const fetchImpl: typeof fetch = async () =>
        new Response("nope", { status: 500 });

      const res = await tagPlays(
        [
          {
            playId: "p1",
            signal: {
              side: "offense",
              visionHint: "shotgun inside zone",
              yardsGained: 4,
            },
          },
        ],
        { fetchImpl },
      );
      assert.equal(res.mode, "heuristic");
      assert.match(res.warning ?? "", /LLM unavailable|HTTP 500/);
      assert.ok(res.results[0]!.tags.length > 0);
    } finally {
      if (prev === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = prev;
    }
  });
});

describe("xaiChatCompletion", () => {
  it("throws without API key", async () => {
    const prev = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    try {
      await assert.rejects(
        () =>
          xaiChatCompletion([{ role: "user", content: "hi" }], {
            apiKey: undefined,
            fetchImpl: async () => new Response("{}"),
          }),
        /XAI_API_KEY/,
      );
    } finally {
      if (prev !== undefined) process.env.XAI_API_KEY = prev;
    }
  });
});
