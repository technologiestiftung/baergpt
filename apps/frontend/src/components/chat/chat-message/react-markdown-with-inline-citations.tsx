import { Children, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownWrapperScrollableTable } from "../../primitives/markdown/markdown-wrapper-scrollable-table";
import { InlineCitation } from "./chat-citations/inline-citation";
import { useCitationsStore } from "../../../store/use-citations-store.ts";

export function ReactMarkdownWithInlineCitations({
	content,
	citations: citationIds,
	className,
}: {
	content: string;
	citations?: number[] | null;
	className?: string;
}) {
	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			className={className}
			components={{
				...markdownWrapperScrollableTable,
				p: ({ children }) => (
					<p>
						<ChildrenWithCitations
							children={children}
							citationIds={citationIds}
						/>
					</p>
				),
				li: ({ children }) => (
					<li>
						<ChildrenWithCitations
							children={children}
							citationIds={citationIds}
						/>
					</li>
				),
			}}
		>
			{content}
		</ReactMarkdown>
	);
}

function ChildrenWithCitations({
	children,
	citationIds,
}: {
	children: ReactNode;
	citationIds?: number[] | null;
}) {
	return (
		<>
			{Children.map(children, (child) => {
				if (typeof child === "string") {
					return (
						<TextWithInlineCitations
							text={child}
							citationIds={citationIds}
						/>
					);
				}

				return child;
			})}
		</>
	);
}

function TextWithInlineCitations({
	text,
	citationIds,
}: {
	text: string;
	citationIds?: number[] | null;
}): Array<ReactNode | string> {
	const { getCitation } = useCitationsStore();
	const citationNumberRegex = /\[(\d+)\]/g;

	const citationMatches = Array.from(text.matchAll(citationNumberRegex));

	if (citationMatches.length === 0) {
		return [text];
	}

	return citationMatches.reduce(
		(reactNodes: Array<ReactNode | string>, citationMatch, index) => {
			const currentCitationStart = citationMatch.index || 0;
			const previousCitationEnd = getPreviousMatchEnd(index, citationMatches);

			const hasTextBetweenCitations =
				currentCitationStart > previousCitationEnd;

			if (hasTextBetweenCitations) {
				const textBetweenCitations = text.slice(
					previousCitationEnd,
					currentCitationStart,
				);
				reactNodes.push(textBetweenCitations);
			}

			const [_, citationNumberWithoutBrackets] = citationMatch;

			const citationNumber = Number(citationNumberWithoutBrackets);
			const citationId = citationIds?.[citationNumber - 1];
			const citation = citationId !== undefined ? getCitation(citationId) : undefined;

			reactNodes.push(
				<span
					key={`c-${citationMatch.index}`}
					className={"inline-flex -translate-y-0.5"}
				>
					<InlineCitation citation={citation} citationNumber={citationNumber} />
				</span>,
			);

			const currentMatchEnd = getMatchEnd(citationMatch);

			const hasTextAfterLastCitation =
				index === citationMatches.length - 1 && currentMatchEnd < text.length;

			if (hasTextAfterLastCitation) {
				const textAfterLastCitation = text.slice(currentMatchEnd);
				reactNodes.push(textAfterLastCitation);
			}

			return reactNodes;
		},
		[],
	);
}

function getPreviousMatchEnd(index: number, matches: RegExpMatchArray[]) {
	if (index === 0) {
		return 0;
	}

	const previousMatch = matches[index - 1];

	return getMatchEnd(previousMatch);
}

function getMatchEnd(match: RegExpMatchArray) {
	const [citationNumberWithBrackets] = match;
	const matchStart = match.index || 0;

	return matchStart + citationNumberWithBrackets.length;
}
