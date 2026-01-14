(() => {
  const $ = (id) => document.getElementById(id);

  const SCREENS = [
    "s_home","s_host","s_players","s_hostConfirm","s_prompt","s_pass","s_answer","s_return","s_judge","s_reveal","s_over"
  ];
  const show = (id) => {
    for (const s of SCREENS) $(s).classList.remove("active");
    $(id).classList.add("active");
    state.ui.screen = id;
    saveState();
    renderTopbar();
  };

  const toastEl = $("toast");
  let toastTimer = null;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
  };

  const STORAGE_KEY = "PQP_HOTSEAT_V1";

  const newState = () => ({
    ui: { screen: "s_home" },
    config: {
      goalPoints: 5,
      round: 1,
    },
    players: [],             // array of names
    hostIndex: 0,            // index in players[]
    prompt: "",              // current prompt with ellipses
    blanks: 1,               // 1 or 2
    turnOrder: [],           // array of player indices (excluding host)
    turnPos: 0,              // current position in turnOrder
    answers: [],             // array of {playerIndex, answers:[...], composedText, anonId}
    judge: {
      pool: [],              // array of {anonId, composedText}
      selectedAnonId: null,
      winnerIndex: null
    },
    scores: {}               // map name -> points
  });

  let state = newState();

  const saveState = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  };

  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && typeof s === "object" ? s : null;
    } catch (e) {
      return null;
    }
  };

  const resetAll = () => {
    state = newState();
    try { localStorage.removeItem(STORAGE_KEY); } catch(e){}
    renderTopbar();
    show("s_home");
    toast("Resetado.");
  };

  // Utils
  const cleanName = (v) => (v || "").trim().replace(/\s+/g," ");
  const clampInt = (v, def=5, min=1, max=99) => {
    const n = parseInt(String(v||"").replace(/[^\d]/g,""),10);
    if (!Number.isFinite(n)) return def;
    return Math.max(min, Math.min(max, n));
  };
  const countBlanks = (text) => {
    const m = (text || "").match(/\.\.\./g);
    const c = m ? m.length : 0;
    if (c <= 1) return 1;
    if (c === 2) return 2;
    return 3; // maximum 3
  };
  const needsSpaceBefore = (text) => {
    if (!text) return false;
    const ch = text[text.length-1];
    return !(/[\s\n\r\t]/.test(ch) || ch === "(" || ch === "[" || ch === "{" || ch === "“" || ch === "\"" || ch === "—" );
  };
  const insertAnswer = (left, ans) => {
    const a = String(ans ?? "");
    if (!a) return "";
    return (needsSpaceBefore(left) ? " " : "") + a;
  };

  const compose = (prompt, answers) => {
    // Replace up to 2 occurrences of "..." with answers
    let out = String(prompt || "");
    for (let i=0;i<answers.length;i++){
      out = out.replace("...", answers[i] ?? "");
    }
    return out;
  };

  const formatComposeHTML = (prompt, answers) => {
    const p = String(prompt || "");
    const parts = p.split("...");
    const max = Math.min(answers.length, parts.length - 1);
    let out = escapeHtml(parts[0] ?? "");
    for (let i = 0; i < max; i++) {
      out += (needsSpaceBefore(out) ? " " : "") + "<b>" + escapeHtml(answers[i] ?? "") + "</b>";
      out += escapeHtml(parts[i + 1] ?? "");
    }
    // If there are leftover prompt parts, re-join with "..." visibly
    for (let j = max + 1; j < parts.length; j++) {
      out += "..." + escapeHtml(parts[j] ?? "");
    }
    return out;
  };

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  };
  const shortScoreLine = () => {
    const entries = state.players.map(n => ({name:n, score: state.scores[n] ?? 0}));
    entries.sort((a,b)=> b.score - a.score || a.name.localeCompare(b.name));
    const top = entries.slice(0,3).map(e => `${e.name} ${e.score}`);
    const rest = entries.length > 3 ? ` +${entries.length-3}` : "";
    return entries.length ? (top.join(" • ") + rest) : "Placar";
  };

  const ensureScores = () => {
    for (const n of state.players) {
      if (state.scores[n] == null) state.scores[n] = 0;
    }
  };

  const currentHostName = () => state.players[state.hostIndex] ?? "—";
  const roundLabel = () => `R${state.config.round}`;

  // Topbar / Score modal
  const scoreModal = $("scoreModal");
  const openScore = () => {
    renderScoreModal();
    scoreModal.classList.add("show");
  };
  const closeScore = () => scoreModal.classList.remove("show");

  const renderScoreModal = () => {
    const rankList = $("rankList");
    const meta = $("scoreMeta");
    const goal = state.config.goalPoints || 0;
    meta.textContent = state.players.length
      ? `Meta: ${goal} ponto(s) • Rodada: ${state.config.round} • Anfitrião: ${currentHostName()}`
      : "Sem partida ativa.";
    rankList.innerHTML = "";
    const entries = state.players.map(n => ({name:n, score: state.scores[n] ?? 0}));
    entries.sort((a,b)=> b.score - a.score || a.name.localeCompare(b.name));
    const leaderScore = entries[0]?.score ?? 0;
    entries.forEach((e, idx) => {
      const div = document.createElement("div");
      div.className = "rankItem" + ((e.score === leaderScore && leaderScore>0) ? " leader" : "");
      div.innerHTML = `
        <div class="left">
          <div class="pos">${idx+1}</div>
          <div class="nm">${escapeHtml(e.name)}</div>
        </div>
        <div class="sc">${e.score}</div>
      `;
      rankList.appendChild(div);
    });
  };

  const renderTopbar = () => {
    $("scoreMiniText").textContent = state.players.length ? shortScoreLine() : "Placar";
    $("scoreMiniGoal").textContent = state.players.length ? `meta ${state.config.goalPoints}` : "";
  };

  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");

  // Screens render
  const renderPlayers = () => {
    $("hostPreview").textContent = currentHostName() === "—" ? (state.players[0] ?? "—") : currentHostName();
    $("playersCount").textContent = String(state.players.length);
    const ul = $("playersList");
    ul.innerHTML = "";
    state.players.forEach((name, idx) => {
      const li = document.createElement("li");
      li.className = "chip";
      const hostMark = idx === state.hostIndex ? " <b>(HOST)</b>" : "";
      const sc = state.scores[name] ?? 0;
      li.innerHTML = `${escapeHtml(name)} <small style="opacity:.8">(${sc})</small>${hostMark}`;
      ul.appendChild(li);
    });
    renderTopbar();
  };

  const buildTurnOrder = () => {
    const idxs = state.players.map((_,i)=>i).filter(i=> i !== state.hostIndex);
    state.turnOrder = idxs;
    state.turnPos = 0;
  };

  const setPrompt = (text) => {
    const t = String(text || "").trim();
    state.prompt = t;
    state.blanks = countBlanks(t);
  };

  const renderPromptHints = () => {
    const b = state.blanks;
    $("blankHint").textContent =
      b === 1
      ? "Detectado: 1 lacuna (…). Cada jogador terá 1 campo. Máximo: 3 lacunas."
      : (b === 2
        ? "Detectado: 2 lacunas (…). Cada jogador terá 2 campos (Resposta 1 e 2). Máximo: 3 lacunas."
        : "Detectado: 3 lacunas (…). Cada jogador terá 3 campos (Resposta 1, 2 e 3). Máximo: 3 lacunas.");
  };

  const renderPass = () => {
    const idx = state.turnOrder[state.turnPos];
    const name = state.players[idx] ?? "—";
    $("passToName").textContent = name;
    $("passHint").textContent = `Quando ${name} estiver com o celular, clique no botão.`;
    $("passBadge").textContent = `Passe o celular • ${roundLabel()}`;
    // Back button: only if already in round and want to go back
    $("btnPassBack").classList.toggle("btn-disabled", state.turnPos === 0);
  };

  const renderAnswerScreen = () => {
    const idx = state.turnOrder[state.turnPos];
    const playerName = state.players[idx] ?? "—";
    $("playerTurnName").textContent = playerName;
    $("blackBody").textContent = state.prompt || "—";
    $("hostSmall").textContent = `Anfitrião: ${currentHostName()}`;
    $("roundSmall").textContent = roundLabel();

    const container = $("answerFields");
    container.innerHTML = "";
    const b = state.blanks;
    for (let i=0;i<b;i++){
      const lab = document.createElement("label");
      lab.textContent = b === 1 ? "Sua resposta" : `Resposta ${i+1}`;
      lab.setAttribute("for", `ans_${i}`);
      const ta = document.createElement("textarea");
      ta.id = `ans_${i}`;
      ta.placeholder = b === 1 ? "Digite sua resposta..." : `Digite a resposta ${i+1}...`;
      ta.autocomplete = "off";
      container.appendChild(lab);
      container.appendChild(ta);
    }
  };

  const renderReturnHost = () => {
    $("returnHostLine").textContent = `ANFITRIÃO: ${currentHostName()}`;
  };

  const renderJudge = () => {
    $("judgePrompt").textContent = state.prompt || "—";
    $("judgeHost").textContent = `Anfitrião: ${currentHostName()}`;
    $("judgeHostName").textContent = currentHostName();
    $("judgeRound").textContent = roundLabel();
    const grid = $("answersGrid");
    grid.innerHTML = "";

    state.judge.selectedAnonId = null;
    $("btnWhoWas").classList.add("btn-disabled");

    state.judge.pool.forEach((item) => {
      const div = document.createElement("div");
      div.className = "answerCard";
      div.dataset.anon = item.anonId;
      const found = state.answers.find(a => a.anonId === item.anonId);
      const htmlLine = found ? formatComposeHTML(state.prompt, found.answers) : escapeHtml(item.composedText);
      div.innerHTML = `
        <div class="t">${htmlLine}</div>
        <div class="s">toque para escolher</div>
      `;
      div.addEventListener("click", () => {
        [...grid.children].forEach(c => c.classList.remove("selected"));
        div.classList.add("selected");
        state.judge.selectedAnonId = item.anonId;
        $("btnWhoWas").classList.remove("btn-disabled");
        saveState();
      });
      grid.appendChild(div);
    });
  };

  const renderReveal = () => {
    const wIdx = state.judge.winnerIndex;
    const wName = state.players[wIdx] ?? "—";
    $("winnerLine").textContent = `FOI O(A): ${wName}`;
    $("winnerHint").textContent = `+1 ponto para ${wName}.`;
    $("nextHostLine").textContent = `Novo anfitrião: ${wName}`;
  };

  const renderHostConfirm = () => {
    $("hostConfirmName").textContent = `ANFITRIÃO: ${currentHostName()}`;
  };

  const renderPromptScreen = () => {
    $("promptHostName").textContent = `ANFITRIÃO: ${currentHostName()}`;
    $("badgeRound").textContent = `Rodada ${state.config.round}`;
    $("promptText").value = state.prompt || "";
    renderPromptHints();
  };

  const renderGameOver = () => {
    const entries = state.players.map(n => ({name:n, score: state.scores[n] ?? 0}));
    entries.sort((a,b)=> b.score - a.score || a.name.localeCompare(b.name));
    const champ = entries[0]?.name ?? "—";
    $("champLine").textContent = `CAMPEÃO: ${champ}`;
    $("overHint").textContent = `Meta: ${state.config.goalPoints} • Rodadas: ${state.config.round-1}`;
  };

  // Flow actions
  const startNew = () => {
    state = newState();
    saveState();
    renderTopbar();
    $("hostName").value = "";
    show("s_host");
  };

  const continueGame = () => {
    const loaded = loadState();
    if (!loaded || !loaded.players) {
      toast("Nada para continuar.");
      return;
    }
    state = loaded;
    ensureScores();
    renderTopbar();
    // route to screen + re-render essentials
    routeTo(state.ui.screen || "s_home");
    toast("Continuando…");
  };

  const routeTo = (screenId) => {
    // render before showing to keep UI consistent
    if (screenId === "s_players") renderPlayers();
    if (screenId === "s_hostConfirm") renderHostConfirm();
    if (screenId === "s_prompt") { state.blanks = countBlanks(state.prompt); renderPromptScreen(); }
    if (screenId === "s_pass") renderPass();
    if (screenId === "s_answer") renderAnswerScreen();
    if (screenId === "s_return") renderReturnHost();
    if (screenId === "s_judge") renderJudge();
    if (screenId === "s_reveal") renderReveal();
    if (screenId === "s_over") renderGameOver();
    show(screenId);
  };

  const beginRound = () => {
    state.answers = [];
    state.judge.pool = [];
    state.judge.selectedAnonId = null;
    state.judge.winnerIndex = null;
    buildTurnOrder();
    saveState();
  };

  const submitPlayerAnswer = () => {
    const idx = state.turnOrder[state.turnPos];
    const fields = [];
    for (let i=0;i<state.blanks;i++){
      const v = (document.getElementById(`ans_${i}`)?.value || "").trim();
      fields.push(v);
    }
    if (fields.some(v => v.length === 0)) {
      toast("Preencha sua resposta.");
      return false;
    }
    const composedText = compose(state.prompt, fields);
    const anonId = cryptoSafeId();
    state.answers.push({playerIndex: idx, answers: fields, composedText, anonId});
    saveState();
    return true;
  };

  const cryptoSafeId = () => {
    // short random id
    const a = new Uint8Array(8);
    (crypto?.getRandomValues ? crypto.getRandomValues(a) : a.forEach((_,i)=>a[i]=Math.floor(Math.random()*256)));
    return [...a].map(x=>x.toString(16).padStart(2,"0")).join("");
  };

  const advanceTurn = () => {
    state.turnPos++;
    saveState();
    if (state.turnPos >= state.turnOrder.length) {
      // done
      renderReturnHost();
      show("s_return");
      return;
    }
    renderPass();
    show("s_pass");
  };

  const prepareJudgePool = () => {
    // pool is anonymous and shuffled
    const pool = state.answers.map(a => ({anonId: a.anonId, composedText: a.composedText}));
    state.judge.pool = shuffle(pool);
    state.judge.selectedAnonId = null;
    saveState();
  };

  const resolveWinner = () => {
    const sel = state.judge.selectedAnonId;
    if (!sel) return false;
    const found = state.answers.find(a => a.anonId === sel);
    if (!found) return false;
    const wIdx = found.playerIndex;
    state.judge.winnerIndex = wIdx;
    const wName = state.players[wIdx];
    state.scores[wName] = (state.scores[wName] ?? 0) + 1;
    saveState();
    return true;
  };

  const applyWinnerAndNext = () => {
    const wIdx = state.judge.winnerIndex;
    if (wIdx == null) return;
    // check game over
    const wName = state.players[wIdx];
    const goal = state.config.goalPoints;
    if ((state.scores[wName] ?? 0) >= goal) {
      renderGameOver();
      show("s_over");
      return;
    }
    // winner becomes next host
    state.hostIndex = wIdx;
    state.config.round += 1;
    beginRound();
    renderHostConfirm();
    show("s_hostConfirm");
  };

  // Events
  $("btnNew").addEventListener("click", startNew);
  $("btnContinue").addEventListener("click", continueGame);
  $("btnResetAll").addEventListener("click", resetAll);

  $("btnHostBack").addEventListener("click", () => show("s_home"));
  $("btnHostOk").addEventListener("click", () => {
    const host = cleanName($("hostName").value);
    if (!host) { toast("Digite o nome."); return; }
    state.players = [host];
    state.hostIndex = 0;
    state.config.round = 1;
    state.prompt = "";
    state.turnOrder = [];
    state.turnPos = 0;
    state.answers = [];
    state.scores = {};
    ensureScores();
    saveState();
    $("playerName").value = "";
    $("goalPoints").value = "5";
    renderPlayers();
    show("s_players");
    toast("Anfitrião definido.");
  });

  $("btnPlayersReset").addEventListener("click", () => {
    if (!confirm("Resetar jogadores e recomeçar?")) return;
    const host = state.players[0] ?? "";
    state = newState();
    state.players = host ? [host] : [];
    state.hostIndex = 0;
    ensureScores();
    saveState();
    renderPlayers();
    toast("Jogadores resetados.");
  });

  $("btnAddPlayer").addEventListener("click", () => {
    const name = cleanName($("playerName").value);
    if (!name) { toast("Digite o nome do jogador."); return; }
    state.players.push(name);
    ensureScores();
    $("playerName").value = "";
    saveState();
    renderPlayers();
  });

  $("btnStartGame").addEventListener("click", () => {
    if (state.players.length < 3) { toast("Coloque pelo menos 3 pessoas (incluindo anfitrião)."); return; }
    state.config.goalPoints = clampInt($("goalPoints").value, 5, 1, 50);
    $("goalPoints").value = String(state.config.goalPoints);
    ensureScores();
    state.config.round = 1;
    state.hostIndex = 0;
    beginRound();
    renderHostConfirm();
    show("s_hostConfirm");
  });

  $("btnHostConfirmBack").addEventListener("click", () => {
    renderPlayers();
    show("s_players");
  });

  $("btnHostContinue").addEventListener("click", () => {
    state.prompt = "";
    state.blanks = 1;
    saveState();
    renderPromptScreen();
    show("s_prompt");
  });

  $("promptText").addEventListener("input", () => {
    setPrompt($("promptText").value);
    renderPromptHints();
    saveState();
  });

  $("btnPromptBack").addEventListener("click", () => {
    renderHostConfirm();
    show("s_hostConfirm");
  });

  $("btnPromptStart").addEventListener("click", () => {
    const text = ($("promptText").value || "").trim();
    if (!text) { toast("Escreva a frase."); return; }
    setPrompt(text);
    if (!text.includes("...")) {
      const ok = confirm("Sua frase não tem '...'. Quer adicionar uma lacuna no final automaticamente?");
      if (ok) {
        setPrompt(text + " ...");
        $("promptText").value = state.prompt;
      } else {
        toast("Adicione '...' para indicar a lacuna.");
        return;
      }
    }
    renderPromptHints();
    // prepare first player
    state.turnPos = 0;
    saveState();
    renderPass();
    show("s_pass");
  });

  $("btnPassBack").addEventListener("click", () => {
    if (state.turnPos <= 0) return;
    // go back to answer of previous player
    state.turnPos = Math.max(0, state.turnPos - 1);
    // also remove last answer if exists (since they are sequential)
    state.answers.pop();
    saveState();
    renderPass();
    show("s_pass");
    toast("Voltou um jogador.");
  });

  $("btnPassGo").addEventListener("click", () => {
    renderAnswerScreen();
    show("s_answer");
  });

  $("btnAnswerBack").addEventListener("click", () => {
    renderPass();
    show("s_pass");
  });

  $("btnAnswerSend").addEventListener("click", () => {
    if (!submitPlayerAnswer()) return;
    toast("Enviado. Passe o celular.");
    advanceTurn();
  });

  $("btnReturnHost").addEventListener("click", () => {
    prepareJudgePool();
    renderJudge();
    show("s_judge");
  });

  $("btnJudgeBack").addEventListener("click", () => {
    // allow host to return to "return" screen
    show("s_return");
  });

  $("btnWhoWas").addEventListener("click", () => {
    if ($("btnWhoWas").classList.contains("btn-disabled")) return;
    if (!resolveWinner()) { toast("Selecione uma resposta."); return; }
    renderReveal();
    show("s_reveal");
    renderTopbar();
  });

  $("btnNextRound").addEventListener("click", () => {
    applyWinnerAndNext();
  });

  $("btnEndGame").addEventListener("click", () => {
    if (!confirm("Encerrar e resetar a partida?")) return;
    resetAll();
  });

  $("btnPlayAgain").addEventListener("click", () => {
    // keep same players, reset scores and rounds
    const players = state.players.slice();
    state = newState();
    state.players = players;
    state.hostIndex = 0;
    state.config.goalPoints = clampInt(($("goalPoints").value || state.config.goalPoints), 5, 1, 50);
    state.config.round = 1;
    state.scores = {};
    ensureScores();
    beginRound();
    renderHostConfirm();
    show("s_hostConfirm");
  });

  $("btnOverReset").addEventListener("click", () => {
    if (!confirm("Resetar tudo?")) return;
    resetAll();
  });

  $("btnOverScore").addEventListener("click", openScore);
  $("btnViewScore2").addEventListener("click", openScore);
  $("btnCloseScore").addEventListener("click", closeScore);
  scoreModal.addEventListener("click", (e) => {
    if (e.target === scoreModal) closeScore();
  });
  $("scorePill").addEventListener("click", openScore);

  $("brandBtn").addEventListener("click", () => {
    // safe "home" only if confirmed
    if (state.players.length && !confirm("Voltar ao início? A partida fica salva, mas você pode se perder nas telas.")) return;
    show("s_home");
  });

  $("btnResetAll").addEventListener("click", () => {
    if (!confirm("Resetar tudo?")) return;
    resetAll();
  });

  $("btnResetAll").addEventListener("click", resetAll);

  // init
  const init = () => {
    renderTopbar();
    const loaded = loadState();
    if (loaded && loaded.players && loaded.players.length) {
      $("btnContinue").classList.remove("btn-disabled");
    }
    // register SW
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(()=>{});
    }
  };

  init();
})();