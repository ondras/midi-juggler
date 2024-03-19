const MESSAGE_TYPES = {
	"8": "Note Off",
	"9": "Note On",
	"10": "Polyphonic Aftertouch",
	"11": "Control Change",
	"12": "Program Change",
	"13": "Channel Aftertouch",
	"14": "Pitch Bend"
}

let dialog = document.querySelector("dialog");


async function showDialog() {
	dialog.showModal();
	let form = dialog.querySelector("form");
	let cancel = form.querySelector("[name=cancel]");

	return new Promise(resolve => {
		dialog.onclose = _ => resolve(false);
		form.onsubmit = e => {
			e.preventDefault();
			dialog.close();
			resolve(true);
		}
		cancel.onclick = _ => {
			dialog.close();
			resolve(false);
		}
	});
}

export async function editRoute(route) {
	let form = dialog.querySelector("form");
	let transpose = form.querySelector("[name=transpose]");
	let mtMode = form.querySelector("[name=message-types-mode]");
	let mt = form.querySelector("[name=message-types]");
	let activeSense = form.querySelector("[name=message-types]");
	let mtOptions = [...mt.options];

	transpose.value = route.transpose;
	mtMode.value = (route.messageTypes ? "only" : "all");
	let messageTypes = (route.messageTypes || []);
	mtOptions.forEach(o => o.selected = messageTypes.includes(Number(o.value)));
	activeSense.checked = route.activeSense;

	let result = await showDialog();

	if (result) {
		route.transpose = Number(transpose.value);
		let messageTypes = mtOptions.filter(o => o.selected).map(o => Number(o.value));
		route.messageTypes = (mtMode.value == "all" ? null : messageTypes);
		route.activeSense = activeSense.checked;
	}

	return result;
}


export function init() {
	let form = dialog.querySelector("form");

	let transpose = form.querySelector("[name=transpose]");
	for (let t = 12; t>=-12; t--) {
		transpose.append(new Option(`${t > 0 ? "+" : ""}${t} semitone${t == 1 ? "" : "s"}`, t));
	}

	let messageTypes = form.querySelector("[name=message-types]");
	let options = Object.entries(MESSAGE_TYPES).map(([id, label]) => new Option(label, id));
	messageTypes.append(...options);

}