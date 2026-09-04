interface GetStartedButtonProps {
	iconSrc: string;
	label: string;
	onClick: () => void;
}

export const GetStartedButton = ({
	iconSrc,
	label,
	onClick,
}: GetStartedButtonProps) => {
	return (
		<div className="flex gap-1 p-1.5 hover:bg-hellblau-30 items-center justify-between rounded-3px">
			<button
				onClick={onClick}
				className="flex gap-2 items-center justify-center text-base leading-6 md:text-lg md:leading-7 font-normal text-dunkelblau-80 focus-visible:outline-default"
			>
				<img src={iconSrc} className="w-5 h-5" />
				{label}
			</button>
		</div>
	);
};
