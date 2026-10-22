import type { FormEvent, RefObject } from "react";
import Content from "../../../content.ts";
import { PrimaryButton } from "../../primitives/buttons/primary-button.tsx";
import { TertiaryButton } from "../../primitives/buttons/tertiary-button.tsx";
import { PasswordInput } from "../../primitives/text-inputs/password-input.tsx";
import type { Integration } from "../../../api/integrations/get-integrations.ts";
import { MissingScopesPanel } from "./missing-scopes-panel.tsx";
import { formatMaskedToken } from "../format-masked-token.ts";
import type { DialogError, DialogMode } from "./types.ts";

interface ConnectFormProps {
	mode: DialogMode;
	integration?: Integration;
	token: string;
	onTokenChange: (value: string) => void;
	error: DialogError | null;
	isSubmitting: boolean;
	onCancel: () => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	formRef: RefObject<HTMLFormElement | null>;
}

export function ConnectForm({
	mode,
	integration,
	token,
	onTokenChange,
	error,
	isSubmitting,
	onCancel,
	onSubmit,
	formRef,
}: ConnectFormProps) {
	const errorMessage = getErrorMessage(error);

	return (
		<div className="flex flex-col gap-7">
			<div className="flex flex-col gap-3">
				<div className="flex gap-2 items-center">
					<div className="shrink-0 size-7 rounded-3px bg-white drop-shadow-[0px_0px_2.4px_rgba(36,61,100,0.3)] flex items-center justify-center p-1">
						<img
							src="/icons/datawrapper-icon.svg"
							alt=""
							className="max-w-full max-h-full object-contain"
						/>
					</div>
					<h2 className="text-xl leading-7 font-bold">
						{mode === "replace"
							? Content["connectors.datawrapper.replace.title"]
							: Content["connectors.datawrapper.connect.title"]}
					</h2>
				</div>
				<div className="flex flex-col gap-0.5">
					{mode === "connect" && (
						<p className="text-base leading-6 font-normal text-dunkelblau-65">
							{Content["connectors.datawrapper.connect.body"]}
						</p>
					)}
					<a
						href={Content["connectors.datawrapper.helpLink.href"]}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 text-base leading-6 font-normal text-aktiv-blau-100 underline w-fit"
					>
						{Content["connectors.datawrapper.findTokenLink"]}
						<img
							src="/icons/external-link-icon.svg"
							alt=""
							width={20}
							height={20}
						/>
					</a>
				</div>
			</div>

			<form ref={formRef} className="flex flex-col gap-7" onSubmit={onSubmit}>
				{mode === "replace" && (
					<div className="flex flex-col gap-1.5">
						<span className="text-sm leading-5 font-bold">
							{Content["connectors.datawrapper.currentTokenLabel"]}
						</span>
						<div className="flex items-center h-10 px-3 rounded-3px border border-dunkelblau-50 bg-hellblau-50">
							<span className="text-sm leading-5 font-normal text-dunkelblau-100">
								{formatMaskedToken(integration?.last4)}
							</span>
						</div>
					</div>
				)}

				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="datawrapper-token"
						className="text-sm leading-5 font-bold"
					>
						{mode === "replace"
							? Content["connectors.datawrapper.newTokenLabel"]
							: Content["connectors.datawrapper.tokenLabel"]}
					</label>
					<PasswordInput
						id="datawrapper-token"
						value={token}
						onChange={onTokenChange}
						isInvalid={!!error}
						disabled={isSubmitting}
						autoFocus
						ariaDescribedBy={
							errorMessage ? "datawrapper-token-error" : undefined
						}
					/>
					{errorMessage && (
						<p
							id="datawrapper-token-error"
							className="text-warning-120 text-xs leading-4 font-normal"
							role="alert"
						>
							{errorMessage}
						</p>
					)}
				</div>

				{error?.type === "missing_scopes" && (
					<MissingScopesPanel requiredScopes={error.requiredScopes} />
				)}

				<div className="flex flex-col gap-2">
					<div className="flex gap-1 items-center justify-end">
						<TertiaryButton type="button" onClick={onCancel}>
							{Content["connectors.datawrapper.cancelButton"]}
						</TertiaryButton>
						<PrimaryButton
							type="submit"
							disabled={!token.trim() || isSubmitting}
						>
							{mode === "replace"
								? Content["connectors.datawrapper.replaceSubmitButton"]
								: Content["connectors.datawrapper.connectSubmitButton"]}
						</PrimaryButton>
					</div>
				</div>
			</form>
		</div>
	);
}

function getErrorMessage(error: DialogError | null): string | null {
	switch (error?.type) {
		case "invalid":
			return Content["connectors.datawrapper.error.invalid"];
		case "missing_scopes":
			return Content["connectors.datawrapper.error.missingScopes"];
		case "generic":
			return Content["connectors.datawrapper.error.generic"];
		default:
			return null;
	}
}
