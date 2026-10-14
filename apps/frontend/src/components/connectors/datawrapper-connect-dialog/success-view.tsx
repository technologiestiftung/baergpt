import Content from "../../../content.ts";
import { PrimaryButton } from "../../primitives/buttons/primary-button.tsx";
import type { DialogMode } from "./types.ts";

export function SuccessView({
	mode,
	onContinue,
}: {
	mode: DialogMode;
	onContinue: () => void;
}) {
	return (
		<div className="flex flex-col items-center gap-[22px] pt-1 pb-1">
			<img src="/icons/green-check-icon.svg" alt="" width={40} height={40} />
			<div className="flex flex-col gap-1 items-center text-center">
				<h2 className="text-2xl leading-8 font-semibold">
					{mode === "replace"
						? Content["connectors.datawrapper.replaceSuccess.title"]
						: Content["connectors.datawrapper.connectSuccess.title"]}
				</h2>
				<p className="text-base leading-6 font-normal text-dunkelblau-65">
					{mode === "replace"
						? Content["connectors.datawrapper.replaceSuccess.body"]
						: Content["connectors.datawrapper.connectSuccess.body"]}
				</p>
			</div>
			<PrimaryButton type="button" onClick={onContinue}>
				{Content["connectors.datawrapper.successContinueButton"]}
			</PrimaryButton>
		</div>
	);
}
