import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { 
  handleCors, 
  verifyUser, 
  parseJsonBody, 
  formatError, 
  formatResponse, 
  checkRateLimit, 
  logUsageEvent,
  generateTextResult,
  safeParseAIJson
} from "../shared/index.ts";

interface TranscriptItem {
  speaker?: string;
  text: string;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const userId = await verifyUser(req);
    checkRateLimit(userId);

    const { sessionId, transcript, targetLanguage = "en" } = await parseJsonBody<{
      sessionId?: string;
      transcript?: TranscriptItem[] | string[];
      targetLanguage?: string;
    }>(req);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    let compiledTranscript = "";

    // 1. Fetch transcript from DB if sessionId is provided
    if (sessionId) {
      console.log(`Fetching transcript for session ${sessionId} from database...`);
      const { data: session } = await supabase
        .from('translation_sessions')
        .select('id,user_id')
        .eq('id', sessionId)
        .maybeSingle();
      if (!session || session.user_id !== userId) {
        return formatError('Conversation session was not found for this user', 404);
      }

      const { data: items, error } = await supabase
        .from('translation_items')
        .select('speaker_id, source_text, translated_text, sequence_number')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .order('sequence_number', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch session items: ${error.message}`);
      }

      if (items && items.length > 0) {
        compiledTranscript = items
          .map((item, idx) => {
            const speaker = item.speaker_id || `Speaker ${idx + 1}`;
            return `${speaker}: "${item.source_text}" (Translated: "${item.translated_text || ''}")`;
          })
          .join("\n");
      }
    }

    // 2. Use user-provided transcript if database query was empty or not requested
    if (!compiledTranscript && transcript) {
      if (Array.isArray(transcript)) {
        compiledTranscript = transcript
          .map((item, idx) => {
            if (typeof item === 'string') {
              return `Speaker ${idx + 1}: "${item}"`;
            } else if (item && typeof item === 'object') {
              const speaker = item.speaker || `Speaker ${idx + 1}`;
              return `${speaker}: "${item.text}"`;
            }
            return "";
          })
          .filter(Boolean)
          .join("\n");
      }
    }

    if (!compiledTranscript.trim()) {
      return formatError("No transcript content found to summarize. Provide a valid 'sessionId' with items or 'transcript' array.");
    }

    // 3. Query Gemini for summary, key points, action items, decisions
    const systemInstruction = `You are a professional conversation summary AI. Read the transcript of a translated conversation and output a JSON object with:
- "title": (string) a professional, descriptive title for this conversation.
- "summary": (string) a detailed paragraph summarizing the discussion.
- "key_points": (array of strings) the core ideas or key takeaways.
- "questions": (array of strings) questions asked, pending answers, or unresolved topics.
- "decisions": (array of strings) any conclusions, agreements, or choices made.
- "action_items": (array of strings) tasks, follow-ups, or action items assigned to either party.
- "generated_language": (string) the ISO code or name of the language used for this summary ("${targetLanguage}").

Ensure the summary, title, and all bullet points are written in the language specified: "${targetLanguage}".
Your entire response must be a single, valid JSON object without markdown wrapping or backticks.`;

    const promptText = `Generate a detailed summary and meeting notes for the following conversation:\n\n${compiledTranscript}`;

    console.log(`Generating conversation summary for transcript length ${compiledTranscript.length}...`);
    const generated = await generateTextResult(promptText, systemInstruction, true);
    const responseText = generated.text;

    const parsedResult = safeParseAIJson<{
      title: string;
      summary: string;
      key_points: string[];
      questions: string[];
      decisions: string[];
      action_items: string[];
      generated_language?: string;
    }>(responseText, {
      title: 'string',
      summary: 'string',
      key_points: 'array',
      questions: 'array',
      decisions: 'array',
      action_items: 'array',
      generated_language: 'string'
    });

    if (!parsedResult.title) {
      parsedResult.title = "Conversation Summary";
    }
    if (!parsedResult.summary) {
      parsedResult.summary = responseText;
    }
    if (!parsedResult.generated_language) {
      parsedResult.generated_language = targetLanguage;
    }

    // 4. Save to database if sessionId is present
    if (sessionId) {
      console.log(`Saving conversation summary to database...`);
      const payload = {
        session_id: sessionId,
        user_id: userId,
        title: parsedResult.title,
        summary: parsedResult.summary,
        key_points: parsedResult.key_points || [],
        questions: parsedResult.questions || [],
        decisions: parsedResult.decisions || [],
        action_items: parsedResult.action_items || [],
        generated_language: parsedResult.generated_language || targetLanguage
      };
      const { data: existing } = await supabase
        .from('conversation_summaries')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();
      const query = existing
        ? supabase.from('conversation_summaries').update(payload).eq('id', existing.id)
        : supabase.from('conversation_summaries').insert(payload);
      const { error: dbError } = await query;

      if (dbError) {
        console.error("Failed to save summary to database:", dbError);
      }
    }

    // Log Summary Usage Event
    await logUsageEvent(userId, 'summary', compiledTranscript.length, 'characters', {
      session_id: sessionId || null,
      transcript_length: compiledTranscript.length,
      provider: 'google',
      model: generated.model
    });

    return formatResponse({ ...parsedResult, summary_model: generated.model });
  } catch (err) {
    return formatError(err);
  }
});
