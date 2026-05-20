// api/webhook.js
// Vercel serverless function — handles all Telegram updates

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const RAPIDAPI_KEY   = process.env.RAPIDAPI_KEY;
const TELEGRAM_API   = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

export default async function handler(req, res) {
  // Health check — visiting the URL in a browser shows this
  if (req.method !== "POST") {
    return res.status(200).send("✅ Job Bot is running.");
  }

  // Always return 200 fast so Telegram stops retrying
  res.status(200).json({ ok: true });

  try {
    const { message } = req.body ?? {};
    if (!message?.text) return;

    const chatId = message.chat.id;
    const text   = String(message.text).trim();

    if (text === "/start") {
      await sendMessage(chatId,
        "🚀 *Job Bot Ready\\!*\n\nTry:\n👉 `/jobs nodejs chennai`\n👉 `/jobs backend remote`"
      );
      return;
    }

    if (text.startsWith("/jobs")) {
      const query = text.replace(/\/jobs\s*/i, "").trim();

      if (!query) {
        await sendMessage(chatId,
          "⚠️ Add keywords after `/jobs`\nExample: `/jobs react remote`"
        );
        return;
      }

      // 1. Acknowledge instantly — user sees this in ~200ms
      await sendMessage(chatId,
        `🔍 Searching jobs for: *${escape(query)}*\\.\\.\\.`
      );

      // 2. Fetch jobs from JSearch (Vercel hobby allows up to 10s)
      const jobs = await fetchJobs(query);

      // 3. Send results
      if (jobs === null) {
        await sendMessage(chatId,
          "❌ *JSearch quota exceeded\\.* Check your RapidAPI dashboard — the free tier has a monthly cap\\."
        );
        return;
      }

      if (!jobs.length) {
        await sendMessage(chatId,
          "😕 *No jobs found* for those keywords\\. Try something broader\\."
        );
        return;
      }

      await sendMessage(chatId, formatJobs(jobs));
      return;
    }

    await sendMessage(chatId,
      "💡 Type `/jobs <keyword> <location>` to search for open positions\\."
    );

  } catch (err) {
    console.error("Handler error:", err);
  }
}

/* ─── JSearch ─────────────────────────────────────────── */

async function fetchJobs(query) {
  const url = new URL("https://jsearch.p.rapidapi.com/search");
  url.searchParams.set("query", query);
  url.searchParams.set("page", "1");
  url.searchParams.set("num_pages", "1");
  url.searchParams.set("date_posted", "month");

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key" : RAPIDAPI_KEY,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
  });

  console.log("JSearch status:", res.status);

  if (res.status === 429) return null;
  if (!res.ok) return [];

  const json = await res.json();
  if (!Array.isArray(json.data)) return [];

  return json.data.slice(0, 5).map(j => ({
    title      : j.job_title        || "Untitled Position",
    company    : j.employer_name    || "Unknown Company",
    location   : j.job_city && j.job_country
                   ? `${j.job_city}, ${j.job_country}`
                   : (j.job_country || "Remote"),
    description: strip(j.job_description || ""),
    link       : j.job_apply_link   || "",
  }));
}

/* ─── Formatting ──────────────────────────────────────── */

function formatJobs(jobs) {
  let t = "🔥 *Latest Job Openings*\n\n━━━━━━━━━━━━━━\n\n";
  jobs.forEach((j, i) => {
    t += `*${i + 1}\\. ${escape(j.title)}*\n`;
    t += `🏢 ${escape(j.company)}\n`;
    t += `📍 ${escape(j.location)}\n`;
    t += `📝 _${escape(truncate(j.description, 300))}_\n\n`;
    if (j.link) t += `🔗 [Apply Here](${j.link})\n`;
    t += "\n━━━━━━━━━━━━━━\n\n";
  });
  return t;
}

/* ─── Telegram sender ─────────────────────────────────── */

async function sendMessage(chatId, text) {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({
      chat_id                  : chatId,
      text,
      parse_mode               : "MarkdownV2",
      disable_web_page_preview : true,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Telegram error:", res.status, body);
  }
}

/* ─── Helpers ─────────────────────────────────────────── */

function escape(t = "") {
  return t.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function strip(t) {
  return t.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(t, n) {
  return t.length <= n ? t : t.slice(0, n).trimEnd() + "...";
}