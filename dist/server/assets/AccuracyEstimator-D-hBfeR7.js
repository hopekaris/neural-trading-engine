import { i as CONTRACT_META, s as estimate } from "./router-CYbkdPpX.js";
import { i as Stat, n as Panel, o as money, s as pct } from "./ui-DkWF3tW-.js";
import { useEffect, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
// src/components/AccuracyEstimator.tsx
function NumField({ label, value, onChange, step = 1, min = 0, suffix }) {
	return /* @__PURE__ */ jsxs("label", {
		className: "block",
		children: [/* @__PURE__ */ jsx("span", {
			className: "label",
			children: label
		}), /* @__PURE__ */ jsxs("span", {
			className: "mt-1 flex items-center rounded-lg border border-line bg-panel-2 focus-within:border-pulse/60",
			children: [/* @__PURE__ */ jsx("input", {
				type: "number",
				value: Number.isFinite(value) ? value : "",
				min,
				step,
				onChange: (e) => onChange(Math.max(min, Number(e.target.value))),
				className: "num w-full bg-transparent px-3 py-2 text-white outline-none"
			}), suffix && /* @__PURE__ */ jsx("span", {
				className: "pr-3 font-mono text-xs text-mute",
				children: suffix
			})]
		})]
	});
}
function AccuracyEstimator({ signal }) {
	const [daily, setDaily] = useState(200);
	const [stake, setStake] = useState(5);
	const [payoutPct, setPayoutPct] = useState(Math.round(signal.payout * 1e3) / 10);
	const [source, setSource] = useState("hc");
	const [manual, setManual] = useState(90);
	useEffect(() => {
		setPayoutPct(Math.round(signal.payout * 1e3) / 10);
	}, [signal.kind, signal.p0]);
	const bt = signal.backtest;
	const hasHc = bt.hcTrades > 0;
	const effective = source === "hc" && !hasHc ? "all" : source;
	const accuracy = effective === "manual" ? manual / 100 : effective === "hc" ? bt.hcWins / bt.hcTrades : bt.trades ? bt.wins / bt.trades : 0;
	const sample = effective === "manual" ? Math.max(1, daily) : effective === "hc" ? bt.hcTrades : bt.trades;
	const r = estimate({
		accuracy,
		sample,
		dailyContracts: daily,
		stake,
		payout: payoutPct / 100
	});
	const positive = r.advantage > 0;
	return /* @__PURE__ */ jsxs(Panel, {
		kicker: "02 · AI accuracy advantage estimator",
		title: `${CONTRACT_META[signal.kind].title} · ${signal.label}`,
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ jsx(NumField, {
						label: "Daily contracts",
						value: daily,
						onChange: (v) => setDaily(Math.round(v)),
						min: 1
					}),
					/* @__PURE__ */ jsx(NumField, {
						label: "Stake per contract",
						value: stake,
						onChange: setStake,
						step: .5,
						min: .35,
						suffix: "USD"
					}),
					/* @__PURE__ */ jsx(NumField, {
						label: "Payout on win",
						value: payoutPct,
						onChange: setPayoutPct,
						step: .1,
						suffix: "%"
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-4",
				children: [
					/* @__PURE__ */ jsx("span", {
						className: "label",
						children: "Accuracy source"
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mt-1.5 flex flex-wrap gap-1 rounded-xl border border-line bg-panel-2 p-1 text-xs",
						children: [
							["hc", `High-confidence backtest${hasHc ? ` (n=${bt.hcTrades})` : " · none yet"}`],
							["all", `All backtest trades (n=${bt.trades})`],
							["manual", "Manual"]
						].map(([k, l]) => /* @__PURE__ */ jsx("button", {
							onClick: () => setSource(k),
							disabled: k === "hc" && !hasHc,
							className: `rounded-lg px-3 py-1.5 transition disabled:opacity-40 ${effective === k ? "bg-pulse/15 text-pulse" : "text-mute hover:text-white"}`,
							children: l
						}, k))
					}),
					effective === "manual" && /* @__PURE__ */ jsx("div", {
						className: "mt-3 max-w-48",
						children: /* @__PURE__ */ jsx(NumField, {
							label: "Assumed accuracy",
							value: manual,
							onChange: (v) => setManual(Math.min(100, v)),
							step: .5,
							suffix: "%"
						})
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ jsx(Stat, {
						label: "Measured accuracy",
						value: pct(accuracy),
						hint: `n = ${sample.toLocaleString()}`
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "High-confidence accuracy",
						value: pct(r.hcAccuracy),
						hint: `95% band ${pct(r.hcAccuracy)}–${pct(r.hcHigh)}`,
						tone: "text-volt"
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Break-even",
						value: pct(r.breakeven),
						hint: `at ${payoutPct}% payout`
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Accuracy advantage",
						value: `${positive ? "+" : ""}${(r.advantage * 100).toFixed(2)} pts`,
						tone: positive ? "text-pulse" : "text-cold",
						hint: positive ? "Edge survives the confidence bound" : "No proven edge at 95% confidence"
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ jsx(Stat, {
						label: "Daily turnover",
						value: money(r.dailyTurnover),
						hint: `${daily} × ${money(stake)}`
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "EV / contract",
						value: money(r.evPerContract),
						tone: r.evPerContract >= 0 ? "text-pulse" : "text-cold"
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Expected daily P&L",
						value: money(r.dailyEv),
						tone: r.dailyEv >= 0 ? "text-pulse" : "text-cold",
						hint: `95% range ${money(r.range[0])} … ${money(r.range[1])}`
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Chance of a losing day",
						value: pct(r.pLosingDay, 0),
						hint: "normal approximation"
					})
				]
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-4 text-xs leading-relaxed text-mute",
				children: "Projections use the lower bound of the accuracy interval, so larger samples earn tighter, more trustworthy estimates. More daily contracts shrink relative variance but magnify any negative edge."
			})
		]
	});
}
export { AccuracyEstimator as t };
