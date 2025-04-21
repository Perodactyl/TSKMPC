import { MPDConnection } from "./mpd";
import { readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { inspect } from "node:util";
import { TextComponent, UIComponent } from "./ui";
import { UIContainer } from "./ui/container";

let logFile = createWriteStream("tskmpc.log");

logFile.write("\x1b[3J\x1b[H");

export function log(message: any) {
	logFile.write("\n"+(typeof message == "string" ? message : inspect(message, {
		depth: null,
		colors: true
	})));
}

export let screenWidthPX: number | null = null;
export let screenHeightPX: number | null = null;

export function ANSIEscape(message: string): string {
	return message.replace(/\x2b/g, "^[");
}

export class TSKMPC {
	mpd: MPDConnection | null = null;
	stdinHandler: TSKMPC["readStdin"] | null = null;
	currentStatusTimeout: ReturnType<typeof setTimeout> | null = null;
	isRedrawing:  boolean = false;
	rootComponent = new UIContainer(this);
	currentSongMetaData = new Map<string, string>();
	pendingInfo: Function | null = null;
	async start() {
		log("TSKMPC starting.");
		this.rootComponent = await UIContainer.createFromXML(this, await readFile("layout.xml", "utf8")) as UIContainer;

		this.mpd = new MPDConnection();
		await this.mpd.start();

		this.stdinHandler = this.readStdin.bind(this);
		process.stdin.on("data", this.stdinHandler);
		process.stdin.setRawMode(true);
		process.stdout.on("resize", this.redraw.bind(this));
		let p = new Promise(r=>this.pendingInfo = r);
		process.stdout.write("\x1b[?1049h\x1b[2J\x1b[3J\x1b[?25l\x1b[>1u\x1b[14t");
		log("Screen configured; awaiting terminal size.");
		await p;

		this.status = "Welcome to TSKMPC!";
		
		await this.onNextSong();
		await this.redraw();
	}
	async stop() {
		process.stdout.uncork();
		process.stdout.write("\x1b[?1049l\x1b[?25h\x1b[3J\x1b[2J\x1b[H\x1b[<1u");
		if(this.stdinHandler)
			process.stdin.off("data", this.stdinHandler);

		process.stdin.setRawMode(false);
		process.stdin.pause();

		await this.mpd?.stop();

		if(this.currentStatusTimeout) {
			clearTimeout(this.currentStatusTimeout);
			this.currentStatusTimeout = null;
		}

		log("TSKMPC exiting.");
		logFile.end();
		console.log("TSKMPC exited.");
	}
	private set status(value: string) {
		let statusComponent = this.rootComponent.trySelectChildByID("status") as TextComponent | null;
		if(!statusComponent) return;
		statusComponent.text = value;
		if(this.currentStatusTimeout) clearTimeout(this.currentStatusTimeout);
		this.currentStatusTimeout = setTimeout(()=>{
			this.currentStatusTimeout = null;
			statusComponent.text = "";
			this.redraw();
		}, 2000);
		this.redraw();
	}
	async redraw() {
		this.isRedrawing = true;
		process.stdout.cork();
		//"Go to start," then "clear to end of screen" circumvents image deletion.
		process.stdout.write("\x1b[0m\x1b[H\x1b[J");

		let width = process.stdout.columns;
		let height = process.stdout.rows;

		this.rootComponent.width = width;
		this.rootComponent.height = height;
		this.rootComponent.draw();

		process.stdout.uncork();
		this.isRedrawing = false;
	}
	private async readStdin(data: Buffer) {
		if(data[0] == 0x1b) {
			if(data[1] == 0x5F && data[2] == 0x47) { //Kitty graphics response
				let string = data.toString().slice(3);
			//	this.setStatus(string); //Prevents redraw which can cause a loop.
				log(`KiTTY Message: ${string}`);
			} else if(data[1] == 0x5B) { //CSI
				let string = data.toString().slice(2);
				if(string.endsWith("t")) { //Terminal size info
					let parts = string.slice(0, -1).split(";");
					screenWidthPX = Number(parts[0]);
					screenHeightPX = Number(parts[1]);
					log(`Terminal is ${screenWidthPX}x${screenHeightPX}`);
					if(this.pendingInfo != null) {
						this.pendingInfo();
						this.pendingInfo = null;
					}
				}
			}
		} else if(data[0] == 0x03) {
			await this.stop();
			return;
		} else {
			let string = data.toString();
			if(string.toLowerCase() == "q") {
				await this.stop();
				return;
			} else if(string == "$") {
				log(this.rootComponent);
			} else if(string == "%") {
				await this.redraw();
			}
		}
	}
	private async onNextSong() {
		if(!this.mpd) throw new Error("MPD is not yet initialized.");
		let info = await this.mpd.sendCommand("currentsong");
		log(info);
		this.currentSongMetaData = info.values;
		await this.rootComponent.event("nextSong");
	}
	[inspect.custom]() {
		return `<TSKMPC>`;
	}
}

let tskmpc = new TSKMPC();
tskmpc.start();
