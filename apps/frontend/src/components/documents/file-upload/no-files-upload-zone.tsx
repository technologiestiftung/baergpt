import Content from "../../../content.ts";
import { SecondaryButton } from "../../primitives/buttons/secondary-button.tsx";
import { useFileUploadsStore } from "../../../store/use-file-uploads-store.ts";
import { UploadIcon } from "../../icons/upload-icon.tsx";

type NoFilesUploadZoneProps = {
	onUploadClick: () => void;
};

export function NoFilesUploadZone({ onUploadClick }: NoFilesUploadZoneProps) {
	const { isLessThanMaxUploadsAmountActive } = useFileUploadsStore();
	return (
		<div className="border-dashed p-3 border border-dunkelblau-60 flex flex-col w-full h-full items-center justify-center">
			<div className="flex flex-col h-full justify-center items-center">
				<div className={`font-bold mt-5`}>
					{Content["fileUpload.uploadInstructions.p1"]}
				</div>

				<div className="mt-1.5">
					{Content["fileUpload.uploadInstructions.p2"]}
				</div>

				<SecondaryButton
					className="mt-2"
					onClick={onUploadClick}
					disabled={!isLessThanMaxUploadsAmountActive()}
				>
					{Content["fileUpload.searchComputerbutton.label"]}{" "}
					<UploadIcon
						className={`size-6  ${isLessThanMaxUploadsAmountActive() ? "text-dunkelblau-100" : "text-dunkelblau-40"}`}
					/>
				</SecondaryButton>
			</div>
		</div>
	);
}
