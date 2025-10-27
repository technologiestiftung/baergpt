export const ListItem = ({
	title,
	description,
}: {
	title: string;
	description: string;
}) => (
	<li>
		<span>
			{title && <strong>{title}</strong>} {description}
		</span>
	</li>
);
