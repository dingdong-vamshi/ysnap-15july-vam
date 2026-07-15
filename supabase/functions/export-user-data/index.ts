import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { 
  handleCors, 
  verifyUser, 
  parseJsonBody, 
  formatError, 
  formatResponse, 
  checkRateLimit,
  corsHeaders
} from "../shared/index.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const userId = await verifyUser(req);
    checkRateLimit(userId, 10); // stricter limit for export (10 requests per min)

    // Accept format preference ("json" or "gzip")
    let format = "json";
    try {
      const body = await parseJsonBody<{ format?: string }>(req);
      format = body.format?.toLowerCase() || "json";
    } catch {
      // If no body provided, default to JSON format
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    console.log(`Compiling GDPR data export for user ${userId}...`);

    // Fetch data from all 11 tables in parallel
    const [
      profilesRes,
      preferencesRes,
      sessionsRes,
      itemsRes,
      mediaRes,
      summariesRes,
      bookmarksRes,
      voiceProfilesRes,
      consentsRes,
      practiceRes,
      usageRes
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId),
      supabase.from('user_preferences').select('*').eq('user_id', userId),
      supabase.from('translation_sessions').select('*').eq('user_id', userId),
      supabase.from('translation_items').select('*').eq('user_id', userId),
      supabase.from('media_assets').select('*').eq('user_id', userId),
      supabase.from('conversation_summaries').select('*').eq('user_id', userId),
      supabase.from('bookmarks').select('*').eq('user_id', userId),
      supabase.from('voice_profiles').select('*').eq('user_id', userId),
      supabase.from('voice_consents').select('*').eq('user_id', userId),
      supabase.from('practice_attempts').select('*').eq('user_id', userId),
      supabase.from('usage_events').select('*').eq('user_id', userId),
    ]);

    const exportData = {
      export_metadata: {
        user_id: userId,
        exported_at: new Date().toISOString(),
        version: "1.0"
      },
      profiles: profilesRes.data || [],
      user_preferences: preferencesRes.data || [],
      translation_sessions: sessionsRes.data || [],
      translation_items: itemsRes.data || [],
      media_assets: mediaRes.data || [],
      conversation_summaries: summariesRes.data || [],
      bookmarks: bookmarksRes.data || [],
      voice_profiles: voiceProfilesRes.data || [],
      voice_consents: consentsRes.data || [],
      practice_attempts: practiceRes.data || [],
      usage_events: usageRes.data || []
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    if (format === "gzip") {
      console.log("Compressing export data using Gzip...");
      const textEncoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(textEncoder.encode(jsonString));
          controller.close();
        }
      });
      
      const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
      
      return new Response(compressedStream, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/gzip",
          "Content-Disposition": `attachment; filename="ysnap_export_${userId}.json.gz"`,
          "Cache-Control": "no-cache"
        }
      });
    }

    // Default: Return raw JSON response
    return formatResponse(exportData);
  } catch (err) {
    return formatError(err);
  }
});
