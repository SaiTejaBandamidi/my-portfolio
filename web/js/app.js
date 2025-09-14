const toastBox = document.getElementById("toast");
const term = document.getElementById("term");
const input = document.getElementById("cmd");
const clockEl = document.getElementById("clock");
let lastInputByVoice = false;


const toast = (msg) => {
  const t = document.createElement("div");
  t.className = "t";
  t.textContent = msg;
  toastBox.appendChild(t);
  setTimeout(() => t.remove(), 4000);
};

const speak = (text) => {
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    speechSynthesis.speak(u);
  }
};

// Clock
setInterval(() => { clockEl.textContent = new Date().toLocaleString(); }, 1000);

// Projects data
const projects = [
  {
    name: "Go GraphQL API (Harry Potter Demo)",
    stack: "Go • GraphQL • SQLC • Postgres • Tracing",
    desc: "gqlgen + SQLC + Postgres with optimized resolvers and tracing.",
    repo: "https://github.com/SaiTejaBandamidi/go-graphql-sqlc-api"
  },
  {
    name: "Personal Portfolio Website Jarvis-Inspired",
    stack: "Go • HTML • CSS • JavaScript",
    desc: "An interactive AI-powered portfolio website styled after Iron Man's JARVIS HUD.",
    repo: "https://github.com/SaiTejaBandamidi/my-portfolio"
  },
  {
    name: "CashCard Application",
    stack: "Python • Flask • HTML • CSS",
    desc: "A web app for managing cash cards and wallets with user accounts, balances, and transactions.",
    repo: "https://github.com/SaiTejaBandamidi/CashCardApplication"
  },
  {
    name: "Software Development Methodologies",
    stack: "Python • Jupyter Notebook • Markdown",
    desc: "A collection of coding exercises exploring different software development methodologies and coding practices.",
    repo: "https://github.com/SaiTejaBandamidi/SoftwareDevelopmentMethodologies"
  },
  {
    name: "Algorithm Implementations",
    stack: "Python • Jupyter Notebook",
    desc: "Notebook-based projects implementing algorithms as part of coursework.",
    repo: "https://github.com/SaiTejaBandamidi/SoftwareDevelopmentMethodologies"
  },
  {
    name: "Programming and Problem Solving in Python",
    stack: "Python • Software Development",
    desc: "Programming exercises demonstrating problem-solving and coding best practices.",
    repo: "https://github.com/SaiTejaBandamidi/SoftwareDevelopmentMethodologies"
  },
  {
    name: "Projects - WebScraping and File Processing in Python",
    stack: "Python • File Processing • Algorithms",
    desc: "Standalone Python scripts working with sequences and algorithms, showcasing coding fundamentals.",
    repo: "https://github.com/SaiTejaBandamidi/SoftwareDevelopmentMethodologies"
  }
];

