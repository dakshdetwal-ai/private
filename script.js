
/* =========================================
   DETwal Event Desk
========================================= */

const SUPABASE_URL =
  "https://evsnwenvmwhrohyzrjgq.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_Vfy2VLbqRYB_DOsK13iuqA_9-pk4Q5t";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = (id) => document.getElementById(id);

let role = null;
let refreshTimer = null;

/* ---------- Helpers ---------- */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function setMessage(id, message, isError = false) {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#ff7180" : "#36d6a0";
}

/* ---------- Login ---------- */

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

  $("adminPanel").classList.toggle(
    "hidden",
    role !== "admin"
  );

  loadEvents();

  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (role) loadEvents();
  }, 10000);
});

/* ---------- Logout ---------- */

$("logoutBtn").addEventListener("click", () => {
  role = null;
  clearInterval(refreshTimer);

  $("password").value = "";
  $("dashboard").classList.add("hidden");
  $("loginView").classList.remove("hidden");
});

/* ---------- Event form controls ---------- */

$("timePreset").addEventListener("change", () => {
  const presets = {
    default: "7 minutes",
    "5": "5 minutes before",
    anytime: "",
    yesterday: "Yesterday"
  };

  $("eventTime").value = presets[$("timePreset").value];
});

$("pair").addEventListener("change", () => {
  $("customPairWrap").classList.toggle(
    "hidden",
    $("pair").value !== "OTHER"
  );
});

/* ---------- Load shared events ---------- */

async function loadEvents() {
  const list = $("eventsList");

  try {
    const { data, error } = await db
      .from("events")
      .select("id, who, pair, position, event_time")
      .order("id", { ascending: false });

    if (error) throw error;

    $("eventCount").textContent =
      `${data.length} event${data.length === 1 ? "" : "s"}`;

    setMessage("feedMessage", "");

    if (!data.length) {
      list.innerHTML =
        '<div class="empty">No events published yet.</div>';
      return;
    }

    list.innerHTML = data.map((item) => `
      <article class="event">
        <div class="event-top">
          <div>
            <div class="event-pair">
              ${escapeHTML(item.pair)}
            </div>
            <div class="event-name">
              By ${escapeHTML(item.who)}
            </div>
          </div>

          <span class="side ${
            item.position === "BUY" ? "buy" : "sell"
          }">
            ${escapeHTML(item.position)}
          </span>
        </div>

        <div class="event-meta">
          <span>
            Event time:
            <strong>${escapeHTML(item.event_time)}</strong>
          </span>
        </div>
      </article>
    `).join("");

  } catch (error) {
    console.error("Load events failed:", error);

    list.innerHTML =
      '<div class="empty">Could not load events. Check connection and database permissions.</div>';

    setMessage(
      "feedMessage",
      `${error.message || "Network request failed."} Check F12 → Console for details.`,
      true
    );
  }
}

/* ---------- Publish event ---------- */

$("eventForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (role !== "admin") {
    setMessage("publishMessage", "Admin panel required.", true);
    return;
  }

  const who = $("who").value.trim();

  const pair = $("pair").value === "OTHER"
    ? $("customPair").value.trim().toUpperCase()
    : $("pair").value;

  const position = $("position").value;
  const eventTime =
    $("eventTime").value.trim() || "Anytime";

  if (!who || !pair) {
    setMessage(
      "publishMessage",
      "Please complete the name and pair fields.",
      true
    );
    return;
  }

  const button = event.submitter;
  button.disabled = true;
  button.textContent = "Publishing...";

  try {
    const { error } = await db
      .from("events")
      .insert({
        who: who,
        pair: pair,
        position: position,
        event_time: eventTime
      });

    if (error) throw error;

    setMessage(
      "publishMessage",
      "Event published successfully!"
    );

    $("eventForm").reset();
    $("timePreset").value = "default";
    $("eventTime").value = "7 minutes";
    $("customPairWrap").classList.add("hidden");

    await loadEvents();

  } catch (error) {
    console.error("Publish event failed:", error);

    let message = error.message ||
      "Could not reach Supabase.";

    if (error.code === "42501") {
      message =
        "Database permission denied. Check your INSERT policy.";
    } else if (error.code === "42P01") {
      message =
        "Events table not found. Check the table name.";
    } else if (
      error instanceof TypeError ||
      /failed to fetch|network/i.test(message)
    ) {
      message =
        "Network request failed. Check the Supabase URL, publishable key, internet connection, and browser Console.";
    }

    setMessage("publishMessage", message, true);

  } finally {
    button.disabled = false;
    button.textContent = "Confirm & publish";
  }
});
