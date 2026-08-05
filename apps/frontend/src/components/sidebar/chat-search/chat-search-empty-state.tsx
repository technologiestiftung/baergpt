import React from "react";
import Content from "../../../content";

export const ChatSearchEmptyState: React.FC<{ query: string }> = ({
	query,
}) => {
	const truncatedQuery =
		query.length > 100 ? `${query.slice(0, 100)}...` : query;
	return (
		<div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center h-full min-h-[376px]">
			<img
				src="/icons/chat-search-empty-icon.png"
				alt={Content["chatSearchDialog.noResults.icon.alt"]}
				width={53}
				height={53}
			/>
			<div className="flex flex-col gap-1 max-w-[360px]">
				<p className="font-semibold text-dunkelblau-100">
					{Content["chatSearchDialog.noResults.title.prefix"]}
					{`„${truncatedQuery}“`}
					{Content["chatSearchDialog.noResults.title.suffix"]}
				</p>
				<p className="text-sm leading-5 text-dunkelblau-70">
					{Content["chatSearchDialog.noResults.subtitle"]}
				</p>
			</div>
		</div>
	);
};
