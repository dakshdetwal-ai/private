
const SUPABASE_URL = "https://evsnwenvmwhrohyzrjqq.supabase.co";
const SUPABASE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
let role = null;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function setMessage(id, message, error = false) {
  $(id).textContent = message;
  $(id).style.color = error ? "#ff7180" : "#36d6a0";
}

function updatePreset() {
  const preset = $("timePreset").value;
  const values = {
    default: "7 minutes",
    "5": "5 minutes before",
    anytime: "",
    yesterday: "Yesterday"
  };
  $("eventTime").value = values[preset];
}

$("timePreset").addEventListener("change", updatePreset);

$("pair").addEventListener("change", () => {
  $("customPairWrap").classList.toggle(
    "hidden", $("pair").value !== "OTHER"
  );
});

$("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const password = $("password").value.trim();

  if (password === "9602") {
    role = "user";
  } else if (password === "9902") {
    role = "admin";
  } else {
    $("loginError").textContent = "Incorrect password. Try again.";
    return;
  }

  $("loginError").textContent = "";
  $("loginView").classList.add("hidden");
  $("dashboard").classList.remove("hidden");

  $("roleBadge").textContent =
    role === "admin" ? "ADMIN PANEL" : "USER PANEL";

  $("pageTitle").textContent =
    role === "admin" ? "Manage Events" : "Event Feed";

  $("adminPanel").classList.toggle("hidden", role !== "admin");

  loadEvents();
});

$("logoutBtn").addEventListener("click", () => {
  role = null;
  $("password").value = "";
  $("dashboard").classList.add("hidden");
  $("loginView").classList.remove("hidden");
});

async function loadEvents() {
  $("eventsList").innerHTML =
    '<p class="muted">Loading events...</p>';

  const { data, error } = await db
    .from("events")
    .select("id, who, pair, position, event_time, published_at")
    .order("id", { ascending: false });

  if (error) {
    $("eventsList").innerHTML =
      '<div class="empty">Could not load events.</div>';
    setMessage("feedMessage", error.message, true);
    return;
  }

  setMessage("feedMessage", "");

  $("eventCount").textContent =
    `${data.length} event${data.length === 1 ? "" : "s"}`;

  if (data.length === 0) {
    $("eventsList").innerHTML =
      '<div class="empty">No events published yet.</div>';
    return;
  }

  $("eventsList").innerHTML = data.map((item) => `
    <article class="event">
      <div class="event-top">
        <div>
          <div class="event-pair">${escapeHTML(item.pair)}</div>
          <div class="event-name">By ${escapeHTML(item.who)}</div>
        </div>
        <span class="side ${item.position === "BUY" ? "buy" : "sell"}">
          ${escapeHTML(item.position)}
        </span>
      </div>
      <div class="event-meta">
        <span>Event time: <strong>${escapeHTML(item.event_time)}</strong></span>
        <span>Published: ${escapeHTML(
          new Date(item.published_at).toLocaleString()
        )}</span>
      </div>
    </article>
  `).join("");
}

$("eventForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (role !== "admin") return;

  const who = $("who").value.trim();
  const pair = $("pair").value === "OTHER"
    ? $("customPair").value.trim().toUpperCase()
    : $("pair").value;

  const position = $("position").value;
  const eventTime = $("eventTime").value.trim() || "Anytime";

  if (!who || !pair) {
    setMessage("publishMessage", "Please complete all required fields.", true);
    return;
  }

  const presetLabels = {
    default: "7 minutes (default)",
    "5": "5 minutes before",
    anytime: "Anytime / custom",
    yesterday: "Yesterday"
  };

  const button = event.submitter;
  button.disabled = true;
  button.textContent = "Publishing...";

  const { error } = await db.from("events").insert({
    who,
    pair,
    position,
    event_time: eventTime
  });

  button.disabled = false;
  button.textContent = "Confirm & publish";

  if (error) {
    setMessage("publishMessage", error.message, true);
    return;
  }

  setMessage(
    "publishMessage",
    `Event published. Preset: ${presetLabels[$("timePreset").value]}`
  );

  $("eventForm").reset();
  $("timePreset").value = "default";
  updatePreset();
  $("customPairWrap").classList.add("hidden");

  await loadEvents();
});

// Automatically refresh the feed every 10 seconds.
setInterval(() => {
  if (role) loadEvents();
}, 10000);
