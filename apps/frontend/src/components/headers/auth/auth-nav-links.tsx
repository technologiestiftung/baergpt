import Content from "../../../content.ts";
import { PrimaryButton } from "../../primitives/buttons/primary-button.tsx";

export function AuthNavLinks() {
	return (
		<div className="hidden md:flex flex-row gap-4">
			<PrimaryButton href="https://hilfe.baergpt.berlin" hasIcon="right">
				{Content["header.navigation.help.ariaLabel"]}
				<img
					src="/icons/arrow-top-right-light-icon.svg"
					alt=""
					className="size-5"
					width={20}
					height={20}
				/>
			</PrimaryButton>
		</div>
	);
}
