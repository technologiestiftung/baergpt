import React from "react";
import Content from "../../../content.ts";

export const ChatErrorMessage: React.FC = () => {
	return (
		<div className="flex flex-col gap-1 w-full px-3 py-[18px] text-warning-100 rounded-[3px] bg-warning-10">
			<p>
				<span className="flex gap-1 items-center">
					<img
						src="/icons/error-icon.svg"
						alt={Content["chat.errorIcon.imgAlt"]}
						className="w-4 h-4"
					/>
					<span className="text-sm leading-5 font-semibold">
						{Content["chat.errorText.title"]}
					</span>
				</span>
				<span className="text-sm leading-5 font-normal pl-5">
					{" "}
					{Content["chat.errorText.p1"]}
				</span>
			</p>
			<span className="text-sm leading-5 font-normal pl-5">
				{Content["chat.errorText.p2"]}
				<a
					href={Content["chat.errorText.helpPage.link"]}
					className="text-sm leading-5 font-normal underline cursor-pointer text-dunkelblau-100"
					target="_blank"
					rel="noopener noreferrer"
				>
					{Content["chat.errorText.helpPage.linkText"]}
				</a>
			</span>
		</div>
	);
};
