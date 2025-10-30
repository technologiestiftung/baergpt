import { ArrowTopRight } from "../../primitives/icons/arrow-top-right.tsx";
import Content from "../../../content.ts";

export function AuthNavLinks() {
	return (
		<div className="flex flex-row gap-4">
			<a
				href="https://hilfe.baergpt.berlin"
				className={`
				hidden md:flex gap-x-2 h-11 text-dunkelblau-100 px-3 py-2
				rounded-3px border border-dunkelblau-100
				hover:bg-hellblau-60 items-center
				focus-visible:outline-default text-lg leading-7 font-normal
				`}
			>
				{Content["header.navigation.help.ariaLabel"]}
				<ArrowTopRight />
			</a>
		</div>
	);
}
