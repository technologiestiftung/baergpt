import React from "react";

type TableOfContentsItem = {
	title: string;
	id?: string;
	subsections?: TableOfContentsItem[];
};

type TableOfContentsProps = {
	items: (string | TableOfContentsItem)[];
};

const TableOfContentsSection: React.FC<{
	item: TableOfContentsItem;
	index: number;
	parentIndex?: number;
}> = ({ item, index, parentIndex }) => {
	const sectionNumber =
		parentIndex !== undefined
			? `${parentIndex + 1}.${index + 1}`
			: `${index + 1}`;
	const sectionId = item.id || `section-${sectionNumber.replace(".", "-")}`;

	return (
		<li>
			<a
				href={`#${sectionId}`}
				className={`flex gap-2 leading-7 font-semibold group focus:none focus-visible:outline-none ${
					parentIndex !== undefined
						? "text-base lg:text-lg"
						: "text-lg lg:text-xl"
				}`}
			>
				<span
					className={`flex-shrink-0 ${
						parentIndex !== undefined ? "w-8" : "w-6"
					}`}
				>
					{sectionNumber}.
				</span>
				<span className="group-hover:underline underline-offset-[5px] group-focus-visible:underline group-focus-visible:outline-default outline-offset-2 rounded-3px">
					{item.title}
				</span>
			</a>
			{item.subsections && item.subsections.length > 0 && (
				<ol className="list-none pl-8 flex flex-col gap-1 mt-1.5">
					{item.subsections.map((subsection, subIndex) => (
						<TableOfContentsSection
							key={subIndex}
							item={subsection}
							index={subIndex}
							parentIndex={index}
						/>
					))}
				</ol>
			)}
		</li>
	);
};

export const TableOfContents: React.FC<TableOfContentsProps> = ({ items }) => {
	const normalizedItems: TableOfContentsItem[] = items.map((item) =>
		typeof item === "string" ? { title: item } : item,
	);

	return (
		<div className="lg:mb-4">
			<ol className="list-none pl-0 flex flex-col gap-1.5">
				{normalizedItems.map((item, index) => (
					<TableOfContentsSection key={index} item={item} index={index} />
				))}
			</ol>
		</div>
	);
};
