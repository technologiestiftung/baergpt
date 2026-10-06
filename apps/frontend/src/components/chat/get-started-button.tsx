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
		<button
			type="button"
			onClick={onClick}
			className="flex gap-2 p-1.5 w-full hover:bg-hellblau-30 items-center rounded-3px text-base leading-6 md:text-lg md:leading-7 font-normal text-dunkelblau-80 focus-visible:outline-default"
		>
			<img src={iconSrc} alt="" className="w-5 h-5" />
			{label}
		</button>
	);
};
