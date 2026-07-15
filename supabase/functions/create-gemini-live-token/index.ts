import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import {
  checkRateLimit,
  formatError,
  formatResponse,
  getSecret,
  handleCors,
  verifyUser,
} from "../shared/index.ts";

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);

  // If WebSocket upgrade request
  if (req.headers.get("upgrade") === "websocket") {
    try {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response("Missing token", { status: 400 });
      }

      // Initialize Supabase Client
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      // Verify token represents a valid active session created in the last 5 minutes
      const { data: session, error } = await supabase
        .from("translation_sessions")
        .select("id, user_id, created_at")
        .eq("id", token)
        .eq("session_type", "camera")
        .maybeSingle();

      if (error || !session) {
        return new Response("Invalid or expired session token", { status: 401 });
      }

      const sessionTime = new Date(session.created_at).getTime();
      const ageMs = Date.now() - sessionTime;
      if (ageMs > 5 * 60 * 1000) {
        return new Response("Session token expired", { status: 401 });
      }

      // Retrieve Gemini API Key
      const geminiApiKey = await getSecret("GEMINI_API_KEY");

      // Upgrade connection to WebSocket
      const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

      // Connect to Google Gemini Live API
      const googleUri = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${geminiApiKey}`;
      const googleSocket = new WebSocket(googleUri);

      // Proxy messages client -> google
      clientSocket.onmessage = (event) => {
        if (googleSocket.readyState === WebSocket.OPEN) {
          googleSocket.send(event.data);
        }
      };

      // Proxy messages google -> client
      googleSocket.onmessage = (event) => {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(event.data);
        }
      };

      clientSocket.onclose = () => {
        googleSocket.close();
      };

      googleSocket.onclose = () => {
        clientSocket.close();
      };

      clientSocket.onerror = (err) => {
        console.error("Client WebSocket error:", err);
      };

      googleSocket.onerror = (err) => {
        console.error("Google WebSocket error:", err);
      };

      return response;
    } catch (err: any) {
      console.error("WebSocket proxy error:", err);
      return new Response(err.message, { status: 500 });
    }
  }

  // Regular HTTP request: Issue token
  try {
    const userId = await verifyUser(req);
    checkRateLimit(userId, 20, 60_000);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Create a temporary translation session acting as our ephemeral token
    const { data: session, error } = await supabase
      .from("translation_sessions")
      .insert({
        user_id: userId,
        session_type: "camera",
        source_language: "auto",
        target_language: "en",
        title: "Gemini Live Ephemeral Session",
        status: "active",
        metadata: { source: "camera-live" },
      })
      .select("id")
      .single();

    if (error || !session) {
      throw new Error(`Failed to issue session token: ${error?.message}`);
    }

    return formatResponse({
      token: session.id,
      expires_in: 300, // 5 minutes
    });
  } catch (error: any) {
    return formatError(error);
  }
});
