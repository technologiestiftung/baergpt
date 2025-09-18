import Content from "../../../content.ts";

type QuestionMarkIconProps = {
	variant?: "black" | "blue";
};

export function QuestionMarkIcon({ variant = "black" }: QuestionMarkIconProps) {
	return (
		<>
			<img
				src="/icons/question-mark-icon.svg"
				width={16}
				height={16}
				alt={Content["questionMarkIcon.imgAlt"]}
				className={`${variant === "black" ? "block" : "hidden"}`}
			/>

			<img
				src="/icons/question-mark-light-icon.svg"
				width={16}
				height={16}
				alt={Content["questionMarkIcon.imgAlt"]}
				className={`${variant === "blue" ? "block" : "hidden"}`}
			/>
		</>
	);
}
