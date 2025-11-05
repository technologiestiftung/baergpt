import Content from "../../content.ts";

interface ContactInfoData {
	heading: string;
	name?: string;
	organisation?: string;
	role?: string;
	address?: {
		street?: string;
		city?: string;
	};
	phone?: string;
	email?: string;
	website?: string;
}

export const ContactInfo = ({ data }: { data: ContactInfoData }) => (
	<div className="flex flex-col pb-3">
		<span className="font-semibold">{data.heading}</span>
		<span>
			{data.organisation && (
				<>
					{data.organisation}
					<br />
				</>
			)}
			{data.role && (
				<>
					{data.role}
					<br />
				</>
			)}
			{data.name && (
				<>
					{data.name}
					<br />
				</>
			)}
			{data.address?.street && (
				<>
					{data.address.street}
					<br />
				</>
			)}
			{data.address?.city && data.address.city}
		</span>
		{data.phone && (
			<span>
				{Content["privacyPolicyPage.section2.phone.label"]} {data.phone}
			</span>
		)}
		{data.email && (
			<span>
				{Content["privacyPolicyPage.section2.email.label"]} {data.email}
			</span>
		)}
		{data.website && (
			<span>
				{Content["privacyPolicyPage.section2.website.label"]}{" "}
				<a
					href={data.website}
					target="_blank"
					rel="noopener noreferrer"
					className="hover:underline underline-offset-4"
				>
					{data.website}
				</a>
			</span>
		)}
	</div>
);
