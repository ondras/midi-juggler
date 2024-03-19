import * as form from "./form.js";


let inSelect = document.querySelector("#in");
let outSelect = document.querySelector("#out");
let addButton = document.querySelector("#add");
let tbody = document.querySelector("#routes");
let midiAccess = {
	inputs: new Map(),
	outputs: new Map()
}


const ACTIVE_SENSE = 15;
const KEYFRAMES = [{backgroundColor:"lime"}, {backgroundColor:"transparent"}];
const TIMING = {duration:300}
function pulsePort(node) { node.animate(KEYFRAMES, TIMING); }

let routes = [];

function formatPort(id, ports) {
	if (ports.has(id)) {
		let port = ports.get(id);
		let label = port.name;
		if (port.version) { label = `${label}/${port.version}`; }
		if (port.manufacturer) { label = `${port.manufacturer} ${label}`; }
		return label;
	} else {
		return id.substring(0, 10);
	}
}

function newRoute(inId, outId) {
	return {
		inId, outId,
		transpose: 0,
		messageTypes: null,
		activeSense: false
	}
}

function processRoute(route, e) {
	let output = midiAccess.outputs.get(route.outId);
	if (!output) { return; }

	let data = e.data;

	let index = routes.indexOf(route);
	let row = tbody.rows[index];
	pulsePort(row.cells[0]);

	let mt = data[0] >> 4;

	if (route.messageTypes) {
		if (!route.messageTypes.includes(mt)) { return; }
	}

	if (mt == ACTIVE_SENSE && !route.activeSense) { return; }

//	console.log("routing", route.inId, "->", route.outId, e);

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
	row.cells[0].classList.toggle("inactive", !midiAccess.inputs.has(route.inId));

	let mt = (route.messageTypes ? route.messageTypes.join(", ") : "all");

	let p = row.cells[1].querySelector("p");
	p.innerHTML = `
		Transpose: ${route.transpose > 0 ? "+" : ""}${route.transpose}<br/>
		Message types: ${mt}<br/>
		Active Sense: ${route.activeSense ? "yes" : "no"}
	`;

	row.cells[2].textContent = formatPort(route.outId, midiAccess.outputs);
	row.cells[2].classList.toggle("inactive", !midiAccess.outputs.has(route.outId));
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
	let row = document.createElement("tr");
	row.insertCell();
	let mid = row.insertCell();
	row.insertCell();

	let p = document.createElement("p");

	let edit = document.createElement("button");
	edit.textContent = "Edit";
	edit.onclick = async _ => {
		let result = await form.editRoute(route);
		if (!result) { return; }
		syncRoute(route);
		saveRoutes();
	}

	let del = document.createElement("button");
	del.name = "delete";
	del.textContent = "🞮";
	del.onclick = _ => {
		removeRoute(route);
		saveRoutes();
	}

	mid.append(p, edit, del);

	return row;
}

async function addRoute() {
	let inId = inSelect.value;
	let outId = outSelect.value;
	let route = newRoute(inId, outId);

	let result = await form.editRoute(route);
	if (!result) { return; }

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

try {
	midiAccess = await navigator.requestMIDIAccess();
	midiAccess.addEventListener("statechange", _ => fillPorts());
	form.init();
	fillPorts();
	syncAddEnabled();
	loadRoutes();
} catch (e) {
	console.warn(e);
	alert("Your browser does not support Web MIDI");
}
