import { UIComponent, TextComponent, componentClasses } from ".";
import { log, TSKMPC } from "../";
import { goto, KittyImage, KittyImagePlacement } from "../kitty";
import { parse, type Tag } from "vow-xamel";
import { escapeString } from "../mpd";

function tryParseInt(value: string): string | number {
	try {
		//@ts-ignore
		if(isNaN(value)) return value;
		let output = parseInt(value);
		if(output != output) return value;
		return output;
	} catch(e) {
		return value;
	}
}

/**
* Containers can have children. In general, containers inherit the width they are given, while components define their own width.
* */
export class UIContainer extends UIComponent {
	public static override name = "UIContainer";
	[Symbol.toStringTag] = "UIContainer";
	public children: UIComponent[] = [];
	public appendChild(child: UIComponent) {
		this.children.push(child);
		child.parent = this;
		this.onChildAdded(child);
	}
	public trySelectChildByID(id: string): UIComponent | null {
		for(let child of this.children) {
			if(child.id == id) return child;
			if(child instanceof UIContainer) { // Depth-first search.
				let result = child.trySelectChildByID(id);
				if(result) return result;
			}
		}
		return null;
	}
	public selectChildByID(id: string): UIComponent {
		let output = this.trySelectChildByID(id);
		if(!output) throw new TypeError(`No component was found with ID "${id}"`);
		return output;
	}
	public selectChildrenByClass(...classes: string[]): UIComponent[] {
		let output = [];
		if(this.matchesClass(...classes)) output.push(this);
		for(let child of this.children) {
			if(child.matchesClass(...classes)) output.push(child);
			if(child instanceof UIContainer) output.push(...child.selectChildrenByClass(...classes));
		}
		return output;
	}
	protected override onChildResized(child: UIComponent) {
		this.positionChildren();
	}
	protected override onResize() {
		this.positionChildren();
	}
	protected onChildAdded(child: UIComponent) {
		this.positionChildren();
	}
	protected positionChildren() {
		for(let child of this.children) {
			this.positionChild(child);
		}
	}
	protected positionChild(child: UIComponent) {

	}
	public override update() {
		for(let child of this.children) child.update();
	}
	public override draw() {
		for(let child of this.children) {
			child.draw();
		}
	}
	public override get preferredWidth() {
		return null;
	}
	public override get preferredHeight() {
		return null;
	}

	public override async event(name: string): Promise<void> {
		await this.onEvent(name);
		for(let child of this.children) {
			await child.event(name);
		}
	}
	private static instantiateChild(application: TSKMPC, child: string | Tag): UIComponent | null {
		if(typeof child == "string") {
			return new TextComponent(application, child);
		}
		if("comment" in child) return null;
		let targetClass = componentClasses.find(c=>c.name == child.name);
		if(!targetClass) throw new Error(`<${child.name}> has no candidate class to instantiate.`);
		
		let instance = new targetClass(application);
		Object.keys(child.attrs).forEach(attrName => {
			if(attrName in instance) //@ts-ignore
				instance[attrName] = tryParseInt(child.attrs[attrName]);
			else if(attrName == "class")
				instance.classes.push(...child.attrs[attrName].split(" "));
			else throw new Error(`Attribute "${attrName}" is not valid on tag "${child.name}".`);
		});
		if(instance instanceof UIContainer) {
			for(let subChild of child.children) {
				let subChildInstance = this.instantiateChild(application, subChild)
				if(subChildInstance) instance.appendChild(subChildInstance);
			}
		} else if(child.name == TextComponent.name) {
			//@ts-ignore
			instance.text = child.children.filter(c => typeof c == "string").join(" ");
		} else if(child.children.length > 0) {
			throw new Error(`Tag "${child.name}" is not a container, so it can't have children.`);
		}
		
		return instance;
	}
	public static async createFromXML(application: TSKMPC, xml: string) {
		let dom = await parse(xml);
		let output = this.instantiateChild(application, dom.children[0]);
		if(!output) throw new Error("Failed to load XML root.");
		output.resize();
		return output;
	}
}
componentClasses.push(UIContainer);

export class CenterContainer extends UIContainer {
	public static override name = "CenterContainer";
	protected override positionChild(child: UIComponent) {
		let baseX = this.x + (this.width  / 2);
		let baseY = this.y + (this.height / 2);
		child.x = Math.floor(baseX - child.width  / 2);
		child.y = Math.floor(baseY - child.height / 2);
	}
}
componentClasses.push(CenterContainer);

export class MarginContainer extends UIContainer {
	public static override name = "MarginContainer";
	constructor(
		application: TSKMPC,
		public marginLeft:   number = 0,
		public marginRight:  number = 0,
		public marginTop:    number = 0,
		public marginBottom: number = 0
	) {
		super(application);
	}
	protected override positionChild(child: UIComponent) {
		child.x = this.x + this.marginLeft;
		child.y = this.y + this.marginTop;
		child.width  = this.width  - this.marginRight;
		child.height = this.height - this.marginBottom;
	}
}
componentClasses.push(MarginContainer);

///Fixes the size of children.
export class FixedContainer extends CenterContainer {
	public static override name = "FixedContainer";
	constructor(
		application: TSKMPC,
		public targetWidth:  number = 0,
		public targetHeight: number = 0
	) {
		super(application);
	}
	protected override positionChild(child: UIComponent) {
		child.x = this.x;
		child.y = this.y;
		if(this.targetWidth > 0)child.width = this.targetWidth;
		if(this.targetHeight > 0)child.height = this.targetHeight;
	}
	protected override onResize() {
		if(this.targetWidth > 0)this.width = this.targetWidth;
		if(this.targetHeight > 0)this.height = this.targetHeight;
		super.onResize();
	}
}
componentClasses.push(FixedContainer);

