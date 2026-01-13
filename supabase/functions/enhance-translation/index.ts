import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashPrompt(prompt: string): Promise<string> {
  const data = new TextEncoder().encode(prompt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, sourceLang, targetLang, isPremium } = await req.json();

    if (!text || !targetLang) {
        throw new Error("Missing required fields: text, targetLang");
    }

    const source = sourceLang || 'English';
    
    let prompt = "";

    if (isPremium) {
        // Premium: Fetch everything
        prompt = `
        You are a language tutor. Analyze the phrase/word "${text}" (which is in ${targetLang}) and provide enrichment data for a student who speaks ${source}.

        Return ONLY a valid JSON object with the following keys:
        1. "pronunciation": The phonetic transcription (IPA or standard phonetic) of "${text}".
        2. "meaning": A concise explanation of the meaning and context of "${text}" in ${source}.
        3. "examples": An array of 3 diverse usage examples in ${targetLang}, with "target" (sentence) and "source" (translation in ${source}).
        4. "synonyms": An array of 3 synonyms in ${targetLang}, with "word" and "nuance" (explanation in ${source}).
        5. "tone": An array of 3 rewritten versions in ${targetLang} with different tones ("Formal", "Informal", "Slang"), including "tone", "text", and "context" (explanation in ${source}).

        JSON Format:
        {
          "pronunciation": "...",
          "meaning": "...",
          "examples": [ { "target": "...", "source": "..." } ],
          "synonyms": [ { "word": "...", "nuance": "..." } ],
          "tone": [ { "tone": "Formal", "text": "...", "context": "..." } ]
        }
        `;
    } else {
        // Free: Fetch only pronunciation
        prompt = `
        You are a language tutor. Provide the phonetic pronunciation for the phrase/word "${text}" (which is in ${targetLang}).

        Return ONLY a valid JSON object with the following key:
        1. "pronunciation": The phonetic transcription (IPA or standard phonetic) of "${text}".

        JSON Format:
        {
          "pronunciation": "..."
        }
        `;
    }

    const prompt_hash = await hashPrompt(prompt);
    
    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache
    const { data: cacheHit } = await supabase
        .from('openai_cache')
        .select('response, created_at')
        .eq('prompt_hash', prompt_hash)
        .maybeSingle();
        
    if (cacheHit && cacheHit.response) {
         console.log('[CACHE HIT]', prompt_hash);
         return new Response(JSON.stringify(cacheHit.response), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
         });
    }

    // Call OpenAI
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("Missing OpenAI API Key");

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            response_format: { type: "json_object" }
        })
    });

    if (!openaiRes.ok) {
        const errorText = await openaiRes.text();
        console.error("OpenAI API Error:", errorText);
        throw new Error(`OpenAI API error: ${openaiRes.status} ${errorText}`);
    }

    const data = await openaiRes.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
        throw new Error("No content received from OpenAI");
    }

    const parsedContent = JSON.parse(content);

    // Cache result
    await supabase.from('openai_cache').upsert({
        prompt_hash,
        prompt,
        response: parsedContent,
        created_at: new Date().toISOString()
    }, { onConflict: 'prompt_hash' });

    return new Response(JSON.stringify(parsedContent), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
