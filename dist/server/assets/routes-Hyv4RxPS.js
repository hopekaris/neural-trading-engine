import { t as AccuracyEstimator } from "./AccuracyEstimator-D-hBfeR7.js";
import { a as DEFAULT_CONFIG, i as CONTRACT_META, n as useAnalysis, r as useFeed, u as MARKET_BY_SYMBOL } from "./router-CYbkdPpX.js";
import { a as bandOf, i as Stat, n as Panel, r as Skeleton, s as pct, t as Meter } from "./ui-DkWF3tW-.js";
import { useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
// src/components/ContractAnalyzer.tsx
function ContractAnalyzer({ signals, cfg, onCfg, active, onSelect }) {
	return /* @__PURE__ */ jsxs(Panel, {
		kicker: "Confidence scoring · multi-contract",
		title: "Contract signals",
		right: /* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-center justify-end gap-2 text-xs",
			children: [/* @__PURE__ */ jsxs("label", {
				className: "flex items-center gap-1.5",
				children: [/* @__PURE__ */ jsx("span", {
					className: "label",
					children: "Lookback"
				}), /* @__PURE__ */ jsx("select", {
					value: cfg.lookback,
					onChange: (e) => onCfg({
						...cfg,
						lookback: Number(e.target.value)
					}),
					className: "num rounded-md border border-line bg-panel-2 px-2 py-1 text-white",
					children: [
						100,
						250,
						500,
						1e3,
						2500
					].map((v) => /* @__PURE__ */ jsx("option", {
						value: v,
						children: v
					}, v))
				})]
			}), /* @__PURE__ */ jsxs("label", {
				className: "flex items-center gap-1.5",
				children: [/* @__PURE__ */ jsx("span", {
					className: "label",
					children: "Barrier"
				}), /* @__PURE__ */ jsx("select", {
					value: cfg.barrier,
					onChange: (e) => onCfg({
						...cfg,
						barrier: Number(e.target.value)
					}),
					className: "num rounded-md border border-line bg-panel-2 px-2 py-1 text-white",
					children: [
						1,
						2,
						3,
						4,
						5,
						6,
						7,
						8
					].map((v) => /* @__PURE__ */ jsx("option", {
						value: v,
						children: v
					}, v))
				})]
			})]
		}),
		children: [/* @__PURE__ */ jsxs("div", {
			className: "mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel-2/60 px-4 py-3",
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "label",
					children: "High-confidence band"
				}),
				/* @__PURE__ */ jsx("input", {
					type: "range",
					min: 87,
					max: 98,
					value: cfg.threshold,
					onChange: (e) => onCfg({
						...cfg,
						threshold: Number(e.target.value)
					}),
					className: "flex-1 accent-[#3cf2c0]",
					"aria-label": "High-confidence threshold"
				}),
				/* @__PURE__ */ jsxs("span", {
					className: "num text-sm text-pulse",
					children: ["≥ ", cfg.threshold]
				}),
				/* @__PURE__ */ jsx("span", {
					className: "w-full text-xs text-mute",
					children: "Signals scoring inside the 87–98 band are flagged HIGH. The backtest reports how those flagged trades actually settled on the historical ticks."
				})
			]
		}), /* @__PURE__ */ jsxs("div", {
			className: "grid gap-3 md:grid-cols-2 xl:grid-cols-3",
			children: [signals.map((s) => {
				const meta = CONTRACT_META[s.kind];
				const band = bandOf(s.confidence, cfg.threshold);
				const acc = s.backtest.trades ? s.backtest.wins / s.backtest.trades : 0;
				const hcAcc = s.backtest.hcTrades ? s.backtest.hcWins / s.backtest.hcTrades : null;
				const edge = acc - s.breakeven;
				const on = active === s.kind;
				return /* @__PURE__ */ jsxs("button", {
					onClick: () => onSelect(s.kind),
					"aria-pressed": on,
					className: `group rounded-xl border p-4 text-left transition ${on ? "border-pulse/60 bg-pulse/[0.06] ring-1 ring-pulse/30" : "border-line bg-panel-2/50 hover:border-soft/30"}`,
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ jsx("p", {
								className: "label",
								children: meta.title
							}), /* @__PURE__ */ jsx("span", {
								className: `font-mono text-[10px] font-bold tracking-widest ${band.cls}`,
								children: band.name
							})]
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-2 text-2xl font-bold tracking-tight text-white",
							children: s.label
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-3 flex items-center gap-3",
							children: [/* @__PURE__ */ jsx(Meter, {
								value: s.confidence,
								threshold: cfg.threshold
							}), /* @__PURE__ */ jsx("span", {
								className: `num w-12 text-right text-sm font-semibold ${band.cls}`,
								children: s.confidence.toFixed(0)
							})]
						}),
						/* @__PURE__ */ jsxs("dl", {
							className: "mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[11px]",
							children: [
								/* @__PURE__ */ jsx("dt", {
									className: "text-mute",
									children: "observed"
								}),
								/* @__PURE__ */ jsxs("dd", {
									className: "text-right text-soft",
									children: [
										pct(s.observed),
										" ",
										/* @__PURE__ */ jsxs("span", {
											className: "text-mute",
											children: ["/ ", pct(s.p0, 0)]
										})
									]
								}),
								/* @__PURE__ */ jsx("dt", {
									className: "text-mute",
									children: "backtest"
								}),
								/* @__PURE__ */ jsxs("dd", {
									className: "text-right text-soft",
									children: [
										pct(acc),
										" ",
										/* @__PURE__ */ jsxs("span", {
											className: "text-mute",
											children: ["n=", s.backtest.trades]
										})
									]
								}),
								/* @__PURE__ */ jsx("dt", {
									className: "text-mute",
									children: "HC trades"
								}),
								/* @__PURE__ */ jsxs("dd", {
									className: "text-right text-soft",
									children: [
										hcAcc == null ? "—" : pct(hcAcc),
										" ",
										/* @__PURE__ */ jsxs("span", {
											className: "text-mute",
											children: ["n=", s.backtest.hcTrades]
										})
									]
								}),
								/* @__PURE__ */ jsx("dt", {
									className: "text-mute",
									children: "break-even"
								}),
								/* @__PURE__ */ jsx("dd", {
									className: "text-right text-soft",
									children: pct(s.breakeven)
								}),
								/* @__PURE__ */ jsx("dt", {
									className: "text-mute",
									children: "edge"
								}),
								/* @__PURE__ */ jsxs("dd", {
									className: `text-right ${edge > 0 ? "text-pulse" : "text-cold"}`,
									children: [
										edge > 0 ? "+" : "",
										(edge * 100).toFixed(2),
										" pts"
									]
								})
							]
						})
					]
				}, s.kind);
			}), /* @__PURE__ */ jsxs("div", {
				className: "rounded-xl border border-dashed border-line p-4 text-xs leading-relaxed text-mute",
				children: [/* @__PURE__ */ jsx("p", {
					className: "label mb-2",
					children: "How scores work"
				}), "Each signal compares the recommended side's hit-rate over the lookback window with its fair odds. The confidence score is the statistical significance of that gap (Bonferroni-adjusted for Matches/Differs). Edge is backtested accuracy minus the payout's break-even rate."]
			})]
		})]
	});
}
// src/components/PatternPanel.tsx
function PatternPanel({ pattern }) {
	const maxP = Math.max(.15, ...pattern.next);
	return /* @__PURE__ */ jsxs(Panel, {
		kicker: "Pattern recognition",
		title: "Digit transition map",
		children: [
			/* @__PURE__ */ jsxs("p", {
				className: "text-sm text-mute",
				children: [
					"What has followed a",
					" ",
					/* @__PURE__ */ jsx("span", {
						className: "num font-semibold text-white",
						children: pattern.last
					}),
					" ",
					"across the window (",
					pattern.nextSamples,
					" samples)."
				]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "mt-4 space-y-1.5",
				children: pattern.next.map((p, d) => /* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "num w-4 text-xs text-white",
							children: d
						}),
						/* @__PURE__ */ jsx("div", {
							className: "h-3 flex-1 rounded-full bg-line",
							children: /* @__PURE__ */ jsx("div", {
								className: `h-full rounded-full ${p > .1 ? "bg-pulse" : "bg-volt/60"}`,
								style: { width: `${p / maxP * 100}%` }
							})
						}),
						/* @__PURE__ */ jsx("span", {
							className: "num w-12 text-right text-xs text-soft",
							children: pct(p)
						})
					]
				}, d))
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-5 grid grid-cols-2 gap-2",
				children: [
					/* @__PURE__ */ jsx(Stat, {
						label: "Parity streak",
						value: `${pattern.parityStreak.length}× ${pattern.parityStreak.parity}`,
						hint: `longest in window: ${pattern.longestParityStreak}`
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Repeat rate",
						value: pct(pattern.repeatRate),
						hint: "same digit twice · fair 10%"
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Strongest link",
						value: `${pattern.strongest.from} → ${pattern.strongest.to}`,
						hint: `${pct(pattern.strongest.p)} · z ${pattern.strongest.z.toFixed(2)}`,
						tone: "text-volt"
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Transitions",
						value: "100",
						hint: "10 × 10 Markov matrix"
					})
				]
			})
		]
	});
}
// src/components/ProbabilityEngine.tsx
function ProbabilityEngine({ stats }) {
	const top = Math.max(14, ...stats.pct.map((p) => Math.ceil(p + 1)));
	const zMax = Math.max(3, ...stats.z.map((z) => Math.abs(z)));
	const significant = stats.pValue < .05;
	return /* @__PURE__ */ jsxs(Panel, {
		kicker: "01 · Probability engine",
		title: "Neural digit skew",
		right: /* @__PURE__ */ jsxs("span", {
			className: "num rounded-lg border border-line px-2.5 py-1 text-xs text-soft",
			children: [stats.n.toLocaleString(), " ticks"]
		}),
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "grid grid-cols-10 items-end gap-1.5 sm:gap-2",
				style: { height: 200 },
				role: "img",
				"aria-label": "Last-digit distribution over the analysed window",
				children: stats.pct.map((p, d) => {
					const isHot = d === stats.hot;
					const isCold = d === stats.cold;
					return /* @__PURE__ */ jsxs("div", {
						className: "relative flex h-full flex-col justify-end",
						children: [/* @__PURE__ */ jsx("span", {
							className: `num mb-1 text-center text-[10px] sm:text-[11px] ${isHot ? "text-heat" : isCold ? "text-cold" : "text-soft"}`,
							children: p.toFixed(1)
						}), /* @__PURE__ */ jsx("div", {
							className: `rounded-t-md transition-all duration-500 ${isHot ? "bg-heat" : isCold ? "bg-cold" : "bg-gradient-to-t from-pulse-dim to-pulse"}`,
							style: { height: `${p / top * 100}%` }
						})]
					}, d);
				})
			}),
			/* @__PURE__ */ jsx("div", {
				className: "relative -mt-[1px] grid grid-cols-10 gap-1.5 border-t border-dashed border-white/40 pt-2 sm:gap-2",
				children: stats.counts.map((c, d) => /* @__PURE__ */ jsxs("div", {
					className: "text-center",
					children: [/* @__PURE__ */ jsx("p", {
						className: "num text-base font-bold text-white",
						children: d
					}), /* @__PURE__ */ jsx("p", {
						className: "num text-[10px] text-mute",
						children: c
					})]
				}, d))
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-1 text-right font-mono text-[10px] text-mute",
				children: "dashed line = baseline · uniform expectation 10.0%"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-5",
				children: [/* @__PURE__ */ jsx("p", {
					className: "label mb-2",
					children: "Deviation from fair (z-score)"
				}), /* @__PURE__ */ jsx("div", {
					className: "grid grid-cols-10 gap-1.5 sm:gap-2",
					children: stats.z.map((z, d) => /* @__PURE__ */ jsxs("div", {
						className: "relative h-14 rounded-md bg-panel-2",
						title: `Digit ${d}: z = ${z.toFixed(2)}`,
						children: [
							/* @__PURE__ */ jsx("div", { className: "absolute inset-x-0 top-1/2 h-px bg-line" }),
							/* @__PURE__ */ jsx("div", {
								className: `absolute inset-x-1 rounded-sm ${z >= 0 ? "bg-heat/80" : "bg-cold/80"}`,
								style: z >= 0 ? {
									bottom: "50%",
									height: `${z / zMax * 50}%`
								} : {
									top: "50%",
									height: `${-z / zMax * 50}%`
								}
							}),
							/* @__PURE__ */ jsx("span", {
								className: "num absolute inset-x-0 bottom-0.5 text-center text-[9px] text-soft",
								children: z.toFixed(1)
							})
						]
					}, d))
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ jsx(Stat, {
						label: "Hot digit",
						value: stats.hot,
						tone: "text-heat",
						hint: `${stats.pct[stats.hot].toFixed(2)}% · z ${stats.z[stats.hot].toFixed(2)}`
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Cold digit",
						value: stats.cold,
						tone: "text-cold",
						hint: `${stats.pct[stats.cold].toFixed(2)}% · z ${stats.z[stats.cold].toFixed(2)}`
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "χ² (df 9)",
						value: stats.chi2.toFixed(2),
						hint: `p = ${stats.pValue.toFixed(3)}`,
						tone: significant ? "text-pulse" : "text-white"
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Skew index",
						value: stats.skew.toFixed(3),
						hint: significant ? "Distribution is skewed" : "Within random variation"
					})
				]
			})
		]
	});
}
// src/components/TickTape.tsx
function Sparkline({ prices }) {
	const pts = prices.slice(-160);
	if (pts.length < 2) return null;
	const min = Math.min(...pts);
	const span = Math.max(...pts) - min || 1;
	const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${(i / (pts.length - 1) * 100).toFixed(2)},${(36 - (p - min) / span * 32 - 2).toFixed(2)}`).join(" ");
	return /* @__PURE__ */ jsxs("svg", {
		viewBox: "0 0 100 36",
		preserveAspectRatio: "none",
		className: "h-20 w-full",
		role: "img",
		"aria-label": "Recent price path",
		children: [
			/* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", {
				id: "spark",
				x1: "0",
				x2: "0",
				y1: "0",
				y2: "1",
				children: [/* @__PURE__ */ jsx("stop", {
					offset: "0%",
					stopColor: "#3cf2c0",
					stopOpacity: "0.35"
				}), /* @__PURE__ */ jsx("stop", {
					offset: "100%",
					stopColor: "#3cf2c0",
					stopOpacity: "0"
				})]
			}) }),
			/* @__PURE__ */ jsx("path", {
				d: `${d} L100,36 L0,36 Z`,
				fill: "url(#spark)"
			}),
			/* @__PURE__ */ jsx("path", {
				d,
				fill: "none",
				stroke: "#3cf2c0",
				strokeWidth: "1.2",
				vectorEffect: "non-scaling-stroke"
			})
		]
	});
}
function TickTape({ series, market, micros }) {
	const n = series.prices.length;
	const price = series.prices[n - 1];
	const prev = series.prices[n - 2];
	const digit = series.digits[n - 1];
	const tape = series.digits.slice(-36);
	const up = price >= prev;
	return /* @__PURE__ */ jsx("section", {
		className: "panel overflow-hidden",
		children: /* @__PURE__ */ jsxs("div", {
			className: "grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "border-b border-line p-5 lg:border-b-0 lg:border-r",
				children: [
					/* @__PURE__ */ jsxs("p", {
						className: "label",
						children: [
							market.name,
							" · ",
							market.symbol
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-2 flex items-end gap-4",
						children: [/* @__PURE__ */ jsx("p", {
							className: `num text-4xl font-bold tracking-tight ${up ? "text-pulse" : "text-cold"}`,
							children: price?.toFixed(series.pip)
						}), /* @__PURE__ */ jsx("div", {
							className: "blip grid h-14 w-14 place-items-center rounded-2xl border border-pulse/50 bg-panel-2 text-3xl font-bold text-white num",
							title: "Last digit",
							children: digit
						}, series.liveTicks)]
					}),
					/* @__PURE__ */ jsx(Sparkline, { prices: series.prices })
				]
			}), /* @__PURE__ */ jsxs("div", {
				className: "p-5",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ jsx("p", {
							className: "label",
							children: "Live digit tape · newest right"
						}), /* @__PURE__ */ jsxs("p", {
							className: "label",
							children: [series.liveTicks, " streamed this session"]
						})]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mt-3 flex flex-wrap gap-1",
						children: tape.map((d, i) => /* @__PURE__ */ jsx("span", {
							className: `num grid h-7 w-7 place-items-center rounded-md text-xs font-semibold ${i === tape.length - 1 ? "bg-pulse text-ink" : d % 2 === 0 ? "bg-volt/15 text-volt" : "bg-heat/10 text-heat"}`,
							children: d
						}, `${series.liveTicks}-${i}`))
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "mt-2 font-mono text-[10px] text-mute",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "text-volt",
								children: "■"
							}),
							" even",
							" ",
							/* @__PURE__ */ jsx("span", {
								className: "ml-2 text-heat",
								children: "■"
							}),
							" odd"
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-4 grid grid-cols-3 gap-2",
						children: [
							/* @__PURE__ */ jsx(Stat, {
								label: "Window",
								value: `${n.toLocaleString()}`,
								hint: "of 5,000 ticks"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Analysis",
								value: `${micros.toFixed(0)}µs`,
								hint: "per tick, in-browser"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Pip size",
								value: series.pip,
								hint: `${market.cadence}s tick cadence`
							})
						]
					})
				]
			})]
		})
	});
}
// src/routes/index.tsx?tsr-split=component
function EnginePage() {
	const { feed } = useFeed();
	const [cfg, setCfg] = useState(DEFAULT_CONFIG);
	const [active, setActive] = useState("even_odd");
	const focus = feed?.snap.focus;
	const series = focus ? feed?.series.get(focus) : void 0;
	const analysis = useAnalysis(series?.loaded ? series : void 0, cfg);
	const market = focus ? MARKET_BY_SYMBOL[focus] : void 0;
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-end justify-between gap-4",
				children: [/* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx("p", {
						className: "label text-pulse",
						children: "Neural engine · active"
					}),
					/* @__PURE__ */ jsx("h1", {
						className: "mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl",
						children: "Precision digit analysis"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-1 max-w-2xl text-sm text-mute",
						children: "Every tick re-scores the last 5,000 digits, the pattern map, and five contract signals for the focused market."
					})
				] }), /* @__PURE__ */ jsx("div", {
					className: "flex flex-wrap gap-1 rounded-xl border border-line bg-panel p-1",
					children: feed?.snap.selected.map((s) => /* @__PURE__ */ jsx("button", {
						onClick: () => feed.setFocus(s),
						className: `rounded-lg px-3 py-1.5 font-mono text-xs transition ${s === focus ? "bg-pulse text-ink" : "text-mute hover:text-white"}`,
						children: MARKET_BY_SYMBOL[s]?.short ?? s
					}, s))
				})]
			}),
			series?.error && /* @__PURE__ */ jsxs("p", {
				className: "rounded-xl border border-cold/40 bg-cold/10 px-4 py-3 text-sm text-cold",
				children: [
					"Feed error for ",
					focus,
					": ",
					series.error
				]
			}),
			!analysis || !series || !market ? /* @__PURE__ */ jsxs("div", {
				className: "space-y-6",
				"aria-busy": "true",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "font-mono text-xs text-mute",
						children: "Loading 5,000-tick history…"
					}),
					/* @__PURE__ */ jsx(Skeleton, { className: "h-48" }),
					/* @__PURE__ */ jsxs("div", {
						className: "grid gap-6 lg:grid-cols-[1.6fr_1fr]",
						children: [/* @__PURE__ */ jsx(Skeleton, { className: "h-96" }), /* @__PURE__ */ jsx(Skeleton, { className: "h-96" })]
					})
				]
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsx(TickTape, {
					series,
					market,
					micros: analysis.micros
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]",
					children: [/* @__PURE__ */ jsx(ProbabilityEngine, { stats: analysis.stats }), /* @__PURE__ */ jsx(PatternPanel, { pattern: analysis.pattern })]
				}),
				/* @__PURE__ */ jsx(ContractAnalyzer, {
					signals: analysis.signals,
					cfg,
					onCfg: setCfg,
					active,
					onSelect: setActive
				}),
				/* @__PURE__ */ jsx(AccuracyEstimator, { signal: analysis.signals.find((s) => s.kind === active) })
			] })
		]
	});
}
export { EnginePage as component };
