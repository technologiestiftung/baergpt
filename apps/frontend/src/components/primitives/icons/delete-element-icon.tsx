import Content from "../../../content";

export function DeleteElementIcon() {
	return (
		<>
			<img
				src="/icons/bucket-red-icon.svg"
				alt={Content["documentsList.delete.imgAlt"]}
				className="size-5 group-hover/delete:hidden"
				width={20}
				height={20}
			/>
			<img
				src="/icons/bucket-blue-icon.svg"
				alt={Content["documentsList.delete.imgAlt"]}
				className="size-5 hidden group-hover/delete:block"
				width={20}
				height={20}
			/>
		</>
	);
}