type BorderContainerStyle = "round" | "square" | "double" | "thick";
const borders: Record<BorderContainerStyle, {tl:string,tr:string,bl:string,br:string,h:string,v:string}> = {
	round: {
		tl: "╭",
		tr: "╮",
		bl: "╰",
		br: "╯",
		h: "─",
		v: "│",
	},
	square: {
		tl: "┌",
		tr: "┐",
		bl: "└",
		br: "┘",
		h: "─",
		v: "│",
	},
	double: {
		tl: "╔",
		tr: "╗",
		bl: "╚",
		br: "╝",
		h: "═",
		v: "║",
	},
	thick: {
		tl: "┏",
		tr: "┓",
		bl: "┗",
		br: "┛",
		h: "━",
		v: "┃",
	}
}
export class BorderContainer extends MarginContainer {
	public static override name = "BorderContainer";
	public style: BorderContainerStyle = "square";
	constructor(
		application: TSKMPC,
		public marginLeft:   number = 1,
		public marginRight:  number = 1,
		public marginTop:    number = 1,
		public marginBottom: number = 1
	) {
		super(application);
	}
	override draw() {
		if(this.width <= 0 || this.height <= 0) {
			return;
		}
		let s = borders[this.style] ?? borders.square;
		goto(this.x, this.y);
		process.stdout.write(s.tl + s.h.repeat(this.width - 2) + s.tr);
		for(let row = this.y+1; row < this.y+this.height-1; row++) {
			goto(this.x, row);
			process.stdout.write(s.v);
			goto(this.x+this.width-1, row);
			process.stdout.write(s.v);
		}
		goto(this.x, this.y+this.height-1);
		process.stdout.write(s.bl + s.h.repeat(this.width - 2) + s.br);
		super.draw();
	}
}
componentClasses.push(BorderContainer);

type ListContainerJustify = "even" | "begin" | "end";
type ListContainerOrientation = "horizontal" | "vertical";

export class ListContainer extends UIContainer {
	public static override name = "ListContainer";
	public orientation: ListContainerOrientation = "vertical";
	public justify: ListContainerJustify = "even";
	protected override positionChildren() {
		if(this.orientation == "vertical") {
			if(this.justify == "even") {
				let height = this.height / this.children.length;
				for(let i = 0; i < this.children.length; i++) {
					let child = this.children[i];
					child.x = this.x;
					child.y = this.y + Math.floor(height * i);
					child.width = this.width;
					child.height = Math.floor(height);
				}
			} else if(this.justify == "begin") {
				let currentTop = 0;
				for(let i = 0; i < this.children.length; i++) {
					let child = this.children[i];
					child.x = this.x;
					child.y = this.y + currentTop;
					child.width = this.width;
					currentTop += child.height;
				}
			} else if(this.justify == "end") {
				let currentTop = this.height;
				for(let i = this.children.length-1; i >= 0; i--) {
					let child = this.children[i];
					child.x = this.x;
					currentTop -= child.height;
					child.y = this.y + currentTop;
					child.width = this.width;
				}
			} else {
				throw new Error(`ListContainer.justify must be one of "even", "begin", "end". (Got "${this.justify}")`);
			}
		} else if(this.orientation == "horizontal") {
			if(this.justify == "even") {
				let width = this.width / this.children.length;
				for(let i = 0; i < this.children.length; i++) {
					let child = this.children[i];
					child.x = this.x + Math.floor(width * i);
					child.y = this.y;
					child.width = Math.floor(width);
					child.height = this.height;
				}
			} else if(this.justify == "begin") {
				let currentLeft = 0;
				for(let i = 0; i < this.children.length; i++) {
					let child = this.children[i];
					child.x = this.x + currentLeft;
					child.y = this.y;
					child.height = this.height;
					currentLeft += child.width;
				}
			} else if(this.justify == "end") {
			} else {
				throw new Error(`ListContainer.justify must be one of "even", "begin", "end". (Got "${this.justify}")`);
			}
		} else {
			throw new Error(`ListContainer.orientation must be one of "horizontal", "vertical". (Got "${this.orientation}")`);
		}
	}
	protected override onChildAdded(child: UIComponent) {
		this.positionChildren();
	}
	protected override onChildResized(child: UIComponent) {
		this.positionChildren();
	}
}
componentClasses.push(ListContainer);

export class CoverImageContainer extends FixedContainer { //Only shows children if no image was found.
	public static override name = "CoverImage";
	private imageData: Buffer = Buffer.alloc(0);
	private image: KittyImage | null = null;
	protected override async onEvent(name: string): Promise<void> {
		if(!this.application.mpd) return;
		let response;
		try {
			response = await this.application.mpd.requestBinary(`albumart "${escapeString(this.application.currentSongMetaData.get("file") ?? "null")}" $$`);
		} catch(e) {}
		if(response) {
			let binary = response.getBinary();
			if(binary) {
				this.imageData = binary;
				//let stream = createWriteStream("imageData");
				this.image = new KittyImage(this.imageData, 7);
				return;
				//stream.close();
			}
		}
		this.image = null;
	}
	public override draw(): void {
		if(!this.image) {
			log("Cannot display cover: image not loaded.");
			super.draw();
			return;
		}
		let p = new KittyImagePlacement(this.image, 1);
		p.cellX = this.x;
		p.cellY = this.y;
		p.cellWidth = this.width;
		p.cellHeight = this.height;
		p.display();
	}
}
componentClasses.push(CoverImageContainer);
