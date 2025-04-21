import { type Socket } from "bun";
import { log } from "./index";

export class MPDResponse {
	public values = new Map<string, string>();
	private binary?: Buffer;

	private ptr: number = 0;

	private readLine(): string | null {
		let output = "";
		if(this.ptr == this.data.length-1) {
			console.log("no more data")
			return null;
		}
		while(this.data[this.ptr] != 10 && this.ptr <= this.data.length) {
			output += String.fromCharCode(this.data[this.ptr]);
			this.ptr += 1;
		}
		this.ptr += 1; //Don't get stuck on the newline.
		return output;
	}

	constructor(private data: Buffer) {
		let lastLine = "<no response>";
		let line;
		// console.log(`Parsing ${data.length} bytes`);
		while((line = this.readLine()) != null) {
			if(line.length == 0) continue;
			lastLine = line;
			let [key, value] = line.split(": ", 2);
			if(key == undefined || value == undefined) break;
			if(key == "binary") {
			//	console.log("READING BINARY ", value)
				let length = Number(value.trim());
				this.binary = data.subarray(this.ptr, this.ptr+length);
				this.ptr += length;
			//	console.log("DONE");
			} else {
				this.values.set(key, value.trim());
			}
		}
		// console.log("done reading keys");
		if(!lastLine.startsWith("OK")) {
			throw new Error(`MPD response was not OK:\n${lastLine}`);
		}
	}

	public append(binary: Buffer): Buffer | null {
		if(!this.binary) return null;
		this.binary = Buffer.concat([this.binary, binary]);
		return this.binary;
	}

	public get(key: string): string|null {
		return this.values.get(key) ?? null;
	}
	public getBinary(): Buffer|null {
		return this.binary ?? null;
	}
}

export class MPDConnection {
	private pendingPromises: ((data:Buffer)=>any)[] = [];
	private socket: Socket<undefined> | null = null;
	public async start() {
		let connection = this;
		this.socket = await Bun.connect({
			hostname: "localhost",
			port: 6600,

			socket: {
				data(_socket: Socket<undefined>, data: Buffer) {
					for(let callback of connection.pendingPromises) {
						callback(data);
					}
					connection.pendingPromises.length = 0;
				},
				async open(_socket: Socket<undefined>) {
					await connection.getResponse();
				}
			}
		});
		await this.getResponse(); //Initial connection receives an "OK" response.
	}

	public async stop() {
		this.socket?.end();
	}

	public getResponse(): Promise<MPDResponse> {
		return new Promise((resolve, reject) => {
			this.pendingPromises.push(data=>{
				try {
					resolve(new MPDResponse(data));
				} catch(e) {
					log(e);
					reject(e);
				}
			});
		});
	}

	public sendCommand(command: string): Promise<MPDResponse> {
		if(!command.endsWith("\n")) this.socket?.write(`${command}\n`);
		else this.socket?.write(command);
		return this.getResponse();
	}
	//Helper function which chains requests to get the whole of a binary response. Within the command, $$ is substituted for the offset.
	public async requestBinary(command: string, key: string = "size"): Promise<MPDResponse> {
		let initial = await this.sendCommand(command.replace("$$", "0"));
		let bin = initial.getBinary();
		if(initial.get(key) && bin) {
			while(bin.length < Number(initial.get(key))) {
				let newResponse = await this.sendCommand(command.replace("$$", bin.length.toString()));
				let newBinary = newResponse.getBinary();
				if(!newBinary) {
					throw new TypeError("Chain response has no binary data.");
				}
				bin = initial.append(newBinary);
				if(!bin) throw new TypeError("Buffer dissappeared!");
			}
			return initial;
		} else {
			return initial;
		}
	}
}




export function escapeString(string: string): string {
	return string.replace(/("')/g, "\\\\$1");
}
