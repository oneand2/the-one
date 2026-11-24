/* ==========================================================================
   百年孤独 · 布恩迪亚家族图谱 — 交互主程序
   Pure Vanilla JS + SVG. No external dependencies, works directly via file://
   ========================================================================== */
(function () {
  "use strict";

  const DATA = window.FAMILY;
  if (!DATA || !Array.isArray(DATA.people)) {
    console.error("未能加载 window.FAMILY 数据，请检查 data.js 是否在同一目录。");
    return;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";

  /* ------------------------------------------------------------------------
     1. 几何与视觉常量
     ------------------------------------------------------------------------ */
  const R_MAIN = 33;
  const R_OUT = 24;

  const GEN_Y = {
    1: 108,
    2: 294,
    3: 482,
    4: 668,
    5: 874,
    6: 1054,
    7: 1216,
  };

  const GEN_NAMES_CN = ["", "第一代", "第二代", "第三代", "第四代", "第五代", "第六代", "第七代"];
  const GEN_ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"];

  // 精心排布的七代坐标：确保外人紧邻配偶/情人，同代关系零交叉，间距充足无文字重叠
  const MANUAL_POS = {
    // 第一代
    melq:     { x: 465,  y: GEN_Y[1] },
    jab:      { x: 665,  y: GEN_Y[1] },
    ursula:   { x: 865,  y: GEN_Y[1] },

    // 第二代（所有同代关系严格相邻！）
    amaranta: { x: 200,  y: GEN_Y[2] },
    pietro:   { x: 380,  y: GEN_Y[2] },
    rebeca:   { x: 560,  y: GEN_Y[2] },
    ja:       { x: 745,  y: GEN_Y[2] },
    pilar:    { x: 925,  y: GEN_Y[2] },
    col:      { x: 1110, y: GEN_Y[2] },
    remosc:   { x: 1295, y: GEN_Y[2] },

    // 第三代
    ss:       { x: 575,  y: GEN_Y[3] },
    arcadio:  { x: 770,  y: GEN_Y[3] },
    aj:       { x: 1005, y: GEN_Y[3] },
    a17:      { x: 1205, y: GEN_Y[3] },

    // 第四代（双胞胎并排，情人佩特拉紧邻，妻费尔南达紧邻）
    rb:       { x: 345,  y: GEN_Y[4] },
    petra:    { x: 535,  y: GEN_Y[4] },
    jas:      { x: 725,  y: GEN_Y[4] },
    as:       { x: 915,  y: GEN_Y[4] },
    fernanda: { x: 1110, y: GEN_Y[4] },

    // 第五代
    jap:      { x: 465,  y: GEN_Y[5] },
    mauricio: { x: 660,  y: GEN_Y[5] },
    meme:     { x: 855,  y: GEN_Y[5] },
    au:       { x: 1055, y: GEN_Y[5] },
    gaston:   { x: 1250, y: GEN_Y[5] },

    // 第六代
    ab:       { x: 815,  y: GEN_Y[6] },

    // 第七代
    baby:     { x: 935,  y: GEN_Y[7] },
  };

  const CANVAS_BOUNDS = {
    minX: 30,
    maxX: 1410,
    minY: 28,
    maxY: 1326,
  };

  const REL_COLORS = {
    parent:  "#6b4e34",
    spouse:  "#c08a22",
    lover:   "#a83228",
    twin:    "#7e4b74",
    adopted: "#366c63",
    friend:  "#47647e",
  };

  /* ------------------------------------------------------------------------
     2. 数据索引与关系推导
     ------------------------------------------------------------------------ */
  const peopleById = new Map();
  DATA.people.forEach((p) => peopleById.set(p.id, p));

  // 为所有人物确定坐标（兼容未在 MANUAL_POS 中的新增人物）
  const positions = new Map();
  const genAutoCounts = {};
  DATA.people.forEach((p) => {
    if (MANUAL_POS[p.id]) {
      positions.set(p.id, { ...MANUAL_POS[p.id] });
    } else {
      genAutoCounts[p.gen] = (genAutoCounts[p.gen] || 0) + 1;
      positions.set(p.id, {
        x: 200 + genAutoCounts[p.gen] * 185,
        y: GEN_Y[p.gen] || p.gen * 180,
      });
    }
  });

  // 标准化每条关系（附带唯一 index 和端点列表）
  const relations = DATA.relations.map((r, idx) => {
    const isDirected = r.type === "parent" || r.type === "adopted";
    const from = isDirected ? r.from : r.a;
    const to = isDirected ? r.to : r.b;
    return {
      ...r,
      idx,
      from,
      to,
      endpoints: [from, to],
    };
  });

  // 亲子映射（仅 parent 用于兄弟姐妹推导）
  const parentsOf = new Map();
  const childrenOf = new Map();
  const twinPairs = new Set();
  const directNeighbors = new Map();

  DATA.people.forEach((p) => {
    parentsOf.set(p.id, []);
    childrenOf.set(p.id, []);
    directNeighbors.set(p.id, new Set());
  });

  relations.forEach((r) => {
    if (directNeighbors.has(r.from)) directNeighbors.get(r.from).add(r.to);
    if (directNeighbors.has(r.to)) directNeighbors.get(r.to).add(r.from);

    if (r.type === "parent") {
      if (parentsOf.has(r.to)) parentsOf.get(r.to).push(r.from);
      if (childrenOf.has(r.from)) childrenOf.get(r.from).push(r.to);
    }
    if (r.type === "twin") {
      twinPairs.add(`${r.from}|${r.to}`);
      twinPairs.add(`${r.to}|${r.from}`);
    }
  });

  // 根据共同父母推导兄弟姐妹
  function getSiblings(personId) {
    const myParents = parentsOf.get(personId) || [];
    if (myParents.length === 0) return [];
    const myParentSet = new Set(myParents);
    const siblings = [];

    DATA.people.forEach((other) => {
      if (other.id === personId) return;
      const otherParents = parentsOf.get(other.id) || [];
      const shared = otherParents.filter((pid) => myParentSet.has(pid));
      if (shared.length > 0) {
        let note = "";
        if (twinPairs.has(`${personId}|${other.id}`)) {
          note = "双胞胎";
        } else if (shared.length === 1 && (myParents.length > 1 || otherParents.length > 1)) {
          const sharedParent = peopleById.get(shared[0]);
          if (sharedParent && sharedParent.gender === "m") note = "同父异母";
          else if (sharedParent && sharedParent.gender === "f") note = "同母异父";
        }
        siblings.push({ person: other, note });
      }
    });
    return siblings;
  }

  // 分组整理某个人的所有关系（供详情面板展示）
  function getGroupedRelations(personId) {
    const groups = {
      parents: [],
      spouses: [],
      lovers: [],
      children: [],
      siblings: getSiblings(personId),
      others: [],
    };

    const seen = {
      parents: new Set(),
      spouses: new Set(),
      lovers: new Set(),
      children: new Set(),
      others: new Set(),
    };

    relations.forEach((r) => {
      if (r.type === "parent") {
        if (r.to === personId && !seen.parents.has(r.from)) {
          seen.parents.add(r.from);
          const p = peopleById.get(r.from);
          if (p) groups.parents.push({ person: p, note: p.gender === "f" ? "母" : "父" });
        } else if (r.from === personId && !seen.children.has(r.to)) {
          seen.children.add(r.to);
          const p = peopleById.get(r.to);
          if (p) groups.children.push({ person: p, note: "" });
        }
      } else if (r.type === "adopted") {
        if (r.to === personId && !seen.parents.has(r.from)) {
          seen.parents.add(r.from);
          const p = peopleById.get(r.from);
          if (p) groups.parents.push({ person: p, note: p.gender === "f" ? "养母" : "养父" });
        } else if (r.from === personId && !seen.children.has(r.to)) {
          seen.children.add(r.to);
          const p = peopleById.get(r.to);
          if (p) groups.children.push({ person: p, note: r.label || "养女" });
        }
      } else if (r.type === "spouse") {
        const otherId = r.from === personId ? r.to : r.to === personId ? r.from : null;
        if (otherId && !seen.spouses.has(otherId)) {
          seen.spouses.add(otherId);
          const p = peopleById.get(otherId);
          const extra = r.label && r.label !== "夫妻" ? r.label.replace(/^夫妻/, "").replace(/^[（(]|[）)]$/g, "") : "";
          if (p) groups.spouses.push({ person: p, note: extra });
        }
      } else if (r.type === "lover") {
        const otherId = r.from === personId ? r.to : r.to === personId ? r.from : null;
        if (otherId && !seen.lovers.has(otherId)) {
          seen.lovers.add(otherId);
          const p = peopleById.get(otherId);
          if (p) groups.lovers.push({ person: p, note: r.label || "情人" });
        }
      } else if (r.type === "friend") {
        const otherId = r.from === personId ? r.to : r.to === personId ? r.from : null;
        if (otherId && !seen.others.has(otherId)) {
          seen.others.add(otherId);
          const p = peopleById.get(otherId);
          if (p) groups.others.push({ person: p, note: r.label || "挚友" });
        }
      }
    });

    return groups;
  }

  /* ------------------------------------------------------------------------
     3. SVG 辅助工具
     ------------------------------------------------------------------------ */
  function createSvgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "xlink:href") {
        el.setAttributeNS(XLINK_NS, "href", v);
        el.setAttribute("href", v);
      } else {
        el.setAttribute(k, String(v));
      }
    }
    return el;
  }

  function getMonogram(name) {
    const digits = /^\d+/.exec(name);
    if (digits) return digits[0];
    return name.charAt(0);
  }

  function wrapName(name) {
    if (name.length <= 8) return [name];
    const parenIdx = name.indexOf("（");
    if (parenIdx > 0) {
      return [name.slice(0, parenIdx), name.slice(parenIdx)];
    }
    const dotIdx = name.lastIndexOf("·");
    if (dotIdx > 0 && dotIdx >= 3 && name.length - dotIdx <= 7) {
      return [name.slice(0, dotIdx), name.slice(dotIdx + 1)];
    }
    const firstDot = name.indexOf("·");
    if (firstDot > 0) {
      return [name.slice(0, firstDot), name.slice(firstDot + 1)];
    }
    const mid = Math.ceil(name.length / 2);
    return [name.slice(0, mid), name.slice(mid)];
  }

  // 估算中英文混合字符串像素宽度，用于标签背景胶囊
  function estimateTextWidth(str, fontSize) {
    let w = 0;
    for (const ch of str) {
      w += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? fontSize : fontSize * 0.56;
    }
    return w;
  }

  function radiusOf(person) {
    return person.family ? R_MAIN : R_OUT;
  }

  /* ------------------------------------------------------------------------
     4. 构建 SVG 静态定义与代际背景层
     ------------------------------------------------------------------------ */
  const svgEl = document.getElementById("tree-svg");
  const defsEl = document.getElementById("svg-defs");
  const viewportEl = document.getElementById("viewport");
  const layerStrata = document.getElementById("layer-strata");
  const layerEdges = document.getElementById("layer-edges");
  const layerEdgesActive = document.getElementById("layer-edges-active");
  const layerEdgeLabels = document.getElementById("layer-edge-labels");
  const layerNodes = document.getElementById("layer-nodes");
  const layerButterflies = document.getElementById("layer-butterflies");

  function buildDefs() {
    // 家族无照片头像渐变
    const gradFamily = createSvgEl("radialGradient", {
      id: "mono-grad-family",
      cx: "38%",
      cy: "32%",
      r: "72%",
    });
    gradFamily.appendChild(createSvgEl("stop", { offset: "0%", "stop-color": "#f6ecd6" }));
    gradFamily.appendChild(createSvgEl("stop", { offset: "100%", "stop-color": "#d9c297" }));
    defsEl.appendChild(gradFamily);

    // 外人无照片头像渐变
    const gradOut = createSvgEl("radialGradient", {
      id: "mono-grad-outsider",
      cx: "38%",
      cy: "32%",
      r: "72%",
    });
    gradOut.appendChild(createSvgEl("stop", { offset: "0%", "stop-color": "#f3ebd9" }));
    gradOut.appendChild(createSvgEl("stop", { offset: "100%", "stop-color": "#ddd0b4" }));
    defsEl.appendChild(gradOut);

    // 圆形头像 clipPath
    const clipMain = createSvgEl("clipPath", { id: "clip-main" });
    clipMain.appendChild(createSvgEl("circle", { cx: 0, cy: 0, r: R_MAIN - 2 }));
    defsEl.appendChild(clipMain);

    const clipOut = createSvgEl("clipPath", { id: "clip-out" });
    clipOut.appendChild(createSvgEl("circle", { cx: 0, cy: 0, r: R_OUT - 2 }));
    defsEl.appendChild(clipOut);
  }

  function buildStrata() {
    for (let gen = 1; gen <= 7; gen++) {
      const y = GEN_Y[gen];
      const bandTop = y - 62;
      const bandHeight = gen === 7 ? 136 : 156;

      if (gen % 2 === 1) {
        layerStrata.appendChild(
          createSvgEl("rect", {
            x: 34,
            y: bandTop,
            width: 1356,
            height: bandHeight,
            rx: 14,
            class: "gen-band",
          })
        );
      }

      // 细羊皮卷分隔虚线
      if (gen > 1) {
        const ruleY = (GEN_Y[gen - 1] + y) / 2 + 16;
        layerStrata.appendChild(
          createSvgEl("line", {
            x1: 52,
            y1: ruleY,
            x2: 1375,
            y2: ruleY,
            class: "gen-rule",
          })
        );
      }

      // 左侧代际标题
      const labelG = createSvgEl("g", { transform: `translate(62, ${y})` });
      const cn = createSvgEl("text", { x: 0, y: -2, class: "gen-label-cn" });
      cn.textContent = GEN_NAMES_CN[gen];
      const roman = createSvgEl("text", { x: 0, y: 17, class: "gen-label-roman" });
      roman.textContent = `GEN · ${GEN_ROMAN[gen]}`;
      labelG.appendChild(cn);
      labelG.appendChild(roman);
      layerStrata.appendChild(labelG);
    }
  }

  /* ------------------------------------------------------------------------
     5. 边路径计算与绘制（清晰的家族谱系连线）
     ------------------------------------------------------------------------ */
  // 预先收集每个子女的父母列表（包括 parent 和 adopted）
  const allParentsOf = new Map();
  relations.forEach((r) => {
    if (r.type === "parent" || r.type === "adopted") {
      if (!allParentsOf.has(r.to)) allParentsOf.set(r.to, []);
      allParentsOf.get(r.to).push(r.from);
    }
  });

  // 构造带圆角的正交折线（用于亲子主干分支）
  function roundedBusPath(sx, sy, busY, tx, ty, corner = 12) {
    const dx = tx - sx;
    if (Math.abs(dx) < 2) {
      return `M ${sx} ${sy} L ${tx} ${ty}`;
    }
    const dir = dx > 0 ? 1 : -1;
    const r = Math.min(corner, Math.abs(dx) / 2, Math.abs(busY - sy) / 2, Math.abs(ty - busY) / 2);
    return [
      `M ${sx} ${sy}`,
      `L ${sx} ${busY - r}`,
      `Q ${sx} ${busY} ${sx + dir * r} ${busY}`,
      `L ${tx - dir * r} ${busY}`,
      `Q ${tx} ${busY} ${tx} ${busY + r}`,
      `L ${tx} ${ty}`,
    ].join(" ");
  }

  function computeEdgeGeometry(rel) {
    const pA = peopleById.get(rel.from);
    const pB = peopleById.get(rel.to);
    const posA = positions.get(rel.from);
    const posB = positions.get(rel.to);
    const rA = radiusOf(pA);
    const rB = radiusOf(pB);

    // 1. 亲子与养女关系
    if (rel.type === "parent" || rel.type === "adopted") {
      const parents = allParentsOf.get(rel.to) || [rel.from];
      const childTopY = posB.y - rB - 7;

      // 双亲同代：从双亲连线中点垂下，再圆角分叉至子女顶部
      if (parents.length === 2) {
        const pa1 = peopleById.get(parents[0]);
        const pa2 = peopleById.get(parents[1]);
        if (pa1.gen === pa2.gen) {
          const pp1 = positions.get(parents[0]);
          const pp2 = positions.get(parents[1]);
          const ux = (pp1.x + pp2.x) / 2;
          const uy = pp1.y;
          // 为养女微调横向分支高度，让铜绿点划线与实线完全分明且完全避开上代文字标签
          const busOffset = rel.type === "adopted" ? 41 : 49;
          const busY = posB.y - rB - busOffset;
          const d = roundedBusPath(ux, uy, busY, posB.x, childTopY, 13);
          return {
            d,
            labelPos: { x: posB.x, y: busY - 13 },
          };
        }

        // 跨代双亲：奥雷里亚诺·巴比伦(6代) + 阿玛兰妲·乌尔苏拉(5代) -> 婴儿(7代)
        const isLowerGenParent = pA.gen === 6;
        if (isLowerGenParent) {
          const sx = posA.x + rA * 0.72;
          const sy = posA.y + rA * 0.72;
          const tx = posB.x - 10;
          const ty = childTopY;
          const d = `M ${sx} ${sy} C ${sx + 38} ${sy + 42}, ${tx - 20} ${ty - 46}, ${tx} ${ty}`;
          return { d, labelPos: { x: (sx + tx) / 2 - 14, y: (sy + ty) / 2 } };
        } else {
          // 第5代母亲 au -> 第7代婴儿，从头像右下缘优雅弧线垂落，完全避开名字标签
          const sx = posA.x + rA * 0.74;
          const sy = posA.y + rA * 0.72;
          const tx = posB.x + 12;
          const ty = childTopY;
          const d = `M ${sx} ${sy} C ${sx + 56} ${sy + 96}, ${tx + 82} ${ty - 110}, ${tx} ${ty}`;
          return { d, labelPos: { x: sx + 30, y: (sy + ty) / 2 + 16 } };
        }
      }

      // 单亲（例如上校 -> 17个奥雷里亚诺）
      const sx = posA.x + rA * 0.72;
      const sy = posA.y + rA * 0.72;
      const tx = posB.x;
      const ty = childTopY;
      const d = `M ${sx} ${sy} C ${sx + 48} ${sy + 38}, ${tx} ${ty - 62}, ${tx} ${ty}`;
      return {
        d,
        labelPos: { x: (sx + tx) / 2 + 16, y: (sy + ty) / 2 },
      };
    }

    // 2. 特殊非相邻或跨代情人关系
    if (rel.type === "lover") {
      // 佩特拉(4代) <-> 奥雷里亚诺第二(4代)：从双胞胎兄弟标签下方优雅弧线绕过
      if ((rel.from === "as" && rel.to === "petra") || (rel.from === "petra" && rel.to === "as")) {
        const left = posA.x < posB.x ? { pos: posA, r: rA } : { pos: posB, r: rB };
        const right = posA.x < posB.x ? { pos: posB, r: rB } : { pos: posA, r: rA };
        const sx = left.pos.x + left.r * 0.72;
        const sy = left.pos.y + left.r * 0.72;
        const tx = right.pos.x - right.r * 0.72;
        const ty = right.pos.y + right.r * 0.72;
        const ctrlY = left.pos.y + 132;
        const d = `M ${sx} ${sy} C ${sx + 44} ${ctrlY}, ${tx - 44} ${ctrlY}, ${tx} ${ty}`;
        return {
          d,
          labelPos: { x: (sx + tx) / 2, y: left.pos.y + 104 },
        };
      }

      // 奥雷里亚诺·何塞(3代) <-> 阿玛兰妲(2代)：跨代姑侄禁忌之恋，从头像左下方绕过标签优雅连出
      if ((rel.from === "aj" && rel.to === "amaranta") || (rel.from === "amaranta" && rel.to === "aj")) {
        const am = positions.get("amaranta");
        const aj = positions.get("aj");
        const sx = am.x - R_MAIN * 0.72;
        const sy = am.y + R_MAIN * 0.72;
        const tx = aj.x - R_MAIN - 6;
        const ty = aj.y - 6;
        const d = `M ${sx} ${sy} C ${sx - 24} ${am.y + 128}, ${tx - 260} ${aj.y - 84}, ${tx} ${ty}`;
        return {
          d,
          labelPos: { x: (sx + tx) / 2 - 90, y: aj.y - 68 },
        };
      }

      // 奥雷里亚诺·巴比伦(6代) <-> 阿玛兰妲·乌尔苏拉(5代)：斜向弯曲恋人线
      if ((rel.from === "ab" && rel.to === "au") || (rel.from === "au" && rel.to === "ab")) {
        const ab = positions.get("ab");
        const au = positions.get("au");
        const sx = ab.x + R_MAIN * 0.85;
        const sy = ab.y - R_MAIN * 0.55;
        const tx = au.x - R_MAIN * 0.85;
        const ty = au.y + R_MAIN * 0.6;
        const mx = (sx + tx) / 2 - 12;
        const my = (sy + ty) / 2 - 18;
        const d = `M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}`;
        return {
          d,
          labelPos: { x: mx - 4, y: my - 4 },
        };
      }
    }

    // 3. 同代相邻关系（夫妻、情人、双胞胎、挚友）
    const left = posA.x <= posB.x ? { pos: posA, r: rA } : { pos: posB, r: rB };
    const right = posA.x <= posB.x ? { pos: posB, r: rB } : { pos: posA, r: rA };
    const sx = left.pos.x + left.r + 5;
    const tx = right.pos.x - right.r - 5;
    const y = left.pos.y;

    if (rel.type === "twin") {
      const mx = (sx + tx) / 2;
      return {
        d: `M ${sx} ${y - 3.2} L ${tx} ${y - 3.2} M ${sx} ${y + 3.2} L ${tx} ${y + 3.2}`,
        twinMid: { x: mx, y },
        labelPos: { x: mx, y: y - 20 },
      };
    }

    return {
      d: `M ${sx} ${y} L ${tx} ${y}`,
      labelPos: { x: (sx + tx) / 2, y: y - 18 },
    };
  }

  const edgeEls = [];

  function buildEdges() {
    // 绘制顺序：先亲子/养女，再情人/挚友，最后夫妻/双胞胎，保证视觉层次清晰
    const order = { parent: 1, adopted: 2, lover: 3, friend: 4, twin: 5, spouse: 6 };
    const sorted = [...relations].sort((a, b) => (order[a.type] || 9) - (order[b.type] || 9));

    sorted.forEach((rel) => {
      const geom = computeEdgeGeometry(rel);
      const g = createSvgEl("g", {
        class: `edge-group edge-${rel.type}`,
        "data-idx": rel.idx,
      });

      // 羊皮纸浅色底晕，让偶有交叉的线条依然清晰利落
      if (rel.type === "lover" || rel.type === "adopted") {
        g.appendChild(createSvgEl("path", { d: geom.d, class: "edge-halo" }));
      }

      g.appendChild(createSvgEl("path", { d: geom.d, class: "edge-path" }));

      if (rel.type === "spouse") {
        g.appendChild(createSvgEl("path", { d: geom.d, class: "edge-path-inner" }));
      }

      if (rel.type === "twin" && geom.twinMid) {
        const { x, y } = geom.twinMid;
        g.appendChild(
          createSvgEl("polygon", {
            points: `${x},${y - 6.5} ${x + 6.5},${y} ${x},${y + 6.5} ${x - 6.5},${y}`,
            class: "edge-twin-gem",
          })
        );
      }

      layerEdges.appendChild(g);
      edgeEls.push({ rel, g, geom });
    });
  }

  /* ------------------------------------------------------------------------
     6. 绘制人物节点（圆形旧照头像 / 姓名首字 + 简短 tag）
     ------------------------------------------------------------------------ */
  const nodeEls = new Map();

  function buildNodes() {
    DATA.people.forEach((person) => {
      const pos = positions.get(person.id);
      const r = radiusOf(person);
      const isMain = person.family;

      const g = createSvgEl("g", {
        class: `node-group ${isMain ? "is-family" : "is-outsider"}`,
        transform: `translate(${pos.x}, ${pos.y})`,
        tabindex: "0",
        role: "button",
        "aria-label": `${person.name}，${person.tag}，第${person.gen}代`,
        "data-id": person.id,
      });

      const avatarWrap = createSvgEl("g", { class: "node-avatar-wrap" });

      // 选中时的外围炼金金圈光环
      avatarWrap.appendChild(
        createSvgEl("circle", {
          cx: 0,
          cy: 0,
          r: r + 9,
          class: "node-select-halo",
        })
      );

      // 双层边框外圈
      avatarWrap.appendChild(
        createSvgEl("circle", {
          cx: 0,
          cy: 0,
          r: r + 4,
          class: "node-ring-outer",
        })
      );

      // 头像内容：剧照或姓名首字
      if (person.photo) {
        const size = (r - 1) * 2;
        const img = createSvgEl("image", {
          x: -(r - 1),
          y: -(r - 1),
          width: size,
          height: size,
          preserveAspectRatio: "xMidYMin slice",
          "clip-path": isMain ? "url(#clip-main)" : "url(#clip-out)",
          "xlink:href": person.photo,
          class: "node-photo",
        });
        avatarWrap.appendChild(img);
      } else {
        avatarWrap.appendChild(
          createSvgEl("circle", {
            cx: 0,
            cy: 0,
            r: r - 2,
            class: "node-mono-bg",
          })
        );
        const mono = createSvgEl("text", {
          x: 0,
          y: 1,
          class: "node-mono-text",
          "font-size": isMain ? 24 : 18,
        });
        mono.textContent = getMonogram(person.name);
        avatarWrap.appendChild(mono);
      }

      // 细微内金线
      avatarWrap.appendChild(
        createSvgEl("circle", {
          cx: 0,
          cy: 0,
          r: r - 1.5,
          class: "node-ring-inner",
        })
      );

      g.appendChild(avatarWrap);

      // 姓名（超长自动双行换行）
      const lines = wrapName(person.name);
      const nameStartY = r + (isMain ? 19 : 17);
      const lineStep = 15.5;
      lines.forEach((line, i) => {
        const t = createSvgEl("text", {
          x: 0,
          y: nameStartY + i * lineStep,
          class: "node-name",
        });
        t.textContent = line;
        g.appendChild(t);
      });

      // 简短 tag 胶囊（用于区分重名人物）
      const tagY = nameStartY + (lines.length - 1) * lineStep + 16;
      const tagText = person.tag || "";
      if (tagText) {
        const tagW = Math.max(46, estimateTextWidth(tagText, 10.2) + 14);
        g.appendChild(
          createSvgEl("rect", {
            x: -tagW / 2,
            y: tagY - 8.5,
            width: tagW,
            height: 17,
            rx: 8.5,
            class: "node-tag-bg",
          })
        );
        const tagEl = createSvgEl("text", {
          x: 0,
          y: tagY,
          class: "node-tag",
        });
        tagEl.textContent = tagText;
        g.appendChild(tagEl);
      }

      // 点击与键盘选中
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        if (dragMoved) return;
        selectPerson(person.id, { pan: false });
      });

      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectPerson(person.id, { pan: true });
        }
      });

      layerNodes.appendChild(g);
      nodeEls.set(person.id, g);
    });
  }

  /* ------------------------------------------------------------------------
     7. 画布黄蝴蝶点缀（致敬毛里西奥·巴比伦）
     ------------------------------------------------------------------------ */
  function buildCanvasButterflies() {
    const mau = positions.get("mauricio");
    const spots = [
      { x: mau.x - 30, y: mau.y - 30, scale: 0.42, rot: -24 },
      { x: mau.x + 28, y: mau.y - 24, scale: 0.34, rot: 22 },
      { x: mau.x - 36, y: mau.y + 6,  scale: 0.28, rot: -42 },
      // 始祖与羊皮卷旁一两只极淡的小蝶
      { x: 1345, y: 120, scale: 0.46, rot: 16 },
      { x: 1015, y: 1170, scale: 0.36, rot: -18 },
    ];

    spots.forEach((s) => {
      const g = createSvgEl("g", {
        transform: `translate(${s.x}, ${s.y}) rotate(${s.rot}) scale(${s.scale})`,
        opacity: "0.86",
        "pointer-events": "none",
      });
      g.appendChild(
        createSvgEl("path", {
          d: "M20 15 C14 3, 2 2, 3 13 C3.5 19, 12 20, 19 17 C12 20, 6 26, 11 29 C15 31, 19 25, 20 19 Z",
          fill: "#e3ab24",
          stroke: "#4a3117",
          "stroke-width": "0.9",
          transform: "translate(-20, -16)",
        })
      );
      g.appendChild(
        createSvgEl("path", {
          d: "M20 15 C26 3, 38 2, 37 13 C36.5 19, 28 20, 21 17 C28 20, 34 26, 29 29 C25 31, 21 25, 20 19 Z",
          fill: "#f4ce5a",
          stroke: "#4a3117",
          "stroke-width": "0.9",
          transform: "translate(-20, -16)",
        })
      );
      g.appendChild(
        createSvgEl("path", {
          d: "M20 10 L20 24",
          stroke: "#4a3117",
          "stroke-width": "1.3",
          "stroke-linecap": "round",
          transform: "translate(-20, -16)",
        })
      );
      layerButterflies.appendChild(g);
    });
  }

  /* ------------------------------------------------------------------------
     8. 选中状态、关系高亮与详情面板渲染
     ------------------------------------------------------------------------ */
  let selectedId = null;
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const detailClose = document.getElementById("detail-close");

  function clearEdgeLabels() {
    while (layerEdgeLabels.firstChild) {
      layerEdgeLabels.removeChild(layerEdgeLabels.firstChild);
    }
  }

  function addEdgeLabel(x, y, text, color) {
    const g = createSvgEl("g", {
      class: "edge-label-pill",
      transform: `translate(${x}, ${y})`,
    });
    const w = estimateTextWidth(text, 10.5) + 14;
    g.appendChild(
      createSvgEl("rect", {
        x: -w / 2,
        y: -9.5,
        width: w,
        height: 19,
        rx: 9.5,
        class: "edge-label-bg",
        stroke: color,
      })
    );
    const t = createSvgEl("text", {
      x: 0,
      y: 0.5,
      class: "edge-label-text",
      fill: color,
    });
    t.textContent = text;
    g.appendChild(t);
    layerEdgeLabels.appendChild(g);
  }

  function applySelectionVisuals() {
    clearEdgeLabels();

    // 先把所有活动边归位到默认层
    while (layerEdgesActive.firstChild) {
      layerEdges.appendChild(layerEdgesActive.firstChild);
    }

    if (!selectedId) {
      svgEl.classList.remove("has-selection");
      nodeEls.forEach((g) => {
        g.classList.remove("is-selected", "is-related", "is-dimmed");
      });
      edgeEls.forEach(({ g }) => {
        g.classList.remove("is-highlighted", "is-dimmed");
      });
      return;
    }

    svgEl.classList.add("has-selection");
    const neighbors = directNeighbors.get(selectedId) || new Set();

    nodeEls.forEach((g, id) => {
      g.classList.remove("is-selected", "is-related", "is-dimmed");
      if (id === selectedId) {
        g.classList.add("is-selected");
      } else if (neighbors.has(id)) {
        g.classList.add("is-related");
      } else {
        g.classList.add("is-dimmed");
      }
    });

    // 高亮直接相连的边，并移入顶层显示，同时对带中文说明的非纯亲子边显示关系标签
    const labeledPositions = [];
    edgeEls.forEach(({ rel, g, geom }) => {
      const touches = rel.from === selectedId || rel.to === selectedId;
      g.classList.remove("is-highlighted", "is-dimmed");
      if (touches) {
        g.classList.add("is-highlighted");
        layerEdgesActive.appendChild(g);

        if (rel.label && geom.labelPos) {
          let lx = geom.labelPos.x;
          let ly = geom.labelPos.y;
          // 轻微避让重叠标签
          for (const prev of labeledPositions) {
            if (Math.abs(prev.x - lx) < 70 && Math.abs(prev.y - ly) < 22) {
              ly -= 22;
            }
          }
          labeledPositions.push({ x: lx, y: ly });
          addEdgeLabel(lx, ly, rel.label, REL_COLORS[rel.type] || "#5c4632");
        }
      } else {
        g.classList.add("is-dimmed");
      }
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderDetailPanel(person) {
    const groups = getGroupedRelations(person.id);

    // 照片与照片类型标注
    let photoHtml = "";
    if (person.photo) {
      const isPress = person.photoType === "press";
      const badgeText = isPress ? "演员宣传照（非剧中造型）" : "剧照 · Netflix《百年孤独》";
      photoHtml = `
        <div class="portrait-mount">
          <img class="portrait-img" src="${escapeHtml(person.photo)}" alt="${escapeHtml(person.name)}">
          <span class="photo-type-badge ${isPress ? "is-press" : "is-still"}">${badgeText}</span>
        </div>
      `;
    } else {
      photoHtml = `
        <div class="portrait-mount">
          <div class="portrait-placeholder">
            <div class="portrait-placeholder-char">${escapeHtml(getMonogram(person.name))}</div>
            <span class="portrait-placeholder-note">暂无剧照</span>
          </div>
        </div>
      `;
    }

    // 演员信息
    const actorText = person.actor && person.actor !== "—" ? person.actor : "—";
    const actorNoteHtml = person.actorNote
      ? `<div class="actor-note">${escapeHtml(person.actorNote)}</div>`
      : "";

    // 关系分组配置
    const sectionDefs = [
      { key: "parents",  title: "父母", color: REL_COLORS.parent },
      { key: "spouses",  title: "配偶", color: REL_COLORS.spouse },
      { key: "lovers",   title: "情人 / 恋人", color: REL_COLORS.lover },
      { key: "children", title: "子女", color: REL_COLORS.parent },
      { key: "siblings", title: "兄弟姐妹", color: REL_COLORS.twin },
      { key: "others",   title: "其他", color: REL_COLORS.friend },
    ];

    const relHtmlParts = [];
    sectionDefs.forEach((sec) => {
      const items = groups[sec.key];
      if (!items || items.length === 0) return;

      const chips = items
        .map(({ person: target, note }) => {
          const noteSpan = note ? `<span class="rel-chip-note">${escapeHtml(note)}</span>` : "";
          return `<button type="button" class="rel-chip" data-jump-id="${escapeHtml(target.id)}">
            <span>${escapeHtml(target.name)}</span>${noteSpan}
          </button>`;
        })
        .join("");

      relHtmlParts.push(`
        <div class="rel-group">
          <h3 class="rel-group-title">
            <span class="rel-dot" style="background:${sec.color}"></span>
            <span>${sec.title}</span>
          </h3>
          <div class="rel-chips">${chips}</div>
        </div>
      `);
    });

    detailContent.innerHTML = `
      ${photoHtml}
      <div class="detail-head">
        <div class="detail-badges">
          <span class="gen-badge">${GEN_NAMES_CN[person.gen] || `第${person.gen}代`}</span>
          <span class="family-badge">${person.family ? "布恩迪亚家族" : "外姓人物"}</span>
        </div>
        <h2 class="detail-name">${escapeHtml(person.name)}</h2>
        <p class="detail-tag">${escapeHtml(person.tag)}</p>
      </div>
      <div class="actor-box">
        <div class="actor-row">
          <span class="actor-label">饰演演员</span>
          <span class="actor-value">${escapeHtml(actorText)}</span>
        </div>
        ${actorNoteHtml}
      </div>
      <p class="detail-bio">${escapeHtml(person.bio)}</p>
      <div class="rel-sections">
        ${relHtmlParts.join("")}
      </div>
    `;

    // 绑定关系跳转点击事件
    detailContent.querySelectorAll("[data-jump-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const jumpId = btn.getAttribute("data-jump-id");
        selectPerson(jumpId, { pan: true });
      });
    });

    detailContent.scrollTop = 0;
    detailPanel.classList.add("is-open");
    detailPanel.setAttribute("aria-hidden", "false");
  }

  function selectPerson(id, opts = {}) {
    const person = peopleById.get(id);
    if (!person) return;
    selectedId = id;
    applySelectionVisuals();
    renderDetailPanel(person);

    if (opts.pan) {
      focusOnPerson(id, opts.minScale || 0.92);
    } else {
      ensurePersonVisible(id);
    }
  }

  function clearSelection() {
    if (!selectedId) return;
    selectedId = null;
    applySelectionVisuals();
    detailPanel.classList.remove("is-open");
    detailPanel.setAttribute("aria-hidden", "true");
  }

  detailClose.addEventListener("click", clearSelection);

  /* ------------------------------------------------------------------------
     9. 平移、缩放与平滑镜头控制
     ------------------------------------------------------------------------ */
  const canvasWrap = document.getElementById("canvas-wrap");
  const btnZoomIn = document.getElementById("btn-zoom-in");
  const btnZoomOut = document.getElementById("btn-zoom-out");
  const btnReset = document.getElementById("btn-reset");

  const MIN_SCALE = 0.34;
  const MAX_SCALE = 2.4;

  let view = { x: 0, y: 0, scale: 1 };
  let animRaf = null;

  function applyTransform() {
    viewportEl.setAttribute("transform", `translate(${view.x.toFixed(2)}, ${view.y.toFixed(2)}) scale(${view.scale.toFixed(4)})`);
  }

  function cancelAnim() {
    if (animRaf) {
      cancelAnimationFrame(animRaf);
      animRaf = null;
    }
  }

  function animateViewTo(targetX, targetY, targetScale, duration = 420) {
    cancelAnim();
    const start = { ...view };
    const t0 = performance.now();

    function step(now) {
      const p = Math.min(1, (now - t0) / duration);
      // easeOutCubic
      const e = 1 - Math.pow(1 - p, 3);
      view.x = start.x + (targetX - start.x) * e;
      view.y = start.y + (targetY - start.y) * e;
      view.scale = start.scale + (targetScale - start.scale) * e;
      applyTransform();
      if (p < 1) {
        animRaf = requestAnimationFrame(step);
      } else {
        animRaf = null;
      }
    }
    animRaf = requestAnimationFrame(step);
  }

  function getFitView() {
    const rect = canvasWrap.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;
    const contentW = CANVAS_BOUNDS.maxX - CANVAS_BOUNDS.minX;
    const contentH = CANVAS_BOUNDS.maxY - CANVAS_BOUNDS.minY;
    const padX = w < 700 ? 18 : 36;
    const padY = 26;
    const scale = Math.min(
      Math.max(MIN_SCALE, Math.min((w - padX * 2) / contentW, (h - padY * 2) / contentH)),
      1.15
    );
    const cx = (CANVAS_BOUNDS.minX + CANVAS_BOUNDS.maxX) / 2;
    const cy = (CANVAS_BOUNDS.minY + CANVAS_BOUNDS.maxY) / 2;
    return {
      scale,
      x: w / 2 - cx * scale,
      y: h / 2 - cy * scale,
    };
  }

  function resetView(animate = true) {
    const fit = getFitView();
    if (animate) {
      animateViewTo(fit.x, fit.y, fit.scale, 460);
    } else {
      cancelAnim();
      view = fit;
      applyTransform();
    }
  }

  // 计算扣除右侧/底部详情面板后的可见画布中心
  function getVisibleCenter() {
    const rect = canvasWrap.getBoundingClientRect();
    const isNarrow = window.innerWidth <= 900;
    const panelOpen = detailPanel.classList.contains("is-open");
    if (!panelOpen) {
      return { cx: rect.width / 2, cy: rect.height / 2, w: rect.width, h: rect.height };
    }
    if (isNarrow) {
      const availH = rect.height * 0.42;
      return { cx: rect.width / 2, cy: availH / 2, w: rect.width, h: availH };
    }
    const availW = Math.max(240, rect.width - 416);
    return { cx: availW / 2, cy: rect.height / 2, w: availW, h: rect.height };
  }

  function focusOnPerson(id, minScale = 0.9) {
    const pos = positions.get(id);
    if (!pos) return;
    const { cx, cy } = getVisibleCenter();
    const targetScale = Math.min(MAX_SCALE, Math.max(view.scale, minScale));
    const targetX = cx - pos.x * targetScale;
    const targetY = cy - pos.y * targetScale;
    animateViewTo(targetX, targetY, targetScale, 460);
  }

  // 如果点击的人物被刚打开的详情面板挡住，轻轻平移使其露出
  function ensurePersonVisible(id) {
    const pos = positions.get(id);
    if (!pos) return;
    const { cx, cy, w, h } = getVisibleCenter();
    const screenX = pos.x * view.scale + view.x;
    const screenY = pos.y * view.scale + view.y;
    const margin = 76;

    if (screenX < margin || screenX > w - margin || screenY < margin || screenY > h - margin) {
      const targetX = cx - pos.x * view.scale;
      const targetY = cy - pos.y * view.scale;
      animateViewTo(targetX, targetY, view.scale, 380);
    }
  }

  function zoomAroundPoint(factor, clientX, clientY) {
    cancelAnim();
    const rect = canvasWrap.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
    const ratio = newScale / view.scale;
    view.x = px - (px - view.x) * ratio;
    view.y = py - (py - view.y) * ratio;
    view.scale = newScale;
    applyTransform();
  }

  // 滚轮缩放
  canvasWrap.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = Math.exp(delta * 0.0014);
      zoomAroundPoint(factor, e.clientX, e.clientY);
    },
    { passive: false }
  );

  // 指针拖拽平移 & 双指捏合缩放
  let isDragging = false;
  let dragMoved = false;
  let dragStart = { x: 0, y: 0, vx: 0, vy: 0 };
  const activePointers = new Map();
  let lastPinchDist = null;

  canvasWrap.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
      cancelAnim();
      isDragging = true;
      dragMoved = false;
      dragStart = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      canvasWrap.classList.add("is-dragging");
    } else if (activePointers.size === 2) {
      isDragging = false;
      const pts = [...activePointers.values()];
      lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
  });

  window.addEventListener("pointermove", (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2) {
      const pts = [...activePointers.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (lastPinchDist && dist > 0) {
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        zoomAroundPoint(dist / lastPinchDist, midX, midY);
        dragMoved = true;
      }
      lastPinchDist = dist;
      return;
    }

    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (Math.hypot(dx, dy) > 4) {
      dragMoved = true;
    }
    view.x = dragStart.vx + dx;
    view.y = dragStart.vy + dy;
    applyTransform();
  });

  function endPointer(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {
      lastPinchDist = null;
    }
    if (activePointers.size === 0) {
      isDragging = false;
      canvasWrap.classList.remove("is-dragging");
      // 稍后复位 dragMoved，让同帧的 click 能准确区分拖拽与点击
      setTimeout(() => {
        dragMoved = false;
      }, 0);
    }
  }

  window.addEventListener("pointerup", endPointer);
  window.addEventListener("pointercancel", endPointer);

  // 点击空白处取消选中
  svgEl.addEventListener("click", (e) => {
    if (dragMoved) return;
    if (!e.target.closest(".node-group")) {
      clearSelection();
    }
  });

  // 缩放与重置按钮
  btnZoomIn.addEventListener("click", () => {
    const rect = canvasWrap.getBoundingClientRect();
    zoomAroundPoint(1.24, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  btnZoomOut.addEventListener("click", () => {
    const rect = canvasWrap.getBoundingClientRect();
    zoomAroundPoint(1 / 1.24, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  btnReset.addEventListener("click", () => {
    resetView(true);
  });

  /* ------------------------------------------------------------------------
     10. 顶部模糊搜索（支持姓名与 tag 模糊匹配 + 键盘导航）
     ------------------------------------------------------------------------ */
  const searchWrap = document.getElementById("search-wrap");
  const searchInput = document.getElementById("search-input");
  const searchClear = document.getElementById("search-clear");
  const searchDropdown = document.getElementById("search-dropdown");

  let searchResults = [];
  let activeResultIdx = -1;

  // 子串优先，其次按字符顺序模糊匹配
  function fuzzyMatch(text, query) {
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    const subIdx = t.indexOf(q);
    if (subIdx !== -1) {
      const indices = [];
      for (let i = 0; i < q.length; i++) indices.push(subIdx + i);
      // 前缀匹配分最高
      return { score: (subIdx === 0 ? 120 : 85) - subIdx * 0.5, indices };
    }
    let qi = 0;
    const indices = [];
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) {
        indices.push(i);
        qi++;
      }
    }
    if (qi === q.length) {
      const span = indices[indices.length - 1] - indices[0] + 1;
      return { score: 45 - (span - q.length) * 1.2, indices };
    }
    return null;
  }

  function highlightText(text, indices) {
    if (!indices || indices.length === 0) return escapeHtml(text);
    const set = new Set(indices);
    let out = "";
    for (let i = 0; i < text.length; i++) {
      const ch = escapeHtml(text[i]);
      out += set.has(i) ? `<mark>${ch}</mark>` : ch;
    }
    return out;
  }

  function runSearch(rawQuery) {
    const query = rawQuery.trim();
    searchClear.hidden = query.length === 0;

    if (!query) {
      closeDropdown();
      return;
    }

    const matches = [];
    DATA.people.forEach((p) => {
      const nameHit = fuzzyMatch(p.name, query);
      const tagHit = fuzzyMatch(p.tag || "", query);
      if (nameHit || tagHit) {
        const bestScore = Math.max(
          nameHit ? nameHit.score + 10 : -Infinity,
          tagHit ? tagHit.score : -Infinity
        );
        matches.push({
          person: p,
          score: bestScore,
          nameIndices: nameHit ? nameHit.indices : [],
          tagIndices: tagHit ? tagHit.indices : [],
        });
      }
    });

    matches.sort((a, b) => b.score - a.score || a.person.gen - b.person.gen);
    searchResults = matches;
    activeResultIdx = matches.length > 0 ? 0 : -1;
    renderSearchDropdown();
  }

  function renderSearchDropdown() {
    if (searchResults.length === 0) {
      searchDropdown.innerHTML = `<li class="search-empty">未找到匹配的布恩迪亚家族人物</li>`;
    } else {
      searchDropdown.innerHTML = searchResults
        .map((item, idx) => {
          const p = item.person;
          const thumb = p.photo
            ? `<img class="search-thumb" src="${escapeHtml(p.photo)}" alt="">`
            : `<span class="search-thumb-mono">${escapeHtml(getMonogram(p.name))}</span>`;
          return `
            <li class="search-item ${idx === activeResultIdx ? "is-active" : ""}" role="option" data-idx="${idx}">
              ${thumb}
              <div class="search-item-info">
                <div class="search-item-name">${highlightText(p.name, item.nameIndices)}</div>
                <div class="search-item-meta">
                  <span>${GEN_NAMES_CN[p.gen]}</span>
                  <span>·</span>
                  <span>${highlightText(p.tag || "", item.tagIndices)}</span>
                </div>
              </div>
            </li>
          `;
        })
        .join("");

      searchDropdown.querySelectorAll(".search-item").forEach((li) => {
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const idx = Number(li.getAttribute("data-idx"));
          pickSearchResult(idx);
        });
      });
    }

    searchDropdown.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  function closeDropdown() {
    searchDropdown.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    activeResultIdx = -1;
  }

  function pickSearchResult(idx) {
    const item = searchResults[idx];
    if (!item) return;
    searchInput.value = item.person.name;
    searchClear.hidden = false;
    closeDropdown();
    selectPerson(item.person.id, { pan: true, minScale: 0.98 });
  }

  searchInput.addEventListener("input", () => runSearch(searchInput.value));
  searchInput.addEventListener("focus", () => {
    if (searchInput.value.trim()) runSearch(searchInput.value);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (searchDropdown.hidden) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (searchResults.length > 0) {
        activeResultIdx = (activeResultIdx + 1) % searchResults.length;
        renderSearchDropdown();
        scrollActiveIntoView();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (searchResults.length > 0) {
        activeResultIdx = (activeResultIdx - 1 + searchResults.length) % searchResults.length;
        renderSearchDropdown();
        scrollActiveIntoView();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeResultIdx >= 0) pickSearchResult(activeResultIdx);
    } else if (e.key === "Escape") {
      closeDropdown();
      searchInput.blur();
    }
  });

  function scrollActiveIntoView() {
    const activeEl = searchDropdown.querySelector(".search-item.is-active");
    if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
  }

  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchClear.hidden = true;
    closeDropdown();
    searchInput.focus();
  });

  document.addEventListener("click", (e) => {
    if (!searchWrap.contains(e.target)) {
      closeDropdown();
    }
  });

  /* ------------------------------------------------------------------------
     11. 图例折叠与全局快捷键
     ------------------------------------------------------------------------ */
  const legendCard = document.getElementById("legend-card");
  const legendToggle = document.getElementById("legend-toggle");

  legendToggle.addEventListener("click", () => {
    const collapsed = legendCard.classList.toggle("is-collapsed");
    legendToggle.textContent = collapsed ? "展开" : "收起";
    legendToggle.setAttribute("aria-expanded", String(!collapsed));
  });

  // 窄屏默认收起图例，腾出更大画布空间
  if (window.innerWidth <= 680) {
    legendCard.classList.add("is-collapsed");
    legendToggle.textContent = "展开";
    legendToggle.setAttribute("aria-expanded", "false");
  }

  document.addEventListener("keydown", (e) => {
    if (document.activeElement === searchInput) return;
    if (e.key === "Escape") {
      clearSelection();
    } else if (e.key === "0") {
      resetView(true);
    }
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!selectedId) {
        resetView(true);
      }
    }, 180);
  });

  /* ------------------------------------------------------------------------
     12. 初始化渲染
     ------------------------------------------------------------------------ */
  buildDefs();
  buildStrata();
  buildEdges();
  buildNodes();
  buildCanvasButterflies();
  resetView(false);
})();
