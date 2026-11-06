import { jsx, jsxs } from "react/jsx-runtime";
// src/components/ui.tsx
var pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;
var money = (v) => `${v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString("en-US", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
})}`;
function bandOf(confidence, threshold) {
	if (confidence >= threshold) return {
		name: "HIGH",
		cls: "text-pulse",
		bar: "bg-pulse"
	};
	if (confidence >= 60) return {
		name: "WATCH",
		cls: "text-heat",
		bar: "bg-heat"
	};
	return {
		name: "NOISE",
		cls: "text-mute",
		bar: "bg-mute"
	};
}
function Panel({ title, kicker, right, children, className = "" }) {
	return /* @__PURE__ */ jsxs("section", {
		className: `panel p-5 ${className}`,
		children: [/* @__PURE__ */ jsxs("header", {
			className: "mb-4 flex items-start justify-between gap-3",
			children: [/* @__PURE__ */ jsxs("div", { children: [kicker && /* @__PURE__ */ jsx("p", {
				className: "label mb-1",
				children: kicker
			}), /* @__PURE__ */ jsx("h2", {
				className: "text-lg font-semibold tracking-tight text-white",
				children: title
			})] }), right]
		}), children]
	});
}
function Stat({ label, value, hint, tone = "text-white" }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "rounded-xl border border-line bg-panel-2/60 px-4 py-3",
		children: [
			/* @__PURE__ */ jsx("p", {
				className: "label",
				children: label
			}),
			/* @__PURE__ */ jsx("p", {
				className: `num mt-1 text-xl font-semibold ${tone}`,
				children: value
			}),
			hint && /* @__PURE__ */ jsx("p", {
				className: "mt-0.5 text-xs text-mute",
				children: hint
			})
		]
	});
}
function Meter({ value, threshold }) {
	const band = bandOf(value, threshold);
	return /* @__PURE__ */ jsxs("div", {
		className: "relative h-2 w-full overflow-hidden rounded-full bg-line",
		children: [/* @__PURE__ */ jsx("div", {
			className: `h-full ${band.bar} transition-all duration-500`,
			style: { width: `${Math.min(100, value)}%` }
		}), /* @__PURE__ */ jsx("div", {
			className: "absolute inset-y-0 w-px bg-white/60",
			style: { left: `${threshold}%` },
			title: `High-confidence band starts at ${threshold}`
		})]
	});
}
function Skeleton({ className = "" }) {
	return /* @__PURE__ */ jsx("div", { className: `animate-pulse rounded-xl bg-line/60 motion-reduce:animate-none ${className}` });
}
export { bandOf as a, Stat as i, Panel as n, money as o, Skeleton as r, pct as s, Meter as t };
