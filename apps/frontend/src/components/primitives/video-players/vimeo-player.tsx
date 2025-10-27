import React, { useEffect } from "react";
import { useCookieBannerStore } from "../../../store/use-cookie-banner-store.ts";
import { Content } from "../../../content.ts";
import { AccentButton } from "../buttons/accent-button.tsx";

interface VimeoPlayerProps {
	title: string;
	srcUrl: string;
}

export const VimeoPlayer: React.FC<VimeoPlayerProps> = ({ title, srcUrl }) => {
	const { hasConsent, checkConsent, acceptConsent } = useCookieBannerStore();

	useEffect(() => {
		checkConsent();
	}, [checkConsent]);

	if (hasConsent === null) {
		return (
			<div className="flex flex-col items-center justify-center bg-hellblau-30 w-full aspect-video p-5 text-center rounded-3px">
				{Content["videoPlayer.loading.message"]}
			</div>
		);
	}

	if (!hasConsent) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 bg-hellblau-30 w-full aspect-video p-5 text-center rounded-3px">
				<img
					src="/icons/eye-struck-through-blue-icon.svg"
					alt=""
					className="size-14"
				/>

				<h3 className="text-lg font-semibold">
					{Content["videoPlayer.blocked.message"]}
				</h3>
				<p className="text-schwarz-40 max-w-xl">
					{Content["videoPlayer.vimeo.cookies.message"]}
				</p>
				<AccentButton
					onClick={() => {
						acceptConsent();
						window.location.reload();
					}}
					ariaLabel={Content["videoPlayer.cookies.buttonLabel"]}
				>
					{Content["videoPlayer.cookies.buttonLabel"]}
				</AccentButton>
			</div>
		);
	}

	return (
		<iframe
			className="w-full aspect-video rounded-[3px]"
			src={srcUrl}
			allowFullScreen
			title={title}
			referrerPolicy="strict-origin-when-cross-origin"
		/>
	);
};
