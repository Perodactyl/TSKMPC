type ColorMode = "4bit" | "8bit" | "24bit" | "reset";

export class Color {
	private mode: ColorMode = "reset";

	private red = 0;
	private green = 0;
	private blue = 0;
	
	private paletteColor = 0;

	public toFGString() {
		switch(this.mode) {
			case "reset": return "\x1b[39m";
			case "4bit":
				if(this.paletteColor >= 8) return `\x1b[${this.paletteColor + 72}m`;
				else return `\x1b[${this.paletteColor + 30}m`;
			case "8bit": return `\x1b[38;5;${this.paletteColor}m`;
			case "24bit": return `\x1b[38;2;${this.red};${this.green};${this.blue}m`;
		}
	}
	public toBGString() {
		switch(this.mode) {
			case "reset": return "\x1b[49m";
			case "4bit":
				if(this.paletteColor >= 8) return `\x1b[${this.paletteColor + 82}m`;
				else return `\x1b[${this.paletteColor + 40}m`;
			case "8bit": return `\x1b[48;5;${this.paletteColor}m`;
			case "24bit": return `\x1b[48;2;${this.red};${this.green};${this.blue}m`;
		}
	}

	public static palette(n: number) {
		let c = new Color();
		c.mode = "4bit";
		c.paletteColor = n;
		return c;
	}

	public static color256(n: number) {
		let c = new Color();
		c.mode = "8bit";
		c.paletteColor = n;
		return c;
	}

	public static rgb(r: number, g: number, b: number) {
		let c = new Color();
		c.mode = "24bit";
		c.red = r;
		c.green = g;
		c.blue = b;
	}

	public static hex(value: number) {
		return Color.rgb(value >> 16, (value >> 8) & 0xFF, value & 0xFF);
	}

	public static RESET   = new Color();

	public static BLACK   = Color.palette(0);
	public static RED     = Color.palette(1);
	public static GREEN   = Color.palette(2);
	public static YELLOW  = Color.palette(3);
	public static BLUE    = Color.palette(4);
	public static MAGENTA = Color.palette(5);
	public static CYAN    = Color.palette(6);
	public static WHITE   = Color.palette(7);

	public static BRIGHT_BLACK   = Color.palette(8);
	public static BRIGHT_RED     = Color.palette(9);
	public static BRIGHT_GREEN   = Color.palette(10);
	public static BRIGHT_YELLOW  = Color.palette(11);
	public static BRIGHT_BLUE    = Color.palette(12);
	public static BRIGHT_MAGENTA = Color.palette(13);
	public static BRIGHT_CYAN    = Color.palette(14);
	public static BRIGHT_WHITE   = Color.palette(15);
}
