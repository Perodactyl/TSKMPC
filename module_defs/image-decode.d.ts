declare module "image-decode";
export default function decode(data: Buffer): {data: number[], width:number, height:number};
