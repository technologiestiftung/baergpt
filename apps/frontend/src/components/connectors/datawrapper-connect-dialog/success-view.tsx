import Content from "../../../content.ts";
import { PrimaryButton } from "../../primitives/buttons/primary-button.tsx";
import type { DialogMode } from "./types.ts";

interface SuccessViewProps {
	mode: DialogMode;
	onContinue: () => void;
}

export function SuccessView({ mode, onContinue }: SuccessViewProps) {
	return (
		<div className="flex flex-col items-center gap-[27px]">
			<div className="flex flex-col items-center gap-[22px] w-full">
				<div className="flex flex-row gap-[9px]">
					<div
						className={`size-10 shrink-0 rounded-[5px] bg-white drop-shadow-[0px_0px_1.5px_rgba(36,61,100,0.25)] items-center justify-center
						${mode === "replace" ? "hidden" : "flex"}`}
					>
						<img
							src="/icons/baer_icon_dark_blue.svg"
							alt=""
							className="max-w-full max-h-full object-contain"
						/>
					</div>
					<img
						className={mode === "replace" ? "hidden" : "flex"}
						src="/icons/green_check_animation.svg"
						alt=""
					/>
					<div className="shrink-0 size-10 rounded-[5px] bg-white drop-shadow-[0px_0px_1.5px_rgba(36,61,100,0.25)] flex items-center justify-center">
						<img
							src="/icons/datawrapper-icon.svg"
							alt=""
							className="max-w-full w-[26px] max-h-full object-contain"
						/>
					</div>
				</div>
				<div className="flex flex-col gap-1 items-center text-center">
					<h2 className="text-2xl leading-8 font-semibold max-w-[440px]">
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
			</div>
			<PrimaryButton type="button" onClick={onContinue}>
				{Content["connectors.datawrapper.successContinueButton"]}
			</PrimaryButton>
		</div>
	);
}
