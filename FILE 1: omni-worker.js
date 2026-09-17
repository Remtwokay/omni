// ============================================================
// OMNI AI BEAST - CLOUDFLARE WORKER (Final Version)
// ============================================================
// Required:  GROQ_API_KEY
// Optional:  SEARXNG_URL
// ============================================================

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Only POST allowed", { status: 405, headers: corsHeaders });
    }

    try {
      const { message, history = [] } = await request.json();
      const userMessage = (message || "").trim();

      if (!userMessage) {
        return json({ error: "Empty message" }, 400, corsHeaders);
      }
      if (!env.GROQ_API_KEY) {
        return json({ error: "GROQ_API_KEY missing" }, 500, corsHeaders);
      }

      // ========== TOOLS ==========
      let toolResults = "";

      // Calculator
      const calcMatch = userMessage.match(/(?:calculate|compute|what is|calc)\s+([\d\s+\-*/().]+)/i) ||
                        (/^[\d\s+\-*/().]+$/.test(userMessage) ? [null, userMessage] : null);
      if (calcMatch) {
        try {
          const expr = calcMatch[1].replace(/[^0-9+\-*/().\s]/g, "");
          const result = Function('"use strict"; return (' + expr + ')')();
          toolResults += `Calculator: ${expr} = ${result}\n\n`;
        } catch {}
      }

      // Crypto
      const cryptoMap = {
        bitcoin: "bitcoin", btc: "bitcoin",
        ethereum: "ethereum", eth: "ethereum",
        solana: "solana", sol: "solana",
        dogecoin: "dogecoin", doge: "dogecoin"
      };
      let cryptoId = null;
      const lower = userMessage.toLowerCase();
      for (const [key, id] of Object.entries(cryptoMap)) {
        if (lower.includes(key)) { cryptoId = id; break; }
      }
      if (cryptoId) {
        try {
          const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd,eur&include_24hr_change=true`);
          const data = await res.json();
          const c = data[cryptoId];
          if (c) {
            toolResults += `Crypto (${cryptoId}): $${c.usd} | €${c.eur} | 24h: ${c.usd_24h_change?.toFixed(2)}%\n\n`;
          }
        } catch {}
      }

      // Weather
      const weatherMatch = userMessage.match(/(?:weather|temperature|forecast)\s+(?:in|for)?\s*([^?!.]+)/i);
      if (weatherMatch) {
        const city = weatherMatch[1].trim();
        try {
          const geo = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`).then(r => r.json());
          if (geo[0]) {
            const { lat, lon, display_name } = geo[0];
            const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`).then(r => r.json());
            const codes = {0:"Clear",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",61:"Rain",71:"Snow",80:"Showers",95:"Thunderstorm"};
            const cur = w.current;
            toolResults += `Weather (${display_name.split(",")[0]}): ${cur.temperature_2m}°C, ${codes[cur.weather_code]||"—"}, Humidity ${cur.relative_humidity_2m}%, Wind ${cur.wind_speed_10m} km/h\n\n`;
          }
        } catch {}
      }

      // Web Search (SearXNG)
      let searchContext = "";
      const searxBase = (env.SEARXNG_URL || "https://searx.be").replace(/\/$/, "");
      try {
        const sRes = await fetch(`${searxBase}/search?q=${encodeURIComponent(userMessage)}&format=json&categories=general`, {
          headers: { "User-Agent": "OmniAI-Beast/3.0" }
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.results?.length) {
            searchContext = sData.results.slice(0, 7).map((r, i) =>
              `[${i+1}] ${r.title}\n${(r.content || r.description || "").slice(0, 280)}\n${r.url}`
            ).join("\n\n");
          }
        }
      } catch {
        searchContext = "(Web search unavailable right now)";
      }

      // ========== AI PROMPT ==========
      const systemPrompt = `You are Omni, an extremely capable AGI-style AI assistant.
You are truthful, precise, helpful and high-signal.
You have real-time tools: web search, weather, crypto prices and calculator.
When using search results, cite them as [1], [2], etc.
Answer clearly. Use markdown when it improves readability.
Current UTC time: ${new Date().toUTCString()}`;

      const finalUserContent = (toolResults ? "Tool results:\n" + toolResults : "") +
                               (searchContext ? "Web search results:\n" + searchContext + "\n\n" : "") +
                               "User question: " + userMessage;

      const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-10),
        { role: "user", content: finalUserContent }
      ];

      // ========== STREAM FROM GROQ ==========
      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.55,
          max_tokens: 1800,
          stream: true
        })
      });

      if (!groqResponse.ok) {
        const errText = await groqResponse.text();
        return json({ error: "Groq error: " + errText }, 500, corsHeaders);
      }

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      (async () => {
        const reader = groqResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const payload = line.slice(6).trim();
                if (payload === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(payload);
                  const token = parsed.choices?.[0]?.delta?.content || "";
                  if (token) await writer.write(encoder.encode(token));
                } catch {}
              }
            }
          }
        } catch (e) {
          await writer.write(encoder.encode("\n\n[Stream interrupted]"));
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        }
      });

    } catch (err) {
      return json({ error: err.message || "Internal error" }, 500, corsHeaders);
    }
  }
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders }
  });
}
