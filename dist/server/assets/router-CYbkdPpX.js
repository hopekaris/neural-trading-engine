import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { HeadContent, Link, Outlet, Scripts, createFileRoute, createRootRoute, createRouter, lazyRouteComponent } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { Activity, Cpu, Radar, Radio, Target, Zap } from "lucide-react";
// \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
// src/lib/markets.ts
var MARKETS = [
	{
		symbol: "R_10",
		name: "Volatility 10 Index",
		short: "V10",
		pip: 3,
		cadence: 2
	},
	{
		symbol: "R_25",
		name: "Volatility 25 Index",
		short: "V25",
		pip: 3,
		cadence: 2
	},
	{
		symbol: "R_50",
		name: "Volatility 50 Index",
		short: "V50",
		pip: 4,
		cadence: 2
	},
	{
		symbol: "R_75",
		name: "Volatility 75 Index",
		short: "V75",
		pip: 4,
		cadence: 2
	},
	{
		symbol: "R_100",
		name: "Volatility 100 Index",
		short: "V100",
		pip: 2,
		cadence: 2
	},
	{
		symbol: "1HZ10V",
		name: "Volatility 10 (1s) Index",
		short: "V10·1s",
		pip: 2,
		cadence: 1
	},
	{
		symbol: "1HZ25V",
		name: "Volatility 25 (1s) Index",
		short: "V25·1s",
		pip: 2,
		cadence: 1
	},
	{
		symbol: "1HZ50V",
		name: "Volatility 50 (1s) Index",
		short: "V50·1s",
		pip: 2,
		cadence: 1
	},
	{
		symbol: "1HZ75V",
		name: "Volatility 75 (1s) Index",
		short: "V75·1s",
		pip: 2,
		cadence: 1
	},
	{
		symbol: "1HZ100V",
		name: "Volatility 100 (1s) Index",
		short: "V100·1s",
		pip: 2,
		cadence: 1
	}
];
var MARKET_BY_SYMBOL = Object.fromEntries(MARKETS.map((m) => [m.symbol, m]));
var DEFAULT_SELECTED = [
	"R_10",
	"R_50",
	"R_100",
	"1HZ10V",
	"1HZ100V"
];
/** Rolling window the probability engine analyses. */
var WINDOW = 5e3;
/**
* Public Deriv WebSocket endpoints, tried in order. The first is Deriv's
* current public market-data channel (no auth). The legacy v3 endpoint is kept
* as a fallback only, because it now rejects handshakes.
*/
var FEED_URLS = ["wss://api.derivws.com/trading/v1/options/ws/public", "wss://ws.derivws.com/websockets/v3?app_id=1089"];
/** The venue returns at most this many ticks per `ticks_history` request. */
var HISTORY_PAGE = 1e3;
// src/lib/engine.ts
var DEFAULT_CONFIG = {
	lookback: 1e3,
	barrier: 4,
	threshold: 87
};
function lastDigit(price, pip) {
	return Math.round(price * 10 ** pip) % 10;
}
function normalCdf(x) {
	const t = 1 / (1 + .3275911 * Math.abs(x) / Math.SQRT2);
	const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-(x * x) / 2);
	return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}
function logGamma(x) {
	const c = [
		76.18009172947146,
		-86.50532032941678,
		24.01409824083091,
		-1.231739572450155,
		.001208650973866179,
		-5395239384953e-18
	];
	let y = x;
	const tmp = x + 5.5 - (x + .5) * Math.log(x + 5.5);
	let ser = 1.000000000190015;
	for (const v of c) ser += v / ++y;
	return -tmp + Math.log(2.5066282746310007 * ser / x);
}
/** Regularised upper incomplete gamma Q(a, x). */
function gammaQ(a, x) {
	if (x <= 0) return 1;
	if (x < a + 1) {
		let sum = 1 / a;
		let del = sum;
		let ap = a;
		for (let i = 0; i < 200; i++) {
			del *= x / ++ap;
			sum += del;
			if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
		}
		return 1 - sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
	}
	let b = x + 1 - a;
	let c = 1e300;
	let d = 1 / b;
	let h = d;
	for (let i = 1; i < 200; i++) {
		const an = -i * (i - a);
		b += 2;
		d = an * d + b;
		if (Math.abs(d) < 1e-300) d = 1e-300;
		c = b + an / c;
		if (Math.abs(c) < 1e-300) c = 1e-300;
		d = 1 / d;
		const del = d * c;
		h *= del;
		if (Math.abs(del - 1) < 1e-12) break;
	}
	return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}
