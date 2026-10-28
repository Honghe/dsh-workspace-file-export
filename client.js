window.__ModuleLoader__.load({ id: "dsh-workspace-file-export", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
let react = require("react");

// src/client/index.tsx
const inject = ["slots"];
function DownloadLink(props) {
	const href = `/api/workspace-download?path=${encodeURIComponent(props.absolutePath)}`;
	return (0, react.createElement)("a", {
		href,
		title: "Download this file",
		style: {
			fontSize: "12px",
			color: "inherit",
			textDecoration: "none",
			cursor: "pointer"
		}
	}, "Download");
}
function apply(ctx) {
	ctx.slots.inject("sidebar.right.tab.document.actions", () => ctx.slots.register({
		name: "sidebar.right.tab.document.actions",
		id: "workspace-file-export"
	}, DownloadLink));
}

exports.apply = apply;
exports.inject = inject;
return module.exports; } });