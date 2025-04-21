import { goto } from "../kitty";
import { log, TSKMPC } from "../index";
import { Color } from "./color";
import { UIContainer } from "./container";

// Totally not a DOM. No. Not at all. DOM definitely isn't one of the core parts of JS.

export interface BoundingBox {
	x: number,
	y: number,
	width: number,
	height: number,
}

//Components should update all their parents first, then themselves.

/** For a component to be identified by the XML reader, it must be in this list. */
export let componentClasses: Array<{ new(application: TSKMPC): UIComponent|UIContainer }> = [];

export class UIComponent {
	public static name: string = "UIComponent";
	[Symbol.toStringTag] = "UIComponent"
	public parent?: UIComponent;
	public id?: string;
	public classes: string[] = [];
	public grow?: number = 1; //Ratio used by ListContainers when justify="even"
	private boundingBox: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };
	constructor(protected application: TSKMPC) {}
	public update() {
		this.onUpdate();
	}
	public get x() {
		return this.boundingBox.x;
	}
	public get y() {
		return this.boundingBox.y;
	}
	public set x(value: number) {
		this.boundingBox.x = value;
	}
	public set y(value: number) {
		this.boundingBox.y = value;
	}
	public get width() {
		return this.boundingBox.width;
	}
	public set width(value: number) {
		if(value != this.boundingBox.width) {
			this.boundingBox.width = value;
			this.resize();
		}
	}
	public get height() {
		return this.boundingBox.height;
	}
	public set height(value: number) {
		if(value != this.boundingBox.height) {
			this.boundingBox.height = value;
			this.resize();
		}
	}
	public get preferredWidth(): number | null {
		return this.width;
	}
	public get preferredHeight(): number | null {
		return this.height;
	}
	public resize() {
		this.onResize();

		if(this.parent) this.parent.onChildResized(this);
	}
	protected onChildResized(child: UIComponent) {

	}
	protected onResize() {

	}
	protected onUpdate() {

	}
	public async event(name: string) {
		await this.onEvent(name);
	}
	protected async onEvent(name: string) {

	}
	public draw() {

	}
	public matchesClass(...classes:string[]) {
		return this.classes.filter(c=>classes.includes(c)).length > 0;
	}
}
componentClasses.push(UIComponent);

export class TextComponent extends UIComponent {
	public static override name = "Text";
	constructor(application: TSKMPC, protected message: string = "", public scale: number = 1, public color: Color = Color.RESET) {
		super(application);
	}
	public override get preferredWidth() {
		return Math.ceil(this.message.length * this.scale)
	}
	public override get preferredHeight() {
		return this.scale;
	}
	set text(value: string) {
		this.message = value;
		this.width = Math.ceil(value.length * this.scale);
		this.height = this.scale;
	}
	override draw() {
		goto(this.x, this.y);
		process.stdout.write(this.color.toFGString());
		if(this.scale == 1) {
			process.stdout.write(this.message);
		} else {
			process.stdout.write(`\x1b]66;s=${this.scale};${this.message}\x07`);
		}
	}
}
componentClasses.push(TextComponent);

export class FillComponent extends UIComponent {
	public static override name = "Fill";
	public color: Color = Color.WHITE;
	override draw() {
		for(let row = this.y; row <= this.y+this.height; row++) {
			goto(this.x, row);
			process.stdout.write(`${this.color.toBGString()}${" ".repeat(this.width-this.x)}`);
		}
	}
}
componentClasses.push(FillComponent);

export class SongDataComponent extends TextComponent {
	public static override name = "SongData";
	public key = "Title";
	public default = "Unnamed Song";
	protected override async onEvent(name: string): Promise<void> {
	        if(name == "nextSong") {
			this.text = this.application.currentSongMetaData.get(this.key) ?? this.default;
		}
	}
}
componentClasses.push(SongDataComponent);
