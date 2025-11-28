import React, { useState } from "react";
import Content from "../../content.ts";
import { CloseIcon } from "../primitives/icons/close-icon.tsx";

export const LandingPageBanner: React.FC = () => {
	const [isClosed, setIsClosed] = useState(false);

	const handleClose = () => {
		setIsClosed(true);
	};

	if (isClosed) {
		return null;
	}

	return (
		<div className="fixed top-[80px] left-0 flex gap-6 justify-between items-center pl-5 py-4 pr-2 lg:py-5 lg:px-12 w-full text-hellblau-30 bg-dunkelblau-100 z-50">
			<div className="lg:max-w-[934px] mx-auto w-full flex flex-col lg:flex-row lg:justify-between gap-4 items-center">
				<div className="flex flex-col gap-1.5 w-full lg:w-fit">
					<h2 className="text-sm leading-5 font-semibold md:text-2xl md:leading-8">
						{Content["landingPage.banner.h2"]}
					</h2>
					<div>
						<p className="hidden md:block text-base leading-5 md:leading-6 font-normal">
							{Content["landingPage.banner.p1"]}
						</p>
						<p className="hidden md:block text-base leading-5 md:leading-6 font-normal">
							{Content["landingPage.banner.p2"]}
						</p>
						<p className="block md:hidden text-base leading-5 md:leading-6 font-normal">
							{Content["landingPage.banner.p.mobile"]}
						</p>
					</div>
				</div>
				<a
					href={Content["landingPage.banner.link.href"]}
					aria-label={Content["landingPage.banner.link.ariaLabel"]}
					className={`
                                flex items-center h-11 text-dunkelblau-100 px-3 py-2
                                text-lg leading-7 font-normal z-10 
                                rounded-3px bg-hellblau-30
                                hover:bg-hellblau-60 focus-visible:outline-default 
                                w-fit self-start lg:self-center`}
					target="_blank"
					rel="noopener noreferrer"
				>
					{Content["landingPage.banner.link.label"]}
				</a>
			</div>
			<button
				className="flex-shrink-0 focus-visible:outline-default rounded-3px self-start lg:self-center"
				onClick={handleClose}
				aria-label={Content["landingPage.banner.close.ariaLabel"]}
			>
				<CloseIcon variant="white" />
			</button>
		</div>
	);
};
