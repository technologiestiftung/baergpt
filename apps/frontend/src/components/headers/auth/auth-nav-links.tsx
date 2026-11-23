import Content from "../../../content.ts";

export function AuthNavLinks() {
	return (
		<div className="hidden md:flex flex-row gap-4">
			<a
				href={Content["header.navigation.help.link"]}
				aria-label={Content["header.navigation.help.ariaLabel"]}
				className={`
							flex items-center gap-1.5 h-11 text-white px-3 py-2
							rounded-3px bg-dunkelblau-100 border border-dunkelblau-100
							hover:bg-dunkelblau-90 focus-visible:outline-default
							text-lg leading-7 font-normal
							`}
			>
				{Content["header.navigation.help.label"]}
				<img
					src="/icons/arrow-top-right-light-icon.svg"
					alt=""
					className="size-5"
					width={20}
					height={20}
				/>
			</a>
		</div>
	);
}
