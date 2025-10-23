import React from "react";

export const Section = ({
	id,
	number,
	title,
	children,
}: {
	id: string;
	number: number;
	title: string;
	children: React.ReactNode;
}) => (
	<li id={id} className="flex flex-col gap-5 lg:gap-6">
		<h2 className="flex gap-2 text-3xl leading-9 lg:text-4xl lg:leading-10 font-semibold">
			<span>{number}.</span>
			<span>{title}</span>
		</h2>
		{children}
	</li>
);
