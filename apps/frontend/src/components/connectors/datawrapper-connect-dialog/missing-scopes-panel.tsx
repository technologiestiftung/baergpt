import Content from "../../../content.ts";

export function MissingScopesPanel({
	requiredScopes,
}: {
	requiredScopes: string[];
}) {
	return (
		<div className="flex flex-col gap-2 bg-warning-10 p-2">
			<span className="text-sm leading-5 font-bold">
				{Content["connectors.datawrapper.missingScopesPanel.title"]}
			</span>
			<p className="text-sm leading-5 font-normal">
				{Content["connectors.datawrapper.missingScopesPanel.body"]}
			</p>
			<div className="flex flex-col gap-1.5">
				<p className="text-sm leading-5 font-normal">
					{Content["connectors.datawrapper.missingScopesPanel.instruction"]}
				</p>
				<ul className="list-disc ms-[21px] text-sm leading-5 font-bold">
					{requiredScopes.map((scope) => (
						<li key={scope}>{formatScopeLabel(scope)}</li>
					))}
				</ul>
				<a
					href={Content["connectors.datawrapper.helpLink.href"]}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1 text-sm leading-5 font-normal text-aktiv-blau-100 underline w-fit"
				>
					{Content["connectors.datawrapper.missingScopesPanel.link"]}
					<img
						src="/icons/external-link-icon.svg"
						alt=""
						width={16}
						height={16}
					/>
				</a>
			</div>
		</div>
	);
}

function formatScopeLabel(scope: string): string {
	const [resource, action] = scope.split(":");
	if (!resource || !action) {
		return scope;
	}
	return `${resource.charAt(0).toUpperCase()}${resource.slice(1)}: ${action}`;
}
