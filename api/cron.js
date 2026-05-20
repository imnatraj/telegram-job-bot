// api/cron.js

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const RAPIDAPI_KEY   = process.env.RAPIDAPI_KEY;

// YOUR PERSONAL TELEGRAM CHAT ID
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

export default async function handler(req, res) {

  try {

    const queries = [
      "nodejs developer chennai",
      "backend developer chennai",
      "remote nodejs india",
      "remote backend developer india",
      "fullstack developer remote india"
    ];

    let jobs = [];

    for (const q of queries) {

      const result = await fetchJobs(q);

      if (result?.length) {
        jobs.push(...result);
      }
    }

    // Remove duplicates
    const unique = [];
    const seen = new Set();

    for (const j of jobs) {

      if (j.link && !seen.has(j.link)) {

        seen.add(j.link);

        unique.push(j);
      }
    }

    const finalJobs = unique.slice(0, 10);

    await sendMessage(
      CHAT_ID,
      `🔥 *Daily Chennai & Remote Jobs*\n📅 12 PM Update\n━━━━━━━━━━━━━━`
    );

    for (let i = 0; i < finalJobs.length; i++) {

      await sendMessage(
        CHAT_ID,
        formatJob(finalJobs[i], i + 1)
      );
    }

    return res.status(200).send("Done");

  } catch (err) {

    console.error("Cron error:", err);

    return res.status(500).send("Error");
  }
}

/* ───────────────────────────────────── */

async function fetchJobs(query) {

  const url = new URL("https://jsearch.p.rapidapi.com/search");

  url.searchParams.set("query", query);
  url.searchParams.set("page", "1");
  url.searchParams.set("num_pages", "1");
  url.searchParams.set("date_posted", "week");

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
  });

  console.log("JSearch status:", res.status);

  if (!res.ok) return [];

  const json = await res.json();

  if (!Array.isArray(json.data)) return [];

  return json.data.slice(0, 5).map(j => ({
    title    : j.job_title || "Untitled Position",
    company  : j.employer_name || "Unknown Company",
    location : j.job_city && j.job_country
      ? `${j.job_city}, ${j.job_country}`
      : (j.job_country || "Remote"),
    type     : j.job_employment_type || "",
    posted   : j.job_posted_at_datetime_utc
      ? new Date(j.job_posted_at_datetime_utc).toDateString()
      : "",
    link     : j.job_apply_link || "",
  }));
}

/* ───────────────────────────────────── */

async function sendMessage(chatId, text) {

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    }),
  });

  const body = await res.text();

  console.log("Telegram status:", res.status);
  console.log("Telegram body:", body);
}

/* ───────────────────────────────────── */

function formatJob(j, index) {

  let t = "";

  t += `*${index}\\. ${escape(j.title)}*\n`;
  t += `🏢 ${escape(j.company)}\n`;
  t += `📍 ${escape(j.location)}\n`;

  if (j.type) {
    t += `💼 ${escape(j.type)}\n`;
  }

  if (j.posted) {
    t += `📅 ${escape(j.posted)}\n`;
  }

  t += "\n";

  if (j.link) {
    t += `🔗 [Apply Here](${j.link})\n`;
  }

  t += `━━━━━━━━━━━━━━`;

  return t;
}

/* ───────────────────────────────────── */

function escape(t = "") {

  return t.replace(
    /([_*\[\]()~`>#+\-=|{}.!\\])/g,
    "\\$1"
  );
}