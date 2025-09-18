import Content from "../../../content.ts";
import { SecondaryButton } from "../../primitives/buttons/secondary-button.tsx";

type NoFilesUploadZoneProps = {
	onUploadClick: () => void;
};

export function NoFilesUploadZone({ onUploadClick }: NoFilesUploadZoneProps) {
	return (
		<div className="border-dashed p-3 border border-dunkelblau-60 flex flex-col w-full h-full items-center justify-center">
			<div className="flex flex-col h-full justify-center items-center">
				<div className={`font-bold mt-5`}>
					{Content["fileUpload.uploadInstructions.p1"]}
				</div>

				<div className="mt-1.5">
					{Content["fileUpload.uploadInstructions.p2"]}
				</div>

				<SecondaryButton className="mt-2" onClick={onUploadClick}>
					{Content["fileUpload.searchComputerbutton.label"]}{" "}
					<img
						src="/icons/upload-icon.svg"
						width={24}
						height={24}
						alt={Content["fileUpload.uploadButton.imgAlt"]}
					/>
				</SecondaryButton>
			</div>
		</div>
	);
}
