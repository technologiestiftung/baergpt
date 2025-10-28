import React, { useCallback } from "react";

export const useSmoothScroll = () => {
	return useCallback(
		(event: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
			event.preventDefault();
			const element = document.getElementById(sectionId);
			if (element) {
				element.scrollIntoView({
					behavior: "smooth",
					block: "start",
				});
				window.history.pushState(null, "", `#${sectionId}`);
			}
		},
		[],
	);
};
