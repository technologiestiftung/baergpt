import { type AnchorHTMLAttributes, useEffect, useState } from "react";
import { AnchorLinkTargetBlank } from "./anchor-link-target-blank.tsx";

/**
 * Temporary embed for published Datawrapper charts, for local testing.
 * TODO: replace with the final design.
 *
 * Model output is never rendered as raw HTML, so instead of trusting an
 * <iframe> from the model, we build it ourselves from an allowlisted URL.
 * The chart id must also be in `allowedChartIds` (the ids this message's own
 * `publish_visualization` calls actually produced) — otherwise the link could
 * be an unrelated Datawrapper chart surfaced via web search, RAG or Open Data
 * content and reproduced in the model's text.
 */

const DATAWRAPPER_ORIGIN = "https://datawrapper.dwcdn.net";
const DATAWRAPPER_CHART_URL =
	/^https:\/\/datawrapper\.dwcdn\.net\/([A-Za-z0-9_-]{5})\/(\d+\/)?$/;

const DEFAULT_HEIGHT_PX = 400;

function DatawrapperEmbed({ chartId, src }: { chartId: string; src: string }) {
	const [height, setHeight] = useState(DEFAULT_HEIGHT_PX);

	// Datawrapper charts report their content height via postMessage
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const reportedHeight = event.data?.["datawrapper-height"]?.[chartId];
			if (event.origin === DATAWRAPPER_ORIGIN && reportedHeight > 0) {
				setHeight(reportedHeight);
			}
		};
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [chartId]);

	return (
		<iframe
			title="Datawrapper-Diagramm"
			src={src}
			height={height}
			sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
			referrerPolicy="no-referrer"
			loading="lazy"
			className="block w-full border-0 my-2"
		/>
	);
}

/**
 * Builds a markdown link renderer that additionally embeds published
 * Datawrapper charts, restricted to `allowedChartIds`.
 */
export function createMarkdownLinkWithDatawrapperEmbed(
	allowedChartIds: string[],
) {
	return function MarkdownLinkWithDatawrapperEmbed(
		props: AnchorHTMLAttributes<HTMLAnchorElement>,
	) {
		const chartId = props.href?.match(DATAWRAPPER_CHART_URL)?.[1];

		if (!props.href || !chartId || !allowedChartIds.includes(chartId)) {
			return <AnchorLinkTargetBlank {...props} />;
		}

		return (
			<>
				<DatawrapperEmbed chartId={chartId} src={props.href} />
				<AnchorLinkTargetBlank {...props} />
			</>
		);
	};
}
