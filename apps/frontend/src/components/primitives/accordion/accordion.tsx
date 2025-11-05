import React, { useState } from "react";
import Content from "../../../content.ts";

type AccordionProps = {
	question: string;
	answer: string | React.ReactNode;
	openByDefault?: boolean;
};

export const Accordion: React.FC<AccordionProps> = ({
	question,
	answer,
	openByDefault = false,
}) => {
	const [isExpanded, setIsExpanded] = useState(openByDefault);

	return (
		<div className="w-full bg-hellblau-50 rounded-[3px] hover:bg-hellblau-60">
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="p-2.5 sm:p-4 w-full flex justify-between items-center text-left cursor-pointer focus-outline-default"
			>
				<h3 className="max-w-[679px] text-base leading-6 font-semibold sm:text-lg lg:text-xl sm:leading-7">
					{question}
				</h3>
				<span className="ml-4 min-w-6">
					{isExpanded ? (
						<img
							src="/icons/chevron-up-icon.svg"
							alt={Content["landingPage.safety.accordion.chevronUpAltText"]}
						/>
					) : (
						<img
							src="/icons/chevron-down-icon.svg"
							alt={Content["landingPage.safety.accordion.chevronDownAltText"]}
						/>
					)}
				</span>
			</button>
			{isExpanded && (
				<div className="max-w-[679px] px-2.5 pb-2.5 sm:px-4 md:pr-0 sm:pb-4 mt-1 lg:mt-5 text-base leading-6 font-normal text-start">
					{answer}
				</div>
			)}
		</div>
	);
};
