import Content from "../../../content";

/**
 * Renders a square add-to-chat icon image using the dark SVG asset.
 *
 * @param size - Pixel size for both width and height (defaults to 24)
 * @returns An HTMLImageElement (`<img>`) with `src` set to `/icons/add-to-chat-dark-icon.svg` and `alt` taken from the content map
 */
export function AddToChatIcon({ size = 24 }: { size?: number }) {
	return (
		<img
			src="/icons/add-to-chat-dark-icon.svg"
			width={size}
			height={size}
			alt={Content["addToChatIcon.add.imgAlt"]}
		/>
	);
}