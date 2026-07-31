import React from "react";
import Content from "../../../content";

const SKELETON_ROW_COUNT = 6;

function LightSkeleton({ className }: { className: string }) {
	return (
		<div
			className={`relative rounded-sm overflow-hidden before:rounded-sm before:absolute before:inset-0 before:bg-[length:200%_100%] before:animate-gradient-move before:bg-[linear-gradient(90deg,_theme('colors.hellblau-50')_0%,_rgba(245,248,252,0.8)_63%,_theme('colors.hellblau-50')_100%)] ${className}`}
		/>
	);
}

export const ChatSearchSkeleton: React.FC = () => {
	return (
		<ul className="flex flex-col" aria-busy="true" aria-live="polite">
			<p className="text-dunkelblau-70 text-xs leading-4 pl-3 pb-2">
				{Content["chatSearchDialog.results"]}
			</p>
			{Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
				<li
					key={index}
					className="flex items-start gap-3 p-3"
					aria-hidden="true"
				>
					<LightSkeleton className="size-[28px] shrink-0" />
					<div className="flex flex-col gap-1 w-full">
						<LightSkeleton className="h-3 w-[50%]" />
						<LightSkeleton className="h-3 w-[68%]" />
					</div>
				</li>
			))}
		</ul>
	);
};
