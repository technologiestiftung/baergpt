import React from "react";
import Content from "../../../content.ts";

export const ChatInfoMessage: React.FC = () => {
	return (
		<div className="flex flex-col gap-1 w-full px-3 py-[18px] text-dunkelblau-100 rounded-[3px] bg-hellblau-50">
			<span className="flex gap-1 items-center">
				<img
					src="/icons/info-icon-blue.svg"
					alt={Content["chat.infoText.imgAlt"]}
					className="w-4 h-4"
				/>
				<h3 className="text-sm leading-5 font-semibold">
					{Content["chat.infoText.title"]}
				</h3>
			</span>
			<p className="text-sm leading-5 font-normal">
				{Content["chat.infoText.p1"]}
			</p>
		</div>
	);
};
