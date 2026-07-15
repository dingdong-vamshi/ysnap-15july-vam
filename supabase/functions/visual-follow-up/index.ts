import {
  checkRateLimit,
  formatError,
  formatResponse,
  generateText,
  handleCors,
  verifyUser,
} from "../shared/index.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const userId = await verifyUser(req);
    checkRateLimit(userId, 30, 60_000);

    const body = await req.json();
    const { question, history, imageContext } = body;

    if (!question) {
      return formatError("Missing question parameter");
    }

    const systemInstruction = `You are a helpful visual assistant. The user is asking a follow-up question about an image they captured earlier. Answer the question accurately and concisely based on the context of the image.
Do not fabricate facts, ingredients, or landmark historical data. If you are unsure, admit it.`;

    const chatHistoryPrompt = (history || [])
      .map((msg: any) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.text}`)
      .join("\n");

    const prompt = `Image Context (Base64 if available): ${imageContext ? "Present" : "Not Provided"}
Chat history so far:
${chatHistoryPrompt}

User question: ${question}

Response:`;

    const responseText = await generateText(prompt, systemInstruction);
    return formatResponse({ text: responseText });
  } catch (error: any) {
    return formatError(error);
  }
});
