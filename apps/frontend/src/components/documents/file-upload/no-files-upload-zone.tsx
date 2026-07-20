import Content from "../../../content.ts";
import { SecondaryButton } from "../../primitives/buttons/secondary-button.tsx";
import { useFileUploadsStore } from "../../../store/use-file-uploads-store.ts";

type NoFilesUploadZoneProps = {
	onUploadClick: () => void;
};

export function NoFilesUploadZone({ onUploadClick }: NoFilesUploadZoneProps) {
	const hasAvailableUploadSlots = useFileUploadsStore((state) =>
		state.hasAvailableUploadSlots(),
	);

	return (
		<div className="flex flex-col w-full h-full items-center justify-center gap-y-8">
			<div className="flex flex-col gap-2 h-full justify-center items-center">
				<img
					src="/icons/folder-stack-icon.svg"
					width={94}
					className="mb-6"
					alt={Content["fileUpload.uploadButton.imgAlt"]}
				/>
				<div
					className={`text-base leading-6 font-semibold text-dunkelblau-100 ${!hasAvailableUploadSlots && "text-dunkelblau-40"}`}
				>
					{Content["fileUpload.uploadInstructions.p1"]}
				</div>

				<SecondaryButton
					onClick={onUploadClick}
					disabled={!hasAvailableUploadSlots}
				>
					{Content["fileUpload.searchComputerbutton.label"]}{" "}
				</SecondaryButton>
			</div>
		</div>
	);
}
