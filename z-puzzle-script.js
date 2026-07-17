(function () {
  "use strict";

  const svgNS = "http://www.w3.org/2000/svg";

  // ---------- レイアウト定数 ----------
  const SMALL = 100;   // 小さい正方形の一辺
  const STEP = SMALL;  // 正方形どうしを隙間なく密接させる
  const BIG = 240;     // 大きい正方形の一辺
  const ROW_Y = 320;   // 小さい正方形の上端Y座標
  const BRIDGE_Y = ROW_Y - 15;           // 上側の短い配線の通り道 (305)
  const LEFT_PAD = 60; // 一番左の配線(❷⑥-❸①)を回り込ませるための余白

  const ROW_WIDTH = STEP * 7; // 7個の正方形全体の幅
  const BIG_X = LEFT_PAD + (ROW_WIDTH - BIG) / 2;
  const BIG_Y = 0;

  function sqX(i) {
    return LEFT_PAD + i * STEP;
  }

  // 正方形1つにつき8つの接続点（画像の①〜⑧に対応）
  // 1:上左 2:上右 3:右上 4:右下 5:下右 6:下左 7:左下 8:左上
  function portPos(x, y, size, portNum) {
    const map = {
      1: [0.35, 0],
      2: [0.65, 0],
      3: [1, 0.35],
      4: [1, 0.65],
      5: [0.65, 1],
      6: [0.35, 1],
      7: [0, 0.65],
      8: [0, 0.35]
    };
    const [ux, uy] = map[portNum];
    return { x: x + ux * size, y: y + uy * size };
  }

  function smallPort(i, portNum) {
    return portPos(sqX(i), ROW_Y, SMALL, portNum);
  }

  // ---------- パネルの7状態 ----------
  // ports: このパネルが内部でつなぐ接続点のペア一覧（ループ判定用）
  // segments: 見た目の線（0〜1の正規化座標。実際の描画時にサイズを掛ける）
  const P = {
    1: [0.35, 0], 2: [0.65, 0],
    3: [1, 0.35], 4: [1, 0.65],
    5: [0.65, 1], 6: [0.35, 1],
    7: [0, 0.65], 8: [0, 0.35]
  };

  const STATE_SHAPES = [
    {
      label: "L",
      ports: [[1, 4]],
      segments: [[P[1], [0.35, 0.65], P[4]]]
    },
    {
      label: null,
      ports: [[3, 8], [5, 7]],
      segments: [
        [P[3], [0.5, 0.2], P[8]],
        [P[5], [0.5, 0.8], P[7]]
      ]
    },
    {
      label: "C",
      ports: [[3, 4]],
      segments: [[P[3], [0.6, 0.35], [0.6, 0.65], P[4]]]
    },
    {
      label: null,
      ports: [[5, 7], [7, 8]],
      segments: [
        [P[8], [0.3, 0.55]],
        [P[7], [0.3, 0.65], [0.3, 0.55]],
        [P[5], [0.5, 0.7], [0.3, 0.55]]
      ]
    },
    {
      label: "Z",
      ports: [[4, 8]],
      segments: [[P[4], [0.25, 0.65], [0.75, 0.35], P[8]]]
    },
    {
      label: "E",
      ports: [[3, 4]],
      segments: [
        [P[3], [0.45, 0.35], [0.45, 0.65], P[4]],
        [[0.45, 0.5], [0.65, 0.5]]
      ]
    },
    {
      label: "A",
      ports: [[5, 6]],
      segments: [
        [P[6], [0.5, 0.6], P[5]],
        [[0.42, 0.8], [0.58, 0.8]]
      ]
    }
  ];
  const STATE_COUNT = STATE_SHAPES.length; // 7

  // 左から数えて 1,3,5,7 番目(0-indexで 0,2,4,6)が「赤枠で中が見えない」ボタン
  const HIDDEN_INDICES = new Set([0, 2, 4, 6]);

  // クリア条件：❶→C, ❸→L, ❺→E, ❼→A, 大きい正方形→Z
  const REQUIRED = {
    0: "C",
    2: "L",
    4: "E",
    6: "A"
  };
  const REQUIRED_BIG_LABEL = "Z";

  // ---------- 状態 ----------
  function randomizeAll() {
    for (let i = 0; i < 7; i++) {
      smallState[i] = Math.floor(Math.random() * STATE_COUNT);
    }
    bigState = Math.floor(Math.random() * STATE_COUNT);
  }

  function isClearState() {
    for (const idxStr in REQUIRED) {
      const idx = Number(idxStr);
      if (STATE_SHAPES[smallState[idx]].label !== REQUIRED[idxStr]) {
        return false;
      }
    }
    return STATE_SHAPES[bigState].label === REQUIRED_BIG_LABEL;
  }

  const smallState = [];
  let bigState = 0;
  randomizeAll();
  // 初期状態でうっかりクリア条件を満たしてしまわないよう再抽選する
  while (isClearState()) {
    randomizeAll();
  }

  // ---------- DOM構築 ----------
  const board = document.getElementById("board");
  const BOARD_W = ROW_WIDTH + LEFT_PAD + 190;
  const BOARD_H = ROW_Y + SMALL + 65 + 40;
  board.style.width = BOARD_W + "px";
  board.style.height = BOARD_H + "px";

  const wiresSvg = document.createElementNS(svgNS, "svg");
  wiresSvg.classList.add("wires-svg");
  wiresSvg.setAttribute("viewBox", "0 0 " + BOARD_W + " " + BOARD_H);
  board.appendChild(wiresSvg);

  // ---------- 背景の配線(4本、指定された接続点どうしを結ぶ) ----------
  function pointsToD(points) {
    return "M" + points.map((p) => p.x + "," + p.y).join(" L");
  }

  const s1p6 = smallPort(1, 6);
  const s2p1 = smallPort(2, 1);
  const s1p5 = smallPort(1, 5);
  const s3p5 = smallPort(3, 5);
  const s3p1 = smallPort(3, 1);
  const s6p5 = smallPort(6, 5);
  const s6p6 = smallPort(6, 6);
  const s4p5 = smallPort(4, 5);

  const leftMarginX = LEFT_PAD / 2; // 一番左を回り込む配線が通るX座標
  const rightOfRowX = sqX(6) + SMALL + 40;   // ❼の右側の余白

  // 4本の配線が互いに重ならないよう、それぞれ専用の高さ(コリドー)を通す
  const DEPTH_1 = ROW_Y + SMALL + 20; // 440 (❷⑥-❸①用、浅め)
  const DEPTH_2 = ROW_Y + SMALL + 35; // 455 (❷⑤-❹⑤用)
  const DEPTH_4 = ROW_Y + SMALL + 50; // 470 (❺⑤-❼⑥用)
  const DEPTH_3 = ROW_Y + SMALL + 65; // 485 (❹①-❼⑤用、一番深い)

  const staticWireDefs = [
    // ❷の⑥ と ❸の① をつなぐ配線：他の配線と交わらないよう、一番左を大きく回り込む
    [
      s1p6,
      { x: s1p6.x, y: DEPTH_1 },
      { x: leftMarginX, y: DEPTH_1 },
      { x: leftMarginX, y: BRIDGE_Y },
      { x: s2p1.x, y: BRIDGE_Y },
      s2p1
    ],
    // ❷の⑤ と ❹の⑤ をつなぐ配線
    [
      s1p5,
      { x: s1p5.x, y: DEPTH_2 },
      { x: s3p5.x, y: DEPTH_2 },
      s3p5
    ],
    // ❹の① と ❼の⑤ をつなぐ配線
    [
      s3p1,
      { x: s3p1.x, y: BRIDGE_Y },
      { x: rightOfRowX, y: BRIDGE_Y },
      { x: rightOfRowX, y: DEPTH_3 },
      { x: s6p5.x, y: DEPTH_3 },
      s6p5
    ],
    // ❺の⑤ と ❼の⑥ をつなぐ配線
    [
      s4p5,
      { x: s4p5.x, y: DEPTH_4 },
      { x: s6p6.x, y: DEPTH_4 },
      s6p6
    ]
  ];

  const staticWireEls = staticWireDefs.map((points) => {
    const p = document.createElementNS(svgNS, "path");
    p.setAttribute("d", pointsToD(points));
    wiresSvg.appendChild(p);
    return p;
  });

  // ---------- 小さい正方形ボタン ----------
  const smallBtnEls = [];
  const smallSvgEls = [];
  for (let i = 0; i < 7; i++) {
    const btn = document.createElement("button");
    btn.className = "panel-btn";
    btn.style.left = sqX(i) + "px";
    btn.style.top = ROW_Y + "px";
    btn.style.width = SMALL + "px";
    btn.style.height = SMALL + "px";

    const isHidden = HIDDEN_INDICES.has(i);
    if (isHidden) btn.classList.add("hidden-btn");

    const svg = document.createElementNS(svgNS, "svg");
    svg.classList.add("panel-svg");
    svg.setAttribute("viewBox", "0 0 " + SMALL + " " + SMALL);
    btn.appendChild(svg);

    btn.addEventListener("click", () => {
      smallState[i] = (smallState[i] + 1) % STATE_COUNT;
      render();
    });

    board.appendChild(btn);
    smallBtnEls.push(btn);
    smallSvgEls.push(svg);
  }

  // ---------- 大きい正方形ボタン ----------
  const bigBtn = document.createElement("button");
  bigBtn.className = "panel-btn big-btn";
  bigBtn.style.left = BIG_X + "px";
  bigBtn.style.top = BIG_Y + "px";
  bigBtn.style.width = BIG + "px";
  bigBtn.style.height = BIG + "px";

  const bigSvg = document.createElementNS(svgNS, "svg");
  bigSvg.classList.add("panel-svg");
  bigSvg.setAttribute("viewBox", "0 0 " + BIG + " " + BIG);
  bigBtn.appendChild(bigSvg);

  bigBtn.addEventListener("click", () => {
    bigState = (bigState + 1) % STATE_COUNT;
    render();
  });

  board.appendChild(bigBtn);

  // ---------- 装飾用のRの角丸四角形(無関係の背景要素) ----------
  const decoR = document.createElement("div");
  decoR.className = "deco-r";
  decoR.textContent = "R";
  decoR.style.left = rightOfRowX + 30 + "px";
  decoR.style.top = ROW_Y + 5 + "px";
  decoR.style.width = "90px";
  decoR.style.height = "90px";
  decoR.style.fontSize = "48px";
  board.appendChild(decoR);

  // ---------- ブリッジ検出でループを構成する辺だけを特定する ----------
  // (橋=bridge でない辺は、必ず何らかの閉路の一部になっている、という定理を利用)
  function findNonBridgeEdges(nodes, edges) {
    const adj = {};
    nodes.forEach((n) => (adj[n] = []));
    edges.forEach(({ a, b }, idx) => {
      adj[a].push({ to: b, edgeIdx: idx });
      adj[b].push({ to: a, edgeIdx: idx });
    });

    const disc = {};
    const low = {};
    const visited = {};
    let timer = 0;
    const isBridge = new Array(edges.length).fill(false);

    function dfs(u, parentEdgeIdx) {
      visited[u] = true;
      disc[u] = low[u] = timer++;
      for (const { to, edgeIdx } of adj[u]) {
        if (edgeIdx === parentEdgeIdx) continue;
        if (!visited[to]) {
          dfs(to, edgeIdx);
          low[u] = Math.min(low[u], low[to]);
          if (low[to] > disc[u]) {
            isBridge[edgeIdx] = true;
          }
        } else {
          low[u] = Math.min(low[u], disc[to]);
        }
      }
    }

    nodes.forEach((n) => {
      if (!visited[n]) dfs(n, -1);
    });

    return edges.map((_, idx) => !isBridge[idx]);
  }

  function computeLoop() {
    const nodes = [];
    for (let i = 0; i < 7; i++) {
      for (let p = 1; p <= 8; p++) nodes.push("s" + i + "_" + p);
    }
    for (let p = 1; p <= 8; p++) nodes.push("big_" + p);

    // 各辺に「どの見た目の要素に対応するか」を持たせておく
    const edges = [];

    const staticPairs = [
      ["s1_6", "s2_1"],
      ["s1_5", "s3_5"],
      ["s3_1", "s6_5"],
      ["s4_5", "s6_6"]
    ];
    staticPairs.forEach(([a, b], wireIdx) => {
      edges.push({ a, b, kind: "static", wireIdx });
    });

    // 隣り合う正方形どうしの自動接触(③↔隣の⑧、④↔隣の⑦)
    for (let i = 0; i < 6; i++) {
      edges.push({ a: "s" + i + "_3", b: "s" + (i + 1) + "_8", kind: "touch" });
      edges.push({ a: "s" + i + "_4", b: "s" + (i + 1) + "_7", kind: "touch" });
    }

    // 各パネル内部の接続
    for (let i = 0; i < 7; i++) {
      STATE_SHAPES[smallState[i]].ports.forEach(([a, b]) => {
        edges.push({
          a: "s" + i + "_" + a,
          b: "s" + i + "_" + b,
          kind: "panel",
          sq: i
        });
      });
    }
    STATE_SHAPES[bigState].ports.forEach(([a, b]) => {
      edges.push({ a: "big_" + a, b: "big_" + b, kind: "panel", sq: "big" });
    });

    const active = findNonBridgeEdges(nodes, edges);

    const staticActive = [false, false, false, false];
    const smallActive = [false, false, false, false, false, false, false];
    let bigActive = false;

    edges.forEach((e, idx) => {
      if (!active[idx]) return;
      if (e.kind === "static") staticActive[e.wireIdx] = true;
      if (e.kind === "panel") {
        if (e.sq === "big") bigActive = true;
        else smallActive[e.sq] = true;
      }
    });

    return { staticActive, smallActive, bigActive };
  }

  // ---------- 描画 ----------
  const clearImg = document.getElementById("clear-img");

  function renderPanelSvg(svgEl, state, size, active) {
    svgEl.innerHTML = "";
    const shape = STATE_SHAPES[state];
    const strokeWidth = size * 0.06;
    shape.segments.forEach((seg) => {
      const p = document.createElementNS(svgNS, "path");
      p.setAttribute(
        "d",
        "M" + seg.map(([x, y]) => x * size + "," + y * size).join(" L")
      );
      p.setAttribute("stroke-width", strokeWidth);
      if (active) p.classList.add("loop-active");
      svgEl.appendChild(p);
    });
  }

  function checkClear() {
    for (const idxStr in REQUIRED) {
      const idx = Number(idxStr);
      if (STATE_SHAPES[smallState[idx]].label !== REQUIRED[idxStr]) {
        return false;
      }
    }
    if (STATE_SHAPES[bigState].label !== REQUIRED_BIG_LABEL) return false;
    return true;
  }

  function render() {
    const { staticActive, smallActive, bigActive } = computeLoop();

    staticWireEls.forEach((el, idx) => {
      el.classList.toggle("loop-active", staticActive[idx]);
    });

    for (let i = 0; i < 7; i++) {
      // 赤枠(隠れている)ボタンは見た目上は常に真っ黒のまま。
      // 内部の状態は保持しているが、パネルの絵は描画しない。
      if (HIDDEN_INDICES.has(i)) {
        smallSvgEls[i].innerHTML = "";
      } else {
        renderPanelSvg(smallSvgEls[i], smallState[i], SMALL, smallActive[i]);
      }
    }
    renderPanelSvg(bigSvg, bigState, BIG, bigActive);

    if (checkClear()) {
      clearImg.classList.add("show");
    } else {
      clearImg.classList.remove("show");
    }
  }

  render();
})();
