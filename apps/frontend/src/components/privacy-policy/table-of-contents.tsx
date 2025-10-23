import React from "react";
import Content from "../../content.ts";

export const TableOfContents = ({
	onSectionClick,
}: {
	onSectionClick: (
		event: React.MouseEvent<HTMLAnchorElement>,
		sectionId: string,
	) => void;
}) => {
	const items = [
		Content["privacyPolicyPage.section1.title"],
		Content["privacyPolicyPage.section2.title"],
		Content["privacyPolicyPage.section3.title"],
		Content["privacyPolicyPage.section4.title"],
		Content["privacyPolicyPage.section5.title"],
		Content["privacyPolicyPage.section6.title"],
		Content["privacyPolicyPage.section7.title"],
		Content["privacyPolicyPage.section8.title"],
		Content["privacyPolicyPage.section9.title"],
		Content["privacyPolicyPage.section10.title"],
	];
	return (
		<div className="lg:mb-4">
			<ol className="list-none pl-0 flex flex-col gap-1.5">
				{items.map((item, index) => (
					<li key={index}>
						<a
							href={`#section-${index + 1}`}
							onClick={(e) => onSectionClick(e, `section-${index + 1}`)}
							className="flex gap-2 text-lg leading-7 font-semibold lg:text-xl group focus:none focus-visible:outline-none"
						>
							<span className="w-6 flex-shrink-0">{index + 1}.</span>
							<span className="group-hover:underline underline-offset-[5px] group-focus-visible:underline group-focus-visible:outline-default outline-offset-2 rounded-3px">
								{item}
							</span>
						</a>
					</li>
				))}
			</ol>
		</div>
	);
};
