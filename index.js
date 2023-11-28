let inSelect = document.querySelector("#in");
let outSelect = document.querySelector("#out");
let addButton = document.querySelector("#add");
let tbody = document.querySelector("#routes");
let template = document.querySelector("#route");
let midiAccess = {
	inputs: new Map(),
	outputs: new Map()
}

const MESSAGE_TYPES = {
	"8": "Note Off",
	"9": "Note On",
	"10": "Polyphonic Aftertouch",
	"11": "Control Change",
	"12": "Program Change",
	"13": "Channel Aftertouch",
	"14": "Pitch Bend"
}

let routes = [];

const KEYFRAMES = [{backgroundColor:"lime"}, {backgroundColor:"transparent"}];
const TIMING = {duration:300}
function pulsePort(node) {
	node.animate(KEYFRAMES, TIMING);
}

function formatPort(id, ports) {
	if (ports.has(id)) {
		let port = ports.get(id);
		let label = port.name;
		if (port.version) { label = `${label}/${port.version}`; }
		if (port.manufacturer) { label = `${port.manufacturer} ${label}`; }
		return label;
	} else {
		return id.substring(10);
	}
}

function newRoute(inId, outId) {
	return {
		inId, outId,
		transpose: 0,
		messageTypes: null
	}
}

function processRoute(route, e) {
	let output = midiAccess.outputs.get(route.outId);
	if (!output) { return; }

	let data = e.data;

	let index = routes.indexOf(route);
	let row = tbody.rows[index];
	pulsePort(row.cells[0]);

	if (route.messageTypes) {
		let mt = data[0] >> 4;
		if (!route.messageTypes.includes(mt)) { return; }
	}

//	console.log("routing", route.inId, "->", route.outId);

	pulsePort(row.cells[2]);

	if (route.transpose && data[0] <= 175) {
		data = data.slice();
		data[1] += route.transpose;
	}

	output.send(data);
}

function onMessage(e) {
	let inId = e.target.id;
	routes.filter(r => r.inId == inId).forEach(route => processRoute(route, e));
}

function syncRoute(route) {
	let index = routes.indexOf(route);
	let row = tbody.rows[index];

	row.cells[0].textContent = formatPort(route.inId, midiAccess.inputs);
	row.cells[2].textContent = formatPort(route.outId, midiAccess.outputs);
}

function loadRoutes() {
	let item = localStorage.getItem("mj.routes");
	if (!item) { return; }

	try {
		routes = JSON.parse(item);
		routes.forEach(route => {
			let node = buildRoute(route);
			tbody.append(node);
			syncRoute(route);
		});
	} catch (e) {
		console.warn(e);
	}
}

function saveRoutes() {
	localStorage.setItem("mj.routes", JSON.stringify(routes));
}

function buildRoute(route) {
	let content = template.content.cloneNode(true);

	let transpose = content.querySelector("[name=transpose]");
	for (let t = 12; t>=-12; t--) {
		let selected = (route.transpose == t);
		let option = new Option(`${t > 0 ? "+" : ""}${t} semitone${t == 1 ? "" : "s"}`, t, selected, selected);
		transpose.append(option);
	}
	transpose.onchange = _ => {
		route.transpose = Number(transpose.value);
		saveRoutes();
	};

	let del = content.querySelector("[name=delete]");
	del.onclick = _ => {
		removeRoute(route);
		saveRoutes();
	}

	let messageTypes = content.querySelector("[name=message-types]");
	let options = Object.entries(MESSAGE_TYPES).map(([id, label]) => {
		let selected = (route.messageTypes && route.messageTypes.includes(Number(id)));
		return new Option(label, id, selected, selected);
	});
	function getSelectedMessageTypes() {
		return options.filter(o => o.selected).map(o => Number(o.value));
	}
	messageTypes.append(...options);
	messageTypes.size = options.length;
	messageTypes.onchange = _ => {
		route.messageTypes = getSelectedMessageTypes();
		saveRoutes();
	}
	messageTypes.hidden = !route.messageTypes;

	let messageTypesMode = content.querySelector("[name=message-types-mode]");
	messageTypesMode.onchange = _ => {
		route.messageTypes = (messageTypesMode.value == "all" ? null : getSelectedMessageTypes());
		messageTypes.hidden = !route.messageTypes;
		saveRoutes();
	}
	messageTypesMode.value = (route.messageTypes ? "only" : "all");


	return content;
}

function addRoute() {
	let inId = inSelect.value;
	let outId = outSelect.value;
	let route = newRoute(inId, outId);
	routes.push(route);

	let node = buildRoute(route);
	tbody.append(node);
	syncRoute(route);

	saveRoutes();
}

function removeRoute(route) {
	let index = routes.indexOf(route);
	routes.splice(index);
	tbody.deleteRow(index);
}


function syncAddEnabled() {
	addButton.disabled = (midiAccess.inputs.size == 0 || midiAccess.outputs.size == 0);
}

function fillSelect(select, ports) {
	let value = select.value;
	let options = [...ports.values()].map(port => new Option(formatPort(port.id, ports), port.id));
	select.replaceChildren(...options);
	if (value) {
		select.value = value;
	} else {
		select.selectedIndex = 0;
	}
}

function fillPorts() {
	fillSelect(inSelect, midiAccess.inputs);
	fillSelect(outSelect, midiAccess.outputs);
	midiAccess.inputs.forEach(port => port.onmidimessage = onMessage);
}

addButton.addEventListener("click", addRoute);
syncAddEnabled();

let detect = document.querySelector("#detect");
try {
	midiAccess = await navigator.requestMIDIAccess();
	detect.textContent = "(this one is fine)";
	midiAccess.addEventListener("statechange", _ => fillPorts());
	fillPorts();
	syncAddEnabled();
	loadRoutes();
} catch (e) {
	console.warn(e);
	detect.textContent = "(this one does NOT)";
}
