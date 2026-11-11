import {
	isValidElement,
	useRef,
	type ComponentProps,
	type ReactNode,
} from "react";
import type { ExtraProps } from "react-markdown";
import { getLanguageLabel } from "./code-block-utils.ts";
import { CopyCodeButton } from "./copy-code-button.tsx";

export type CodeBlockProps = ComponentProps<"pre"> & ExtraProps;

function getCodeClassName(children: ReactNode): string | undefined {
	const codeElement = Array.isArray(children) ? children[0] : children;
	return isValidElement<{ className?: string }>(codeElement)
		? codeElement.props.className
		: undefined;
}

export function CodeBlock({ node: _node, children, ...props }: CodeBlockProps) {
	const preRef = useRef<HTMLPreElement>(null);
	const language = getLanguageLabel(getCodeClassName(children));

	return (
		<div className="code-block">
			<div className="code-block-header">
				{language && <span className="code-block-language">{language}</span>}
				<CopyCodeButton getCode={() => preRef.current?.textContent ?? ""} />
			</div>
			<pre {...props} ref={preRef} className="code-block-pre">
				{children}
			</pre>
		</div>
	);
}
