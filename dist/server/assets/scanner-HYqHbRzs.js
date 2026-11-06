import { a as bandOf, i as Stat, n as Panel, r as Skeleton, s as pct, t as Meter } from "./ui-DkWF3tW-.js";
import { a as DEFAULT_CONFIG, i as CONTRACT_META, o as analyze, r as useFeed, u as MARKET_BY_SYMBOL } from "./router-CYbkdPpX.js";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { ArrowUpRight } from "lucide-react";
// src/routes/scanner.tsx?tsr-split=component
function ScannerPage() {
	const { feed, version } = useFeed();
	const navigate = useNavigate();
	const [rows, setRows] = useState([]);
	const [scanMicros, setScanMicros] = useState(0);
	const threshold = DEFAULT_CONFIG.threshold;
	useEffect(() => {
		if (!feed) return;
		const run = () => {
			const t0 = performance.now();
			const next = [];
			for (const sym of feed.snap.selected) {
				const s = feed.series.get(sym);
				if (!s?.loaded || s.digits.length < 60) continue;
				next.push({
					symbol: sym,
					analysis: analyze(s.digits, s.prices, DEFAULT_CONFIG),
					last: s.digits[s.digits.length - 1],
					liveTicks: s.liveTicks,
					backfilling: s.backfilling
				});
			}
			setScanMicros((performance.now() - t0) * 1e3);
			setRows(next);
		};
		run();
		const id = setInterval(run, 1e3);
		return () => clearInterval(id);
	}, [feed, feed?.snap.selected.join(",")]);
	const ranked = useMemo(() => rows.map((r) => {
		const best = [...r.analysis.signals].sort((a, b) => b.confidence - a.confidence)[0];
		return {
			...r,
			best
		};
	}).sort((a, b) => b.best.confidence - a.best.confidence), [rows]);
	const pending = (feed?.snap.selected.length ?? 0) - rows.length;
	const hot = ranked.filter((r) => r.best.confidence >= threshold).length;
	const rtt = feed?.snap.rttHistory ?? [];
	const open = (sym) => {
		feed?.setFocus(sym);
		navigate({ to: "/" });
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ jsxs("div", { children: [
				/* @__PURE__ */ jsx("p", {
					className: "label text-pulse",
					children: "05 · AI digit scanner"
				}),
				/* @__PURE__ */ jsx("h1", {
					className: "mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl",
					children: "Scanning your chosen markets"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-1 max-w-2xl text-sm text-mute",
					children: "Each market is fully re-analysed every second and ranked by its strongest contract signal. Add or remove markets from the bar above."
				})
			] }),
			/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-2 gap-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ jsx(Stat, {
						label: "Markets scanned",
						value: rows.length,
						hint: pending > 0 ? `${pending} loading` : "all loaded"
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "High-confidence hits",
						value: hot,
						tone: hot ? "text-pulse" : "text-white",
						hint: `score ≥ ${threshold}`
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Full scan time",
						value: `${(scanMicros / 1e3).toFixed(1)}ms`,
						hint: `${scanMicros.toFixed(0)}µs across all markets`
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Feed RTT avg",
						value: feed?.snap.rttAvg != null ? `${feed.snap.rttAvg.toFixed(0)}ms` : "—",
						hint: `last ${rtt.length} pings`,
						tone: "text-volt"
					})
				]
			}),
			/* @__PURE__ */ jsx(Panel, {
				kicker: "Ranked by confidence",
				title: "Market signal board",
				children: ranked.length === 0 ? /* @__PURE__ */ jsxs("div", {
					className: "space-y-3",
					children: [/* @__PURE__ */ jsx("p", {
						className: "text-sm text-mute",
						children: feed?.snap.mode === "live" ? `Loading tick history for ${feed.snap.selected.length} market${feed.snap.selected.length === 1 ? "" : "s"}…` : feed?.snap.mode === "reconnecting" ? "Connecting to the broker feed — retrying…" : "Connecting to the broker feed…"
					}), [
						0,
						1,
						2
					].map((i) => /* @__PURE__ */ jsx(Skeleton, { className: "h-14" }, i))]
				}) : /* @__PURE__ */ jsx("div", {
					className: "-mx-5 overflow-x-auto",
					children: /* @__PURE__ */ jsxs("table", {
						className: "w-full min-w-[880px] text-sm",
						children: [/* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", {
							className: "border-b border-line text-left",
							children: [
								"Market",
								"Last",
								"χ² p-value",
								"Hot / cold",
								"Best signal",
								"Confidence",
								"Backtest",
								"Edge",
								""
							].map((h) => /* @__PURE__ */ jsx("th", {
								className: "label px-5 py-2 font-normal",
								children: h
							}, h))
						}) }), /* @__PURE__ */ jsx("tbody", { children: ranked.map((r) => {
							const { stats } = r.analysis;
							const b = r.best;
							const band = bandOf(b.confidence, threshold);
							const acc = b.backtest.trades ? b.backtest.wins / b.backtest.trades : 0;
							const edge = acc - b.breakeven;
							return /* @__PURE__ */ jsxs("tr", {
								className: "border-b border-line/60 transition hover:bg-panel-2/60",
								children: [
									/* @__PURE__ */ jsxs("td", {
										className: "px-5 py-3",
										children: [/* @__PURE__ */ jsx("p", {
											className: "font-semibold text-white",
											children: MARKET_BY_SYMBOL[r.symbol]?.short
										}), /* @__PURE__ */ jsxs("p", {
											className: "font-mono text-[10px] text-mute",
											children: [
												r.symbol,
												" · ",
												stats.n,
												" ticks",
												r.backfilling && " · filling"
											]
										})]
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-5 py-3",
										children: /* @__PURE__ */ jsx("span", {
											className: "blip num inline-grid h-8 w-8 place-items-center rounded-lg border border-line font-bold text-white",
											children: r.last
										}, r.liveTicks)
									}),
									/* @__PURE__ */ jsx("td", {
										className: `num px-5 py-3 ${stats.pValue < .05 ? "text-pulse" : "text-soft"}`,
										children: stats.pValue.toFixed(3)
									}),
									/* @__PURE__ */ jsxs("td", {
										className: "num px-5 py-3",
										children: [
											/* @__PURE__ */ jsx("span", {
												className: "text-heat",
												children: stats.hot
											}),
											/* @__PURE__ */ jsxs("span", {
												className: "text-mute",
												children: [
													" ",
													stats.pct[stats.hot].toFixed(1),
													"% /",
													" "
												]
											}),
											/* @__PURE__ */ jsx("span", {
												className: "text-cold",
												children: stats.cold
											}),
											/* @__PURE__ */ jsxs("span", {
												className: "text-mute",
												children: [
													" ",
													stats.pct[stats.cold].toFixed(1),
													"%"
												]
											})
										]
									}),
									/* @__PURE__ */ jsxs("td", {
										className: "px-5 py-3",
										children: [/* @__PURE__ */ jsx("p", {
											className: "font-semibold text-white",
											children: b.label
										}), /* @__PURE__ */ jsx("p", {
											className: "font-mono text-[10px] text-mute",
											children: CONTRACT_META[b.kind].family
										})]
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-5 py-3",
										children: /* @__PURE__ */ jsxs("div", {
											className: "flex w-36 items-center gap-2",
											children: [/* @__PURE__ */ jsx(Meter, {
												value: b.confidence,
												threshold
											}), /* @__PURE__ */ jsx("span", {
												className: `num w-8 text-right text-xs ${band.cls}`,
												children: b.confidence.toFixed(0)
											})]
										})
									}),
									/* @__PURE__ */ jsx("td", {
										className: "num px-5 py-3 text-soft",
										children: pct(acc)
									}),
									/* @__PURE__ */ jsxs("td", {
										className: `num px-5 py-3 ${edge > 0 ? "text-pulse" : "text-cold"}`,
										children: [edge > 0 ? "+" : "", (edge * 100).toFixed(2)]
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-5 py-3 text-right",
										children: /* @__PURE__ */ jsxs("button", {
											onClick: () => open(r.symbol),
											className: "inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs text-soft hover:border-pulse/50 hover:text-pulse",
											children: ["Analyse ", /* @__PURE__ */ jsx(ArrowUpRight, { className: "h-3.5 w-3.5" })]
										})
									})
								]
							}, r.symbol);
						}) })]
					})
				})
			}),
			/* @__PURE__ */ jsxs(Panel, {
				kicker: "Ingestion",
				title: "Feed latency",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex h-24 items-end gap-[3px]",
					role: "img",
					"aria-label": "Recent WebSocket round-trip times",
					children: [rtt.length === 0 && /* @__PURE__ */ jsx("p", {
						className: "text-sm text-mute",
						children: "Waiting for the first ping…"
					}), rtt.map((v, i) => {
						const max = Math.max(...rtt, 1);
						return /* @__PURE__ */ jsx("div", {
							className: `flex-1 rounded-t-sm ${v > (feed?.snap.rttAvg ?? 0) * 1.5 ? "bg-heat" : "bg-volt/70"}`,
							style: { height: `${v / max * 100}%` },
							title: `${v.toFixed(0)}ms`
						}, i);
					})]
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-3 text-xs leading-relaxed text-mute",
					children: "Round-trip time from this browser to the broker endpoint, sampled every 5 seconds. The next milestone moves ingestion to a lightweight Node.js worker on a VPS in the region closest to the broker, so the engine receives ticks with consistent, minimal latency regardless of where you are browsing from."
				})]
			})
		]
	});
}
export { ScannerPage as component };
