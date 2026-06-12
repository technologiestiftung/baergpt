import type { AnchorHTMLAttributes } from "react";

export function AnchorLinkTargetBlank(
	props: AnchorHTMLAttributes<HTMLAnchorElement>,
) {
	return <a {...props} target="_blank" rel="noopener noreferrer" />;
}
