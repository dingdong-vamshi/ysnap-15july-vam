import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { 
  handleCors, 
  verifyUser, 
  formatError, 
  formatResponse, 
  checkRateLimit,
  getSecret
} from "../shared/index.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const userId = await verifyUser(req);
    checkRateLimit(userId, 5); // very strict rate limit for account deletion (5 per min)

    const elevenLabsApiKey = await getSecret('ELEVENLABS_API_KEY').catch(() => '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    console.log(`Initiating cascade deletion for user ${userId}...`);

    // 1. Fetch and delete ElevenLabs voice clones
    try {
      const { data: voiceProfiles } = await supabase
        .from('voice_profiles')
        .select('provider_voice_id')
        .eq('user_id', userId)
        .eq('provider', 'elevenlabs');

      if (voiceProfiles && voiceProfiles.length > 0 && elevenLabsApiKey) {
        for (const vp of voiceProfiles) {
          if (vp.provider_voice_id) {
            try {
              console.log(`Deleting ElevenLabs voice: ${vp.provider_voice_id}...`);
              const response = await fetch(`https://api.elevenlabs.io/v1/voices/${vp.provider_voice_id}`, {
                method: "DELETE",
                headers: { "xi-api-key": elevenLabsApiKey }
              });
              if (!response.ok) {
                console.warn(`ElevenLabs voice deletion returned code ${response.status} for voice ID ${vp.provider_voice_id}`);
              }
            } catch (e) {
              console.error(`Failed to delete ElevenLabs voice ${vp.provider_voice_id}:`, e);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error during ElevenLabs voice cleanup:", err);
    }

    // 2. Fetch and delete all user files in Supabase Storage
    try {
      const { data: assets } = await supabase
        .from('media_assets')
        .select('bucket, path')
        .eq('user_id', userId);

      if (assets && assets.length > 0) {
        // Group paths by bucket name to perform batch deletes
        const bucketGroups = assets.reduce((acc, curr) => {
          if (curr.bucket && curr.path) {
            acc[curr.bucket] = acc[curr.bucket] || [];
            acc[curr.bucket].push(curr.path);
          }
          return acc;
        }, {} as Record<string, string[]>);

        for (const [bucket, paths] of Object.entries(bucketGroups)) {
          console.log(`Deleting ${paths.length} files from storage bucket '${bucket}'...`);
          const { error: storageDeleteError } = await supabase.storage.from(bucket).remove(paths);
          if (storageDeleteError) {
            console.error(`Failed to delete files from bucket '${bucket}':`, storageDeleteError);
          }
        }
      }
    } catch (err) {
      console.error("Error during Supabase Storage cleanup:", err);
    }

    // 3. Cascade delete database tables (dependent tables first to avoid constraint errors)
    const tablesToDelete = [
      'voice_consents',
      'voice_profiles',
      'practice_attempts',
      'conversation_summaries',
      'media_assets',
      'bookmarks',
      'translation_items',
      'translation_sessions',
      'user_preferences',
      'usage_events',
      'profiles'
    ];

    for (const table of tablesToDelete) {
      const idColumn = (table === 'profiles') ? 'id' : 'user_id';
      console.log(`Deleting records from database table '${table}'...`);
      const { error: dbDeleteError } = await supabase
        .from(table)
        .delete()
        .eq(idColumn, userId);

      if (dbDeleteError) {
        console.error(`Error deleting records from table '${table}':`, dbDeleteError);
        // Continue with other tables even if one fails to achieve maximum cleanup
      }
    }

    // 4. Delete user account from Supabase Auth admin panel
    console.log(`Deleting user from Supabase Auth...`);
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error("Failed to delete user account from Supabase Auth:", authDeleteError);
      throw new Error(`Failed to delete auth user record: ${authDeleteError.message}`);
    }

    console.log(`Cascade deletion completed successfully for user: ${userId}`);

    return formatResponse({
      message: "User account and all associated data successfully deleted."
    });
  } catch (err) {
    return formatError(err);
  }
});