function chiSquarePValue(chi2, df) {
	return gammaQ(df / 2, chi2 / 2);
}
/** Two-sided confidence (0–100) that a z-score is not noise, with optional Bonferroni correction. */
function zConfidence(z, comparisons = 1) {
	const p = 2 * (1 - normalCdf(Math.abs(z)));
	return Math.max(0, 1 - Math.min(1, p * comparisons)) * 100;
}
function proportionZ(hits, n, p0) {
	if (n === 0) return 0;
	return (hits / n - p0) / Math.sqrt(p0 * (1 - p0) / n);
}
/** Wilson score interval for a binomial proportion. */
function wilson(wins, n, z = 1.96) {
	if (n === 0) return {
		low: 0,
		high: 1
	};
	const p = wins / n;
	const denom = 1 + z * z / n;
	const centre = p + z * z / (2 * n);
	const spread = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
	return {
		low: (centre - spread) / denom,
		high: (centre + spread) / denom
	};
}
function payoutFor(p0) {
	return 1 / p0 * .977 - 1;
}
function breakevenFor(payout) {
	return 1 / (1 + payout);
}
function digitStats(digits) {
	const n = digits.length;
	const counts = new Array(10).fill(0);
	for (const d of digits) counts[d]++;
	const e = n / 10;
	const sd = Math.sqrt(n * .1 * .9) || 1;
	let chi2 = 0;
	let H = 0;
	const pct = counts.map((c) => n ? c / n * 100 : 0);
	const z = counts.map((c) => (c - e) / sd);
	for (const c of counts) {
		if (e > 0) chi2 += (c - e) * (c - e) / e;
		if (c > 0) H -= c / n * Math.log(c / n);
	}
	const entropy = n ? H / Math.log(10) : 1;
	let hot = 0;
	let cold = 0;
	counts.forEach((c, i) => {
		if (c > counts[hot]) hot = i;
		if (c < counts[cold]) cold = i;
	});
	return {
		n,
		counts,
		pct,
		z,
		chi2,
		pValue: n ? chiSquarePValue(chi2, 9) : 1,
		skew: (1 - entropy) * 1e3,
		entropy,
		hot,
		cold
	};
}
function patternStats(digits) {
	const trans = Array.from({ length: 10 }, () => new Array(10).fill(0));
	const rows = new Array(10).fill(0);
	let repeats = 0;
	let longest = 0;
	let run = 0;
	for (let i = 1; i < digits.length; i++) {
		const a = digits[i - 1];
		const b = digits[i];
		trans[a][b]++;
		rows[a]++;
		if (a === b) repeats++;
		if (a % 2 === b % 2) run++;
		else run = 0;
		if (run + 1 > longest) longest = run + 1;
	}
	let strongest = {
		from: 0,
		to: 0,
		p: .1,
		z: 0
	};
	for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) {
		const z = proportionZ(trans[a][b], rows[a], .1);
		if (Math.abs(z) > Math.abs(strongest.z)) strongest = {
			from: a,
			to: b,
			p: rows[a] ? trans[a][b] / rows[a] : 0,
			z
		};
	}
	const last = digits[digits.length - 1] ?? 0;
	const lastParity = last % 2;
	let streak = 0;
	for (let i = digits.length - 1; i >= 0 && digits[i] % 2 === lastParity; i--) streak++;
	return {
		last,
		next: trans[last].map((c) => rows[last] ? c / rows[last] : .1),
		nextSamples: rows[last],
		strongest,
		parityStreak: {
			parity: lastParity ? "ODD" : "EVEN",
			length: streak
		},
		longestParityStreak: longest,
		repeatRate: digits.length > 1 ? repeats / (digits.length - 1) : 0
	};
}
function argMax(a) {
	let k = 0;
	for (let i = 1; i < a.length; i++) if (a[i] > a[k]) k = i;
	return k;
}
function argMin(a) {
	let k = 0;
	for (let i = 1; i < a.length; i++) if (a[i] < a[k]) k = i;
	return k;
}
/** Builds every contract decision from rolling digit counts and the up-move count. */
function decide(counts, ups, W, barrier) {
	const top = argMax(counts);
	const bottom = argMin(counts);
	const even = counts[0] + counts[2] + counts[4] + counts[6] + counts[8];
	const odd = W - even;
	let over = 0;
	let under = 0;
	for (let d = 0; d < 10; d++) {
		if (d > barrier) over += counts[d];
		if (d < barrier) under += counts[d];
	}
	const pOver = (9 - barrier) / 10;
	const pUnder = barrier / 10;
	const zOver = proportionZ(over, W, pOver);
	const zUnder = proportionZ(under, W, pUnder);
	const pickOver = zOver >= zUnder;
	const isEven = even >= odd;
	const rise = ups * 2 >= W;
	return {
		matches: {
			label: `MATCH ${top}`,
			p0: .1,
			hits: counts[top],
			z: proportionZ(counts[top], W, .1),
			comparisons: 10,
			wins: (d) => d === top
		},
		differs: {
			label: `DIFFER ${bottom}`,
			p0: .9,
			hits: W - counts[bottom],
			z: proportionZ(W - counts[bottom], W, .9),
			comparisons: 10,
			wins: (d) => d !== bottom
		},
		even_odd: {
			label: isEven ? "EVEN" : "ODD",
			p0: .5,
			hits: isEven ? even : odd,
			z: proportionZ(isEven ? even : odd, W, .5),
			comparisons: 1,
			wins: (d) => d % 2 === 0 === isEven
		},
		over_under: {
			label: pickOver ? `OVER ${barrier}` : `UNDER ${barrier}`,
			p0: pickOver ? pOver : pUnder,
			hits: pickOver ? over : under,
			z: pickOver ? zOver : zUnder,
			comparisons: 2,
			wins: (d) => pickOver ? d > barrier : d < barrier
		},
		rise_fall: {
			label: rise ? "RISE" : "FALL",
			p0: .5,
			hits: rise ? ups : W - ups,
			z: proportionZ(rise ? ups : W - ups, W, .5),
			comparisons: 1,
			wins: (_d, m) => rise ? m > 0 : m < 0
		}
	};
}
var KINDS = [
	"matches",
	"differs",
	"even_odd",
	"over_under",
	"rise_fall"
];
function contractSignals(digits, prices, cfg) {
	const n = digits.length;
	const W = Math.max(50, Math.min(cfg.lookback, n - 1));
	const counts = new Array(10).fill(0);
	const move = (i) => i > 0 ? Math.sign(prices[i] - prices[i - 1]) : 0;
	let ups = 0;
	const bt = Object.fromEntries(KINDS.map((k) => [k, {
		trades: 0,
		wins: 0,
		hcTrades: 0,
		hcWins: 0
	}]));
	if (n > W) {
		for (let i = 0; i < W; i++) {
			counts[digits[i]]++;
			if (move(i) > 0) ups++;
		}
		for (let t = W; t < n; t++) {
			const dec = decide(counts, ups, W, cfg.barrier);
			const m = move(t);
			for (const k of KINDS) {
				const d = dec[k];
				const win = d.wins(digits[t], m);
				const b = bt[k];
				b.trades++;
				if (win) b.wins++;
				if (d.z > 0 && zConfidence(d.z, d.comparisons) >= cfg.threshold) {
					b.hcTrades++;
					if (win) b.hcWins++;
				}
			}
			counts[digits[t]]++;
			counts[digits[t - W]]--;
			if (m > 0) ups++;
			if (move(t - W) > 0) ups--;
		}
	} else for (let i = 0; i < n; i++) {
		counts[digits[i]]++;
		if (move(i) > 0) ups++;
	}
	const live = decide(counts, ups, Math.max(1, Math.min(W, n)), cfg.barrier);
	return KINDS.map((kind) => {
		const d = live[kind];
		const payout = payoutFor(d.p0);
		const win = Math.max(1, Math.min(W, n));
		return {
			kind,
			label: d.label,
			p0: d.p0,
			observed: d.hits / win,
			z: d.z,
			confidence: d.z > 0 ? zConfidence(d.z, d.comparisons) : 0,
			payout,
			breakeven: breakevenFor(payout),
			backtest: bt[kind]
		};
	});
}
function analyze(digits, prices, cfg) {
	const t0 = performance.now();
	return {
		stats: digitStats(digits),
		signals: contractSignals(digits, prices, cfg),
		pattern: patternStats(digits),
		micros: (performance.now() - t0) * 1e3
	};
}
function estimate(i) {
	const { low, high } = wilson(Math.round(i.accuracy * i.sample), i.sample);
	const breakeven = breakevenFor(i.payout);
	const p = low;
	const ev = p * i.payout * i.stake - (1 - p) * i.stake;
	const dailyEv = ev * i.dailyContracts;
	const dailyStd = i.stake * (1 + i.payout) * Math.sqrt(p * (1 - p)) * Math.sqrt(i.dailyContracts);
	return {
		breakeven,
		hcAccuracy: low,
		hcHigh: high,
		advantage: low - breakeven,
		evPerContract: ev,
		dailyEv,
		dailyStd,
		range: [dailyEv - 1.96 * dailyStd, dailyEv + 1.96 * dailyStd],
		pLosingDay: dailyStd > 0 ? normalCdf(-dailyEv / dailyStd) : dailyEv < 0 ? 1 : 0,
		dailyTurnover: i.stake * i.dailyContracts
	};
}
var CONTRACT_META = {
	matches: {
		title: "Matches",
		family: "Matches / Differs",
		blurb: "Last digit equals the predicted digit. Fair odds 1 in 10."
	},
	differs: {
		title: "Differs",
		family: "Matches / Differs",
		blurb: "Last digit is anything except the predicted digit. Fair odds 9 in 10."
	},
	even_odd: {
		title: "Even / Odd",
		family: "Even / Odd",
		blurb: "Parity of the settling last digit. Fair odds 1 in 2."
	},
	over_under: {
		title: "Over / Under",
		family: "Over / Under",
		blurb: "Last digit strictly above or below the barrier."
	},
	rise_fall: {
		title: "Rise / Fall",
		family: "Rise / Fall",
		blurb: "Direction of the next tick versus the current spot."
	}
};
var SHORT_W = 100;
var LONG_W = 1e3;
var MATCH_METHODS = [
	"ensemble",
	"hot100",
	"hot1000",
	"markov"
];
/**
* Predicts the next last digit for a Matches contract and walk-forward
* backtests every method over the series, so each pick carries its own
* record of how often that rule has actually matched.
*/
function matchesPredict(digits, threshold = DEFAULT_CONFIG.threshold, recentCount = 24) {
	const n = digits.length;
	const short = new Array(10).fill(0);
	const long = new Array(10).fill(0);
	const trans = Array.from({ length: 10 }, () => new Array(10).fill(0));
	const rowSum = new Array(10).fill(0);
	const record = Object.fromEntries(MATCH_METHODS.map((m) => [m, {
		trades: 0,
		wins: 0,
		hcTrades: 0,
		hcWins: 0
	}]));
	const recent = [];
	let ensWins = 0;
	let ensTrades = 0;
	const ensPicks = new Int8Array(n).fill(-1);
	const estimates = (t) => {
		const sN = Math.min(SHORT_W, t);
		const lN = Math.min(LONG_W, t);
		const prev = t > 0 ? digits[t - 1] : 0;
		const rs = rowSum[prev];
		const s = [];
		const l = [];
		const m = [];
		const e = [];
		for (let d = 0; d < 10; d++) {
			s[d] = (short[d] + 1) / (sN + 10);
			l[d] = (long[d] + 1) / (lN + 10);
			m[d] = (trans[prev][d] + 1) / (rs + 10);
			e[d] = (s[d] + l[d] + m[d]) / 3;
		}
		return {
			s,
			l,
			m,
			e
		};
	};
	const advance = (t) => {
		const d = digits[t];
		short[d]++;
		long[d]++;
		if (t - SHORT_W >= 0) short[digits[t - SHORT_W]]--;
		if (t - LONG_W >= 0) long[digits[t - LONG_W]]--;
		if (t >= 1) {
			trans[digits[t - 1]][d]++;
			rowSum[digits[t - 1]]++;
		}
		const drop = t - LONG_W + 1;
		if (drop >= 1) {
			trans[digits[drop - 1]][digits[drop]]--;
			rowSum[digits[drop - 1]]--;
		}
	};
	const warmup = Math.min(SHORT_W, n);
	for (let t = 0; t < warmup; t++) advance(t);
	for (let t = warmup; t < n; t++) {
		const { s, l, m, e } = estimates(t);
		const picks = {
			ensemble: argMax(e),
			hot100: argMax(s),
			hot1000: argMax(l),
			markov: argMax(m)
		};
		const actual = digits[t];
		ensPicks[t] = picks.ensemble;
		for (const k of MATCH_METHODS) {
			const r = record[k];
			r.trades++;
			if (picks[k] === actual) r.wins++;
		}
		if (ensTrades >= 100) {
			const z = proportionZ(ensWins, ensTrades, .1);
			if (z > 0 && zConfidence(z) >= threshold) {
				record.ensemble.hcTrades++;
				if (picks.ensemble === actual) record.ensemble.hcWins++;
			}
		}
		ensTrades++;
		if (picks.ensemble === actual) ensWins++;
		if (t >= n - recentCount) recent.push({
			predicted: picks.ensemble,
			actual
		});
		advance(t);
	}
	const { s, l, m, e } = estimates(n);
	const gap = new Array(10).fill(n);
	for (let i = n - 1, seen = 0; i >= 0 && seen < 10; i--) if (gap[digits[i]] === n) {
		gap[digits[i]] = n - 1 - i;
		seen++;
	}
	const rows = Array.from({ length: 10 }, (_, d) => ({
		digit: d,
		short: s[d],
		long: l[d],
		markov: m[d],
		score: e[d],
		gap: gap[d]
	}));
	const livePicks = {
		ensemble: argMax(e),
		hot100: argMax(s),
		hot1000: argMax(l),
		markov: argMax(m)
	};
	const methods = MATCH_METHODS.map((method) => {
		const r = record[method];
		const z = proportionZ(r.wins, r.trades, .1);
		const ci = wilson(r.wins, r.trades);
		return {
			method,
			pick: livePicks[method],
			trades: r.trades,
			wins: r.wins,
			hitRate: r.trades ? r.wins / r.trades : 0,
			low: ci.low,
			high: ci.high,
			z,
			significance: z > 0 ? zConfidence(z) : 0
		};
	});
	const ens = methods[0];
	const digit = livePicks.ensemble;
	const payout = payoutFor(.1);
	return {
		digit,
		score: e[digit],
		last: n ? digits[n - 1] : 0,
		rows,
		methods,
		consensus: [
			livePicks.hot100,
			livePicks.hot1000,
			livePicks.markov
		].filter((p) => p === digit).length,
		recent,
		signal: {
			kind: "matches",
			label: `MATCH ${digit}`,
			p0: .1,
			observed: ens.hitRate,
			z: ens.z,
			confidence: ens.significance,
			payout,
			breakeven: breakevenFor(payout),
			backtest: record.ensemble
		},
		picks: ensPicks
	};
}
/**
* Walk-forward test of holding one Matches digit for a fixed time window.
* Each window locks the pick decided before its first tick, then settles every
* tick whose epoch falls within `windowSec` of that first tick. Windows do not overlap.
*/
function matchesWindowBacktest(digits, times, picks, windowSec) {
	const n = Math.min(digits.length, times.length, picks.length);
	let windows = 0;
	let windowsHit = 0;
	let expectedHit = 0;
	let ticks = 0;
	let tickHits = 0;
	let t = 0;
	while (t < n && picks[t] < 0) t++;
	while (t < n) {
		const end = times[t] + windowSec;
		let j = t;
		while (j < n && times[j] < end) j++;
		if (j >= n) break;
		const pick = picks[t];
		let hits = 0;
		for (let i = t; i < j; i++) if (digits[i] === pick) hits++;
		const k = j - t;
		windows++;
		ticks += k;
		tickHits += hits;
		if (hits > 0) windowsHit++;
		expectedHit += 1 - Math.pow(.9, k);
		t = j;
	}
	const z = proportionZ(tickHits, ticks, .1);
	return {
		windowSec,
		windows,
		windowsHit,
		expectedHit,
		ticks,
		tickHits,
		avgTicks: windows ? ticks / windows : 0,
		tickRate: ticks ? tickHits / ticks : 0,
		z,
		significance: z > 0 ? zConfidence(z) : 0
	};
}
// src/lib/feed.ts
/**
* Live tick ingestion. Streams the public Deriv WebSocket feed straight into
* the browser, keeps a rolling 5000-tick window per market, and measures
* round-trip latency. Falls back to a clearly labelled simulated feed when the
* venue cannot be reached.
*
* A later milestone moves this ingestion to a server-side worker close to the
* broker endpoint; the store interface below is what the UI depends on.
*/
var STORAGE_KEY = "nte:markets";
var FeedStore = class {
	ws = null;
	listeners = /* @__PURE__ */ new Set();
	version = 0;
	scheduled = false;
	reqId = 1;
	pingSent = /* @__PURE__ */ new Map();
	subs = /* @__PURE__ */ new Map();
	pingTimer;
	simTimer;
	failures = 0;
	tickStamps = [];
	started = false;
	urlIndex = 0;
	series = /* @__PURE__ */ new Map();
	snap = {
		mode: "idle",
		rtt: null,
		rttAvg: null,
		rttHistory: [],
		ticksPerMin: 0,
		messages: 0,
		selected: DEFAULT_SELECTED,
		focus: DEFAULT_SELECTED[0]
	};
	subscribe = (l) => {
		this.listeners.add(l);
		return () => this.listeners.delete(l);
	};
	getVersion = () => this.version;
	emit() {
		if (this.scheduled) return;
		this.scheduled = true;
		const flush = () => {
			this.scheduled = false;
			this.version++;
			this.snap = { ...this.snap };
			this.listeners.forEach((l) => l());
		};
		if (typeof document !== "undefined" && document.hidden) setTimeout(flush, 250);
		else requestAnimationFrame(flush);
	}
	start() {
		if (this.started) return;
		this.started = true;
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
			const selected = saved?.selected?.filter((s) => MARKET_BY_SYMBOL[s]);
			if (selected?.length) this.snap.selected = selected;
			if (saved?.focus && MARKET_BY_SYMBOL[saved.focus]) this.snap.focus = saved.focus;
			if (!this.snap.selected.includes(this.snap.focus)) this.snap.focus = this.snap.selected[0];
		} catch {}
		setInterval(() => this.updateRate(), 2e3);
		this.connect();
	}
	persist() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({
				selected: this.snap.selected,
				focus: this.snap.focus
			}));
		} catch {}
	}
	toggleMarket(symbol) {
		const has = this.snap.selected.includes(symbol);
		if (has && this.snap.selected.length === 1) return;
		const selected = has ? this.snap.selected.filter((s) => s !== symbol) : [...this.snap.selected, symbol];
		this.snap.selected = selected;
		if (!selected.includes(this.snap.focus)) this.snap.focus = selected[0];
		if (has) this.unwatch(symbol);
		else this.watch(symbol);
		this.persist();
		this.emit();
	}
	setFocus(symbol) {
		if (!this.snap.selected.includes(symbol)) this.toggleMarket(symbol);
		this.snap.focus = symbol;
		this.persist();
		this.emit();
	}
	connect() {
		this.stopSim();
		this.snap.mode = this.failures ? "reconnecting" : "connecting";
		this.emit();
		let opened = false;
		const url = FEED_URLS[this.urlIndex % FEED_URLS.length];
		let ws;
		try {
			ws = new WebSocket(url);
		} catch {
			this.failures++;
			this.urlIndex++;
			setTimeout(() => this.connect(), 1e3);
			return;
		}
		this.ws = ws;
		const openTimeout = setTimeout(() => {
			if (!opened) ws.close();
		}, 8e3);
		ws.onopen = () => {
			opened = true;
			clearTimeout(openTimeout);
			this.failures = 0;
			this.snap.mode = "live";
			this.subs.clear();
			for (const s of this.snap.selected) this.watch(s);
			this.ping();
			this.pingTimer = setInterval(() => this.ping(), 5e3);
			this.emit();
		};
		ws.onmessage = (ev) => this.onMessage(ev.data);
		ws.onclose = () => {
			clearTimeout(openTimeout);
			clearInterval(this.pingTimer);
			if (this.ws !== ws) return;
			this.ws = null;
			this.failures++;
			if (!opened) this.urlIndex++;
			if (this.failures >= 2 * FEED_URLS.length + 1) {
				this.startSim();
				setTimeout(() => this.snap.mode === "simulated" && this.connect(), 6e4);
			} else {
				this.snap.mode = "reconnecting";
				this.emit();
				setTimeout(() => this.connect(), opened ? 1e3 : Math.min(1e3 * this.failures, 5e3));
			}
		};
	}
	retryLive() {
		this.failures = 0;
		if (this.ws) this.ws.close();
		else this.connect();
	}
	send(payload) {
		if (this.ws?.readyState === WebSocket.OPEN) {
			const id = this.reqId++;
			this.ws.send(JSON.stringify({
				...payload,
				req_id: id
			}));
			return id;
		}
		return null;
	}
	ping() {
		const id = this.send({ ping: 1 });
		if (id) this.pingSent.set(id, performance.now());
	}
	watch(symbol) {
		if (this.snap.mode === "simulated") {
			this.seedSim(symbol);
			return;
		}
		if (!this.series.has(symbol)) this.series.set(symbol, blankSeries(symbol));
		this.send({
			ticks_history: symbol,
			adjust_start_time: 1,
			count: WINDOW,
			end: "latest",
			style: "ticks",
			subscribe: 1
		});
	}
	unwatch(symbol) {
		const id = this.subs.get(symbol);
		if (id) this.send({ forget: id });
		this.subs.delete(symbol);
	}
	onMessage(raw) {
		let msg;
		try {
			msg = JSON.parse(raw);
		} catch {
			return;
		}
		this.snap.messages++;
		if (msg.msg_type === "ping") {
			const sent = this.pingSent.get(msg.req_id);
			if (sent !== void 0) {
				this.pingSent.delete(msg.req_id);
				const rtt = performance.now() - sent;
				const hist = [...this.snap.rttHistory, rtt].slice(-60);
				this.snap.rtt = rtt;
				this.snap.rttHistory = hist;
				this.snap.rttAvg = hist.reduce((a, b) => a + b, 0) / hist.length;
				this.emit();
			}
			return;
		}
		if (msg.error) {
			const sym = msg.echo_req?.ticks_history;
			if (sym) {
				const s = this.series.get(sym) ?? blankSeries(sym);
				if (!s.loaded) s.error = msg.error.message;
				s.backfilling = false;
				this.series.set(sym, s);
				this.emit();
			}
			return;
		}
		if (msg.msg_type === "history") {
			const sym = msg.echo_req.ticks_history;
			if (!this.snap.selected.includes(sym)) {
				if (msg.subscription?.id) this.send({ forget: msg.subscription.id });
				return;
			}
			const prices = (msg.history?.prices ?? []).map(Number);
			const times = (msg.history?.times ?? []).map(Number);
			if (!msg.echo_req.subscribe) {
				this.onBackfill(sym, prices, times, Number(msg.echo_req.count));
				return;
			}
			if (msg.subscription?.id) this.subs.set(sym, msg.subscription.id);
			const pip = Number(msg.pip_size ?? MARKET_BY_SYMBOL[sym]?.pip ?? 2);
			const s = {
				symbol: sym,
				pip,
				prices,
				times,
				digits: prices.map((p) => lastDigit(p, pip)),
				receivedAt: performance.now(),
				liveTicks: 0,
				loaded: true,
				backfilling: false
			};
			this.series.set(sym, s);
			this.requestOlder(s);
			this.emit();
			return;
		}
		if (msg.msg_type === "tick" && msg.tick) {
			const { symbol, quote, epoch, pip_size } = msg.tick;
			const s = this.series.get(symbol);
			if (!s || !this.snap.selected.includes(symbol)) return;
			if (pip_size !== void 0) s.pip = Number(pip_size);
			this.push(s, Number(quote), Number(epoch));
		}
	}
	/** Asks for the page of ticks just before the oldest one held. */
	requestOlder(s) {
		const need = WINDOW - s.prices.length;
		if (need <= 0 || !s.times.length) {
			s.backfilling = false;
			return;
		}
		s.backfilling = true;
		this.send({
			ticks_history: s.symbol,
			count: Math.min(HISTORY_PAGE, need),
			end: s.times[0] - 1,
			style: "ticks"
		});
	}
	onBackfill(sym, prices, times, asked) {
		const s = this.series.get(sym);
		if (!s) return;
		const oldest = s.times[0] ?? Infinity;
		const keep = times.findIndex((t) => t >= oldest);
		const n = keep === -1 ? times.length : keep;
		if (n > 0) {
			const room = WINDOW - s.prices.length;
			const from = Math.max(0, n - room);
			const p = prices.slice(from, n);
			s.prices = [...p, ...s.prices];
			s.times = [...times.slice(from, n), ...s.times];
			s.digits = [...p.map((x) => lastDigit(x, s.pip)), ...s.digits];
		}
		if (n === 0 || times.length < asked) s.backfilling = false;
		else this.requestOlder(s);
		this.emit();
	}
	push(s, price, epoch) {
		s.prices.push(price);
		s.times.push(epoch);
		s.digits.push(lastDigit(price, s.pip));
		if (s.prices.length > 5e3) {
			s.prices.shift();
			s.times.shift();
			s.digits.shift();
		}
		s.receivedAt = performance.now();
		s.liveTicks++;
		this.tickStamps.push(Date.now());
		this.emit();
	}
	updateRate() {
		const cutoff = Date.now() - 6e4;
		while (this.tickStamps.length && this.tickStamps[0] < cutoff) this.tickStamps.shift();
		this.snap.ticksPerMin = this.tickStamps.length;
		this.emit();
	}
	seedSim(symbol) {
		const m = MARKET_BY_SYMBOL[symbol];
		const pip = m?.pip ?? 2;
		const prices = [];
		const times = [];
		let p = 1e3 + Math.random() * 9e3;
		const now = Math.floor(Date.now() / 1e3);
		for (let i = 0; i < WINDOW; i++) {
			p = step(p, pip);
			prices.push(p);
			times.push(now - (WINDOW - i) * (m?.cadence ?? 1));
		}
		this.series.set(symbol, {
			symbol,
			pip,
			prices,
			times,
			digits: prices.map((x) => lastDigit(x, pip)),
			receivedAt: performance.now(),
			liveTicks: 0,
			loaded: true,
			backfilling: false
		});
	}
	startSim() {
		this.snap.mode = "simulated";
		this.snap.rtt = null;
		for (const s of this.snap.selected) this.seedSim(s);
		let n = 0;
		this.simTimer = setInterval(() => {
			n++;
			for (const sym of this.snap.selected) {
				const s = this.series.get(sym);
				const cadence = MARKET_BY_SYMBOL[sym]?.cadence ?? 1;
				if (s && n % cadence === 0) this.push(s, step(s.prices[s.prices.length - 1], s.pip), Math.floor(Date.now() / 1e3));
			}
		}, 1e3);
		this.emit();
	}
	stopSim() {
		clearInterval(this.simTimer);
	}
};
function blankSeries(symbol) {
	return {
		symbol,
		pip: MARKET_BY_SYMBOL[symbol]?.pip ?? 2,
		prices: [],
		times: [],
		digits: [],
		receivedAt: 0,
		liveTicks: 0,
		loaded: false,
		backfilling: false
	};
}
function step(p, pip) {
	const next = p * (1 + Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random()) * 4e-4);
	return Math.round(next * 10 ** pip) / 10 ** pip;
}
var store = null;
function getFeed() {
	if (!store) store = new FeedStore();
	return store;
}
// src/lib/useFeed.ts
var noop = () => () => {};
/** Subscribes a component to the live feed; returns null during SSR. */
function useFeed() {
	const [client, setClient] = useState(false);
	useEffect(() => {
		getFeed().start();
		setClient(true);
	}, []);
	const feed = client ? getFeed() : null;
	return {
		feed,
		version: useSyncExternalStore(feed ? feed.subscribe : noop, feed ? feed.getVersion : () => 0, () => 0)
	};
}
/** Runs the analytical engine on a series, recomputing on every new tick. */
function useAnalysis(series, cfg) {
	const len = series?.prices.length ?? 0;
	const last = series?.times[len - 1] ?? 0;
	return useMemo(() => {
		if (!series || len < 60) return null;
		return analyze(series.digits, series.prices, cfg);
	}, [
		series,
		len,
		last,
		series?.liveTicks,
		cfg.lookback,
		cfg.barrier,
		cfg.threshold
	]);
}
// src/components/AppShell.tsx
var MODE_LABEL = {
	idle: "Starting",
	connecting: "Connecting",
	live: "Live feed",
	reconnecting: "Reconnecting",
	simulated: "Simulated feed"
};
function AppShell() {
	const { feed } = useFeed();
	const snap = feed?.snap;
	const mode = snap?.mode ?? "idle";
	const live = mode === "live";
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-screen",
		children: [
			/* @__PURE__ */ jsxs("header", {
				className: "sticky top-0 z-20 border-b border-line bg-ink/80 backdrop-blur-xl",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6",
					children: [
						/* @__PURE__ */ jsxs(Link, {
							to: "/",
							className: "flex items-center gap-2.5",
							children: [/* @__PURE__ */ jsx("span", {
								className: "grid h-9 w-9 place-items-center rounded-xl bg-pulse/10 ring-1 ring-pulse/40",
								children: /* @__PURE__ */ jsx(Cpu, { className: "h-5 w-5 text-pulse" })
							}), /* @__PURE__ */ jsxs("span", {
								className: "leading-tight",
								children: [/* @__PURE__ */ jsx("span", {
									className: "block text-[15px] font-bold tracking-tight text-white",
									children: "Neural Trading Engine"
								}), /* @__PURE__ */ jsx("span", {
									className: "label !text-[9px]",
									children: "digit intelligence · volatility indices"
								})]
							})]
						}),
						/* @__PURE__ */ jsxs("nav", {
							className: "flex gap-1 rounded-xl border border-line bg-panel p-1 text-sm",
							children: [
								/* @__PURE__ */ jsxs(Link, {
									to: "/",
									className: "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-mute transition hover:text-white",
									activeProps: { className: "!bg-panel-2 !text-white" },
									activeOptions: { exact: true },
									children: [/* @__PURE__ */ jsx(Activity, { className: "h-4 w-4" }), " Engine"]
								}),
								/* @__PURE__ */ jsxs(Link, {
									to: "/matches",
									className: "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-mute transition hover:text-white",
									activeProps: { className: "!bg-panel-2 !text-white" },
									children: [/* @__PURE__ */ jsx(Target, { className: "h-4 w-4" }), " Matches"]
								}),
								/* @__PURE__ */ jsxs(Link, {
									to: "/scanner",
									className: "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-mute transition hover:text-white",
									activeProps: { className: "!bg-panel-2 !text-white" },
									children: [/* @__PURE__ */ jsx(Radar, { className: "h-4 w-4" }), " Digit scanner"]
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "ml-auto flex items-center gap-2 font-mono text-xs",
							children: [
								/* @__PURE__ */ jsxs("span", {
									className: `flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${live ? "border-pulse/40 text-pulse" : mode === "simulated" ? "border-heat/40 text-heat" : "border-line text-mute"}`,
									children: [/* @__PURE__ */ jsx("span", { className: `h-2 w-2 rounded-full ${live ? "live-dot bg-pulse" : mode === "simulated" ? "bg-heat" : "bg-mute"}` }), MODE_LABEL[mode]]
								}),
								/* @__PURE__ */ jsxs("span", {
									className: "hidden items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 sm:flex",
									title: "WebSocket round-trip time to the broker endpoint",
									children: [
										/* @__PURE__ */ jsx(Zap, { className: "h-3.5 w-3.5 text-volt" }),
										/* @__PURE__ */ jsx("span", {
											className: "num text-white",
											children: snap?.rtt != null ? `${snap.rtt.toFixed(0)}ms` : "—"
										}),
										/* @__PURE__ */ jsx("span", {
											className: "text-mute",
											children: "rtt"
										})
									]
								}),
								/* @__PURE__ */ jsxs("span", {
									className: "hidden items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 md:flex",
									children: [
										/* @__PURE__ */ jsx(Radio, { className: "h-3.5 w-3.5 text-volt" }),
										/* @__PURE__ */ jsx("span", {
											className: "num text-white",
											children: snap?.ticksPerMin ?? 0
										}),
										/* @__PURE__ */ jsx("span", {
											className: "text-mute",
											children: "ticks/min"
										})
									]
								}),
								mode === "simulated" && /* @__PURE__ */ jsx("button", {
									onClick: () => feed?.retryLive(),
									className: "rounded-lg bg-heat/15 px-2.5 py-1.5 text-heat hover:bg-heat/25",
									children: "Retry live"
								})
							]
						})
					]
				}), /* @__PURE__ */ jsx("div", {
					className: "mx-auto max-w-7xl overflow-x-auto px-4 pb-3 sm:px-6",
					children: /* @__PURE__ */ jsxs("div", {
						className: "flex min-w-max items-center gap-1.5",
						children: [/* @__PURE__ */ jsx("span", {
							className: "label mr-2",
							children: "Markets"
						}), MARKETS.map((m) => {
							const on = snap?.selected.includes(m.symbol) ?? false;
							return /* @__PURE__ */ jsx("button", {
								onClick: () => feed?.toggleMarket(m.symbol),
								"aria-pressed": on,
								title: m.name,
								className: `rounded-full border px-3 py-1 font-mono text-[11px] transition ${on ? "border-pulse/50 bg-pulse/10 text-pulse" : "border-line text-mute hover:border-soft/40 hover:text-soft"}`,
								children: m.short
							}, m.symbol);
						})]
					})
				})]
			}),
			/* @__PURE__ */ jsx("main", {
				className: "grid-bg",
				children: /* @__PURE__ */ jsx("div", {
					className: "mx-auto max-w-7xl px-4 py-6 sm:px-6",
					children: /* @__PURE__ */ jsx(Outlet, {})
				})
			}),
			/* @__PURE__ */ jsx("footer", {
				className: "border-t border-line",
				children: /* @__PURE__ */ jsx("div", {
					className: "mx-auto max-w-7xl px-4 py-6 text-xs leading-relaxed text-mute sm:px-6",
					children: "Confidence scores measure how unlikely a digit deviation is under pure randomness — they are not win probabilities. Volatility indices are generated by a random number generator, so edges in historical ticks rarely persist. Analysis only; not financial advice."
				})
			})
		]
	});
}
// src/routes/__root.tsx
var siteName = "Neural Trading Engine";
var siteDescription = "Live digit-probability engine for volatility indices: 5000-tick digit skew, confidence scoring, contract signals for Matches, Even/Odd, Over/Under and Rise/Fall, and a multi-market digit scanner.";
var Route$3 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: siteName },
			{
				name: "description",
				content: siteDescription
			},
			{
				property: "og:title",
				content: siteName
			},
			{
				property: "og:description",
				content: siteDescription
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			}
		],
		links: [
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
			}
		]
	}),
	shellComponent: RootDocument,
	component: AppShell
});
function RootDocument({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }), /* @__PURE__ */ jsxs("body", { children: [children, /* @__PURE__ */ jsx(Scripts, {})] })]
	});
}
// src/routes/index.tsx
var $$splitComponentImporter$2 = () => import("./routes-Hyv4RxPS.js");
var Route$2 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
// src/routes/matches.tsx
var $$splitComponentImporter$1 = () => import("./matches-bXTaAUc8.js");
var Route$1 = createFileRoute("/matches")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
/** Ticks with epoch in (from, to] from the rolling series. */
/**
* Holds the ensemble pick for PREDICTION_WINDOW_SEC seconds, then settles the
* window against every tick that arrived in it and locks a fresh pick.
*/
// src/routes/scanner.tsx
var $$splitComponentImporter = () => import("./scanner-HYqHbRzs.js");
var Route = createFileRoute("/scanner")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
// src/routeTree.gen.ts
var rootRouteChildren = {
	IndexRoute: Route$2.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$3
	}),
	MatchesRoute: Route$1.update({
		id: "/matches",
		path: "/matches",
		getParentRoute: () => Route$3
	}),
	ScannerRoute: Route.update({
		id: "/scanner",
		path: "/scanner",
		getParentRoute: () => Route$3
	})
};
var routeTree = Route$3._addFileChildren(rootRouteChildren)._addFileTypes();
// src/router.tsx
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
var getRouter = () => {
	return createRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreloadStaleTime: 0
	});
};
export { DEFAULT_CONFIG as a, matchesPredict as c, getRouter, CONTRACT_META as i, matchesWindowBacktest as l, useAnalysis as n, analyze as o, useFeed as r, estimate as s, router_exports as t, MARKET_BY_SYMBOL as u };
