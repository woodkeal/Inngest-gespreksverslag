import OpenAI from "openai";

// Lazy singleton — initialized on first use so missing keys don't crash at startup
let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });
  }
  return _client;
}

// For direct import convenience — actual key validated on first API call
export const openaiClient = new Proxy({} as OpenAI, {
  get(_, prop: string | symbol) {
    return getOpenAIClient()[prop as keyof OpenAI];
  },
});
