import decode from "image-decode";
import { log, screenHeightPX, screenWidthPX } from "./index";
import { Writable } from "node:stream";
import { inspect } from "node:util";

export class KittyImage {
	public id: number;
	public destination: Writable;
	constructor(imageFile: Buffer, id:number, destination?: Writable);
	constructor(id:number, destination?: Writable);
	constructor(imageFile: Buffer|number, id?:number|Writable, destination?: Writable) {
		log("Hello from KittyImage!");
		if(typeof imageFile !== "number") {
			this.id = id as number;
			this.destination = destination ?? process.stdout;
			log(`Creating image with id=${id}`);
			let {data, width, height} = decode(imageFile);
			let colorData = Buffer.from(data); //u8RGBA format.
			uploadImageChunks(colorData.toString("base64"), width, height, this.id, this.destination);
		} else {
			log(`Created null image with id=${imageFile}`);
			this.destination = (id as Writable) ?? process.stdout;
			this.id = imageFile
		}
	}
	public delete() {
		log(`Deleted image ${this.id}`);
		process.stdout.write(`\x1b_Ga=d,d=i,i=${this.id};\x1b\\`);
	}
	[inspect.custom]() {
		return `<KiTTY image ${this.id}>`;
	}
}

function composeParameters(parameters: Record<string, string|number|null>): string {
	let outputs: string[] = [];
	Object.keys(parameters).forEach(key=>{
		if(parameters[key] == null) return;
		outputs.push(`${key}=${parameters[key]}`);
	});
	return outputs.join(",");
}

export class KittyImagePlacement {
	public cellX:number = -1;
	public cellY:number = -1;
	public cellWidth:number = 0;
	public cellHeight:number = 0;
	constructor(public parent:KittyImage, private placementID:number = 0) {
		log(`Placement created. i=${parent.id},p=${placementID}`);
	}
	public display() {
		if(this.cellX >= 0 && this.cellY >= 0) {
			let charOffset = 1;
		//	if(screenWidthPX != null && screenHeightPX != null) charOffset = 0;
			process.stdout.write(`\x1b[${this.cellY+charOffset};${this.cellX+charOffset}H`);
		}
		let stringParameters = composeParameters({
			a: "p",
		//	q: 1,
			i: this.parent.id,
			p: this.placementID > 0 ? this.placementID : null,
			r: this.cellHeight > 0 ? this.cellHeight : null,
		//	c: this.cellWidth > 0 ? this.cellWidth : null,
			C: 1,
			z: -1,
		});
		log(stringParameters);
		this.parent.destination.write(`\x1b_G${stringParameters};\x1b\\`);
	}
	public delete() {
		log("Deleting an image");
		process.stdout.write(`\x1b_Ga=d,d=i,i=${this.parent.id}${this.placementID >= 0 ? `,p=${this.placementID}` : ""};\x1b\\`);
	}
}

function uploadImageChunks(imageData: string, width: number, height: number, imageID:number, destination: Writable) {
	log("Uploading image...");
	let offset = 0;
	const CHUNK_SIZE = 4096;
	let blocksWritten = 0;
	let startingParameters = {
	//	f: 32,
	//	t: "d",
		i: imageID,
	//	q: 0,
		s: width,
		v: height,
		a: "t",
	}
	while(true) {
		let chunk = imageData.slice(offset, offset+CHUNK_SIZE);
		// log(`${blocksWritten}. ${chunk.length}. ${offset+CHUNK_SIZE >= imageData.length}. ${offset} - ${offset+CHUNK_SIZE} out of ${imageData.length}`);
		let parameters: Record<string, number|string|null>;
		if(offset == 0) parameters = { ...startingParameters };
		else parameters = {};
		parameters.m = offset+CHUNK_SIZE >= imageData.length ? 0 : 1;
		let stringParameters = composeParameters(parameters);
		if(offset == 0)log(stringParameters);
		destination.write(`\n\x1b_G${stringParameters};${chunk}\x1b\\`);

		blocksWritten += 1;
		offset += CHUNK_SIZE;

		if(offset >= imageData.length) {
			break;
		}
	}
	log("Done.");
}

export function goto(x: number, y: number) {
	process.stdout.write(`\x1b[${y+1};${x+1}H`);
} 
