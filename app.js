const TYPES = {
  protege: "Protege",
  entradas: "Entradas",
  saidas: "Sa\u00eddas",
};
const STORAGE_KEY = "fechamento-app-v2";

const state = {
  activeType: "protege",
  today: todayLocal(),
  entries: loadEntries(),
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const amountInput = document.querySelector("#amountInput");
const noteInput = document.querySelector("#noteInput");
const form = document.querySelector("#entryForm");
const toast = document.querySelector("#toast");

purgeOldEntries();

document.querySelectorAll(".category-tab").forEach((button) => {
  button.addEventListener("click", () => {
    refreshDayIfNeeded();
    state.activeType = button.dataset.type;
    render();
    amountInput.focus();
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  refreshDayIfNeeded();
  const amount = parseAmount(amountInput.value);

  if (!amount || amount <= 0) {
    showToast("Digite um valor v\u00e1lido.");
    amountInput.focus();
    return;
  }

  state.entries.unshift({
    id: crypto.randomUUID(),
    type: state.activeType,
    amount,
    note: noteInput.value.trim(),
    date: state.today,
    createdAt: new Date().toISOString(),
  });

  saveEntries();
  amountInput.value = "";
  noteInput.value = "";
  render();
  showToast("Lan\u00e7amento feito.");
  amountInput.focus();
});

document.querySelector("#historyList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  refreshDayIfNeeded();

  state.entries = state.entries.filter((entry) => entry.id !== button.dataset.delete);
  saveEntries();
  render();
  showToast("Lan\u00e7amento apagado.");
});

document.querySelector("#clearDayButton").addEventListener("click", () => {
  refreshDayIfNeeded();
  const entries = entriesForActiveTab();
  if (!entries.length) {
    showToast("Esta aba j\u00e1 est\u00e1 vazia.");
    return;
  }

  const ok = confirm(`Limpar ${entries.length} lan\u00e7amento(s) de ${TYPES[state.activeType]} de hoje?`);
  if (!ok) return;

  const ids = new Set(entries.map((entry) => entry.id));
  state.entries = state.entries.filter((entry) => !ids.has(entry.id));
  saveEntries();
  render();
  showToast("Aba limpa.");
});

amountInput.addEventListener("blur", () => {
  const value = parseAmount(amountInput.value);
  amountInput.value = value ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "";
});

amountInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;

  event.preventDefault();
  form.requestSubmit();
});

window.addEventListener("focus", () => {
  if (refreshDayIfNeeded()) render();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && refreshDayIfNeeded()) render();
});

function entriesForSelectedDate() {
  return state.entries.filter((entry) => entry.date === state.today);
}

function entriesForActiveTab() {
  return entriesForSelectedDate().filter((entry) => entry.type === state.activeType);
}

function totalsForSelectedDate() {
  return entriesForSelectedDate().reduce(
    (totals, entry) => {
      totals[entry.type] += entry.amount;
      return totals;
    },
    { protege: 0, entradas: 0, saidas: 0 },
  );
}

function render() {
  const totals = totalsForSelectedDate();
  const counts = countsForSelectedDate();

  document.querySelectorAll(".category-tab").forEach((button) => {
    const type = button.dataset.type;
    const isActive = type === state.activeType;
    button.classList.toggle("is-active", isActive);
    button.innerHTML = `
      <span class="tab-label">${TYPES[type]}</span>
      <span class="tab-meta">${counts[type]} - ${currency.format(totals[type])}</span>
    `;
    button.setAttribute("aria-pressed", String(isActive));
  });

  const activeLabel = TYPES[state.activeType];
  document.querySelector("#amountLabel").textContent = `Valor em ${activeLabel}`;
  document.querySelector("#historyTitle").textContent = `${activeLabel} de hoje`;

  const finalTotal = totals.entradas + totals.protege - totals.saidas;
  document.querySelector("#finalTotal").textContent = currency.format(finalTotal);

  const list = document.querySelector("#historyList");
  const entries = entriesForActiveTab();
  if (!entries.length) {
    list.innerHTML = `<div class="empty-state">Nenhum lan\u00e7amento em ${activeLabel} neste dia.</div>`;
    return;
  }

  list.innerHTML = entries
    .map((entry) => {
      const isNegative = entry.type === "saidas";
      const sign = isNegative ? "-" : "+";
      const note = entry.note ? ` - ${escapeHtml(entry.note)}` : "";
      const time = formatTime(entry.createdAt);
      return `
        <article class="history-item">
          <div class="history-main">
            <strong>${time}</strong>
            <span>${activeLabel}${note}</span>
          </div>
          <div>
            <div class="history-value ${isNegative ? "is-negative" : ""}">${sign}${currency.format(entry.amount)}</div>
            <button class="text-button" type="button" data-delete="${entry.id}" aria-label="Apagar lan\u00e7amento">Apagar</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function countsForSelectedDate() {
  return entriesForSelectedDate().reduce(
    (counts, entry) => {
      counts[entry.type] += 1;
      return counts;
    },
    { protege: 0, entradas: 0, saidas: 0 },
  );
}

function parseAmount(value) {
  if (!value) return 0;
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(normalized);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function loadEntries() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(current) ? current : [];
  } catch {
    return [];
  }
}

function todayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function purgeOldEntries() {
  const todaysEntries = state.entries.filter((entry) => entry.date === state.today);
  if (todaysEntries.length === state.entries.length) return;

  state.entries = todaysEntries;
  saveEntries();
}

function refreshDayIfNeeded() {
  const today = todayLocal();
  if (today === state.today) return false;

  state.today = today;
  state.entries = [];
  saveEntries();
  showToast("Novo dia iniciado.");
  return true;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

render();
