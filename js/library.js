// Biblioteca de partidas terminadas, guardadas en localStorage.
// Cada registro guarda el árbol serializado para poder reabrir la partida en
// modo revisión (con variantes, clasificaciones y evaluaciones intactas).

const KEY = 'entrenador-ajedrez-biblioteca';
const MAX = 50;

export function listGames() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}

function persist(arr) {
  try { localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX))); } catch (_) {}
}

export function addGame(record) {
  const arr = listGames();
  record.id = record.id || (Date.now() + '-' + Math.random().toString(36).slice(2, 7));
  arr.unshift(record);
  persist(arr);
  return record.id;
}

export function deleteGame(id) {
  persist(listGames().filter((g) => g.id !== id));
}

const COLOR_LABEL = { w: 'Blancas', b: 'Negras' };

// Renderiza la lista dentro de `host`. onLoad(record) y onDelete(id) son callbacks.
export function renderLibrary(host, { onLoad, onDelete }) {
  const games = listGames();
  host.innerHTML = '';
  if (!games.length) {
    host.innerHTML = '<div class="lib-empty">Aún no hay partidas guardadas.<br>Al terminar una partida se archiva aquí automáticamente.</div>';
    return;
  }
  for (const g of games) {
    const row = document.createElement('div');
    row.className = 'lib-row';

    const info = document.createElement('div');
    info.className = 'lib-info';
    const d = new Date(g.date);
    const fecha = isNaN(d) ? '' : d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    info.innerHTML =
      `<div class="lib-title">${g.result || 'Partida'}</div>` +
      `<div class="lib-meta">${COLOR_LABEL[g.myColor] || ''} · rival ${g.rivalElo} Elo · ${g.plies || 0} jugadas · ${fecha}</div>`;

    const acc = document.createElement('div');
    acc.className = 'lib-acc';
    acc.textContent = (g.accuracy != null ? g.accuracy.toFixed(0) : '—') + '%';

    const actions = document.createElement('div');
    actions.className = 'lib-actions';
    const load = document.createElement('button');
    load.className = 'btn';
    load.textContent = 'Abrir';
    load.addEventListener('click', () => onLoad(g));
    const del = document.createElement('button');
    del.className = 'lib-del';
    del.textContent = '🗑';
    del.title = 'Borrar';
    del.addEventListener('click', () => { onDelete(g.id); renderLibrary(host, { onLoad, onDelete }); });
    actions.appendChild(load);
    actions.appendChild(del);

    row.appendChild(info);
    row.appendChild(acc);
    row.appendChild(actions);
    host.appendChild(row);
  }
}
