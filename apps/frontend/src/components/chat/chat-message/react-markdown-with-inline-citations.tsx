import {
	type AnchorHTMLAttributes,
	isValidElement,
	type MouseEvent,
	type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownWrapperScrollableTable } from "../../primitives/markdown/markdown-wrapper-scrollable-table";
import {
	addChunkIdToCache,
	useCitationsStore,
} from "../../../store/use-citations-store.ts";
import { downloadDocument } from "../../../api/documents/download-document.ts";

export function ReactMarkdownWithInlineCitations({
	content,
	className,
}: {
	content: string;
	citations?: number[] | null;
	className?: string;
}) {
	console.log("pre-fix", content);

	const fixedContent = fixOrphanedFootnotes(content);

	console.log("post-fix", fixedContent);

	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			className={className}
			components={{
				...markdownWrapperScrollableTable,
				sup: ({ children }) => <span>{children}</span>,
				a: ({ children, ...props }) => {
					// @ts-expect-error this is a custom field and now recognized by typescript
					if (props?.["data-footnote-ref"] === true) {
						return (
							<a
								className="inline-flex items-center justify-center rounded-sm text-xs
						cursor-pointer size-[18px] mx-1
						bg-hellblau-50 focus-visible:outline-default
						hover:bg-dunkelblau-100 text-dunkelblau-80 hover:text-white
						no-underline
					"
								{...props}
							>
								{children}
							</a>
						);
					}

					const isNumberRegex = /^\d+$/;
					const isChunkIdLink =
						props.href !== undefined && isNumberRegex.test(props.href);

					if (isChunkIdLink) {
						return <CitationLink {...props}>{children}</CitationLink>;
					}

					return (
						<a
							className="text-dunkelblau-100 underline hover:text-dunkelblau-200"
							{...props}
						>
							{children}
						</a>
					);
				},
				li: ({ children, ...props }) => {
					if (!props.id?.startsWith("user-content-fn")) {
						return <li {...props}>{children}</li>;
					}

					const footnoteNumber = props.id.replace("user-content-fn-", "");

					const withFootnoteNumber = Array.isArray(children)
						? children.map((child: ReactNode) => {
								if (isValidElement(child) && child.type === "p") {
									return {
										...child,
										props: {
											...child.props,
											children: (
												<span className="flex gap-2">
													<span
														className={`
															inline-flex items-center justify-center mt-0.5 px-2
															rounded-sm text-xs size-[18px] 
															bg-hellblau-50 text-dunkelblau-80
														`}
													>
														{footnoteNumber}
													</span>
													<span className="block">{child.props.children}</span>
												</span>
											),
										},
									};
								}
								return child;
							})
						: children;

					return (
						<li className={`list-none`} style={{ paddingLeft: 0 }} {...props}>
							{withFootnoteNumber}
						</li>
					);
				},
				ol: ({ children, ...props }) => {
					if (
						(Array.isArray(children) ? children : []).some(
							(child: ReactNode) =>
								isValidElement(child) &&
								child.props?.id?.startsWith("user-content-fn"),
						)
					) {
						return (
							<ol
								className={`list-none`}
								style={{ paddingLeft: "1rem" }}
								{...props}
							>
								{children}
							</ol>
						);
					}

					return <ol {...props}>{children}</ol>;
				},
			}}
		>
			{fixedContent}
		</ReactMarkdown>
	);
}

function CitationLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
	const { citationByChunkId } = useCitationsStore();

	const chunkId = Number(props.href);
	const citation = citationByChunkId[chunkId];

	addChunkIdToCache(chunkId);

	if (!citation) {
		return <a {...props}>{props.children}</a>;
	}

	const handleClick = async (
		event: MouseEvent<HTMLAnchorElement, globalThis.MouseEvent>,
	) => {
		event.preventDefault();

		const blob = await downloadDocument(citation);

		if (!blob) {
			return;
		}

		const temporaryUrl = `${URL.createObjectURL(blob)}#page=${citation.page}`;

		window.open(temporaryUrl, "_blank");

		URL.revokeObjectURL(temporaryUrl);
	};

	return (
		<a
			{...props}
			className="text-dunkelblau-100 underline hover:text-dunkelblau-200"
			type="button"
			href={"#"}
			/* todo move this to content file */
			aria-label={"Öffnet die Quelle in einem neuen Tab"}
			onClick={handleClick}
		>
			{props.children}
		</a>
	);
}

function fixOrphanedFootnotes(content: string): string {
	// Find all footnote definitions
	const definitionIds = new Set<string>();
	for (const match of content.matchAll(/^\[\^(\d+)\]:/gm)) {
		definitionIds.add(match[1]);
	}

	if (definitionIds.size === 0) {
		return content;
	}

	// Find all footnote references (not followed by colon)
	const referenceIds = new Set<string>();
	for (const match of content.matchAll(/\[\^(\d+)\](?!:)/g)) {
		referenceIds.add(match[1]);
	}

	// Replace only orphaned definitions: [^N]: content → - content
	let result = content;
	for (const id of definitionIds) {
		if (!referenceIds.has(id)) {
			result = result.replace(
				new RegExp(`^\\[\\^${id}\\]:\\s*(.+)$`, "m"),
				"- $1",
			);
		}
	}

	return result;
}
