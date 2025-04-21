declare module "vow-xamel";

declare class XamelNodeSet {
	children: Tag[];
	toString(): string;
	append(node: Tag | Comment | String);
	get(expr: string): NodeSet;
	explode(): NodeSet;
	find(expr: string|string[]): NodeSet | string;
	$(expr: string|string[]): NodeSet | String;
	text(keepArray: false): string[];
	text(keepArray: true): string;
	hasAttr(name: string): NodeSet;
	isAttr(name: string, value: string | null): NodeSet;
	eq(index: number): Tag | Comment | String | null;

	get length(): number;

	join: Array<Tag>["join"];
	indexOf: Array<Tag>["indexOf"];
	lastIndexOf: Array<Tag>["lastIndexOf"];
	forEach: Array<Tag>["forEach"];
	map: Array<Tag>["map"];
	reduce: Array<Tag>["reduce"];
	reduceRight: Array<Tag>["reduceRight"];
	filter: Array<Tag>["filter"];
	some: Array<Tag>["some"];
	every: Array<Tag>["every"];
	concat: Array<Tag>["concat"];
	slice: Array<Tag>["slice"];
}

declare class XamelTag extends XamelNodeSet {
	public name: string;
	public attrs: Record<string, string>;
	public parent?: NodeSet;
	constructor(name: string, attrs: Record<string, string>, parent?: NodeSet);
	attr(name: string): string | null;
	get(expr: string): NodeSet;
}

declare class XamelComment {
	public comment: string;
	constructor(comment: string);
	toString(): string;
}

export type NodeSet = XamelNodeSet;
export type Tag = XamelTag;
export type Comment = XamelComment;

type XamelOptions = Object;

export function parse(xmlString: string, options?: XamelOptions): Promise<NodeSet>;

export function serialize(nset: any, options: any): any;