// Profile + UI population
async function loadProfile() {
  const res = await fetch("/api/profile");
  const p = await res.json();

  // Operator card
  const el = document.getElementById("profile");
  el.innerHTML = `
    <div style="display:grid;gap:8px">
      <div style="font-size:20px;color:var(--primary);letter-spacing:.1em">${p.name}</div>
      <div style="opacity:.9">${p.role}</div>
      <div style="opacity:.7">${p.location}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${p.links.map(l => `<a class="tag" href="${l.url}" target="_blank">↗ ${l.label}</a>`).join("")}
      </div>
      <div class="card">
        <div class="meta">Contact</div>
        <div>${p.email}</div>
      </div>
    </div>`;

  // Skills
  const skills = document.getElementById("skills");
  skills.innerHTML = p.skills.map(s => `
    <div class="card">
      <div style="font-weight:600">${s}</div>
    </div>`).join("");

  // Projects
  const pr = document.getElementById("projects");
  pr.innerHTML = projects.map(x => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
        <div>
          <div style="font-weight:600">${x.name}</div>
          <div class="meta">${x.stack}</div>
        </div>
        <a class="tag" href="${x.repo}" target="_blank">Repository</a>
      </div>
      <p style="margin:8px 0 0 0;opacity:.9">${x.desc}</p>
    </div>`).join("");
}

// Terminal helpers
function println(msg){ term.innerHTML += `<div>${msg}</div>`; term.scrollTop = term.scrollHeight; }
function promptln(){ println(`<span class="prompt">core@hud</span>:~$`); }
promptln();

// Typewriter output for AI answers
async function typewrite(prefix, text, delay = 12) {
  const line = document.createElement("div");
  line.innerHTML = `<span class="prompt">${prefix}</span> `;
  term.appendChild(line);
  let i = 0;
  return new Promise((res) => {
    const id = setInterval(() => {
      line.innerHTML = `<span class="prompt">${prefix}</span> ` + text.slice(0, i++);
      term.scrollTop = term.scrollHeight;
      if (i > text.length) { clearInterval(id); res(); }
    }, delay);
  });
}

// Commands
async function handle(cmd) {
  const c = cmd.trim();
  if (!c) return;
  println(`<span class="prompt">»</span> ${c}`);

  const cl = c.toLowerCase();
  if (cl === "help") {
    println("commands: help, theme [neon|green|red|blue|dark], open about, list projects, about <project>, tech <name>, skill <name>, ping");
    return;
  }

  if (cl === "list projects") {
    projects.forEach(p => println(`◆ ${p.name} — ${p.stack}`));
    return;
  }

  if (cl.startsWith("about ")) {
    const q = cl.replace("about ", "").trim();
    const proj = projects.find(p => p.name.toLowerCase().includes(q));
    if (proj) {
      println(`📌 ${proj.name}`);
      println(`Stack: ${proj.stack}`);
      println(`Desc: ${proj.desc}`);
      println(`Repo: ${proj.repo}`);
    } else {
      println("❌ Project not found.");
    }
    return;
  }

  if (cl.startsWith("tech ") || cl.startsWith("skill ")) {
    const q = cl.replace(/(tech|skill)\s+/, "").trim();
    println(`🔎 Fetching info about ${q}...`);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q })
      });
      const j = await r.json();
      const ans = (j && j.a) ? j.a : "…";
      await typewrite("ai", ans);
      speak("Answer ready.");
    } catch {
      await typewrite("ai", "⚠️ Could not fetch details.");
    }
    return;
  }

  if (cl.startsWith("theme")) {
    const t = cl.split(" ")[1] || "dark";
    setTheme(t);
    println("theme set → " + t);
    return;
  }

  if (cl === "open about") { document.getElementById("brand").scrollIntoView({behavior:"smooth"}); toast("About opened"); return; }
  if (cl === "ping") {
    const t0 = performance.now();
    const r = await fetch("/api/ping");
    const j = await r.json();
    const dt = (performance.now() - t0).toFixed(0) + "ms";
    document.getElementById("latency").textContent = dt;
    println("pong " + j.now + " (" + dt + ")");
    return;
  }

  // fallback → AI
  try {
    const r = await fetch("/api/ask", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ q: c })
    });
    const j = await r.json();
    const ans = (j && j.a) ? j.a : "…";
    await typewrite("ai", ans);
    speak("Answer ready.");
  } catch (e) {
    await typewrite("ai", "Sorry — I hit an issue answering that.");
  }
}

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { handle(input.value); input.value = ""; promptln(); }
});

// 🎤 Voice recognition
const micBtn = document.getElementById("micBtn");
if (micBtn) {
  if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
    micBtn.disabled = true;
    micBtn.title = "Voice not supported in this browser";
  } else {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec;
    micBtn.onclick = () => {
      rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      toast("Listening…");
      rec.start();
      rec.onresult = (e) => {
        const t = e.results[0][0].transcript;
        println(`<span class="prompt">🎙</span> ${t}`);
        handle(t);
        speak("Acknowledged");
        promptln();
      };
      rec.onerror = (e) => {
        toast("Voice error: " + e.error);
      };
    };
  }
}

// Theme engine
function setTheme(t) {
  const r = document.documentElement;
  const map = {
    neon: ['#05070c','#0a1624','#79aab1ff','#45ffa2','#ff6b6b','#d7f9ff','#7acfe3'],
    green:['#04110a','#0b1f12','#45ffa2','#37e3ff','#ffb86b','#ddffe9','#99f3c2'],
    red:  ['#160606','#261111','#ff6b6b','#ffd166','#37e3ff','#ffd7d7','#ff9c9c'],
    blue: ['#060912','#0b1530','#8ab4ff','#37e3ff','#ff6b6b','#dbe6ff','#a6c8ff'],
    dark: ['#05070c','#0a1624','#37e3ff','#45ffa2','#ff6b6b','#d7f9ff','#7acfe3'],
    yellow: ['#1a1000','#2c1f00','#ffd166','#ff6b6b','#37e3ff','#fff0d7','#ffe29c']
  }[t] || null;
  if (!map) return;

  r.style.setProperty('--bg', map[0]);
  r.style.setProperty('--grid', map[1]);
  r.style.setProperty('--primary', map[2]);
  r.style.setProperty('--accent', map[3]);
  r.style.setProperty('--warn', map[4]);
  r.style.setProperty('--text', map[5]);
  r.style.setProperty('--muted', map[6]);
  localStorage.setItem('hud-theme', t);
}
document.getElementById("themeBtn").onclick = () => {
  const seq = ['dark','neon','green','red','blue'];
  const cur = localStorage.getItem('hud-theme') || 'dark';
  const n = seq[(seq.indexOf(cur) + 1) % seq.length];
  setTheme(n); toast('Theme → ' + n);
};
setTheme(localStorage.getItem('hud-theme') || 'dark');

// SSE Telemetry
function connectSSE() {
  const s = new EventSource("/sse");
  const el = document.getElementById("telemetry"); el.textContent = "";
  s.onmessage = (e) => {
    const d = JSON.parse(e.data);
    el.innerHTML = `<div class="card"><div class="meta">${d.time}</div><div>Temp ${d.temp.toFixed(1)}°C · Signal ${d.signal.toFixed(0)}% · Nodes ${d.nodes}</div></div>`;
  };
  s.onerror = () => { el.textContent = "Telemetry link lost. Reconnecting…"; setTimeout(connectSSE, 1500); };
}

// Initial ping latency + boot
async function init() {
  loadProfile(); connectSSE();
  const t0 = performance.now(); await fetch("/api/ping");
  document.getElementById("latency").textContent = (performance.now() - t0).toFixed(0) + "ms";
}
init();
