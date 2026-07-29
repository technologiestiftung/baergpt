import {
	type FormEvent,
	type RefObject,
	useRef,
	useState,
	useEffect,
} from "react";
import Content from "../../../content.ts";
import { checkEmailAllowed } from "../../../api/auth/check-email-allowed.ts";
import { captureError } from "../../../monitoring/capture-error.ts";

const DEBOUNCE_MS = 1_000;

let abortController: AbortController | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function EmailInput({
	id,
	placeholder,
	className = "",
	defaultValue = "",
	useEmailAllowedCheck,
}: {
	id: string;
	placeholder?: string;
	className?: string;
	defaultValue?: string;
	useEmailAllowedCheck: boolean;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [value, setValue] = useState<string>(defaultValue || "");
	const [showError, setShowError] = useState<boolean>(false);

	useEffect(() => {
		// Clean up on unmount
		return () => {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}
			abortController?.abort();
		};
	}, []);

	const debouncedEmailAllowedCheck = (email: string) => {
		const input = inputRef.current;
		if (!input) {
			return;
		}

		// Clear previous timer and in-flight request
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		abortController?.abort();

		// While debouncing, mark as pending (no custom validity — let native type check pass)
		debounceTimer = setTimeout(async () => {
			abortController = new AbortController();

			const { isAllowed, error } = await checkEmailAllowed(
				email,
				abortController.signal,
			);

			if (abortController.signal.aborted) {
				return;
			}

			if (error) {
				captureError(error);
				return;
			}

			if (!isAllowed) {
				input.setCustomValidity(Content["form.validation.email.customError"]);
			} else {
				input.setCustomValidity("");
			}

			setShowError(!input.validity.valid);
		}, DEBOUNCE_MS);
	};

	const handleInput = (event: FormEvent<HTMLInputElement>) => {
		const newValue = event.currentTarget.value;
		setValue(newValue);

		// Clear any previous custom error while the user is still typing
		event.currentTarget.setCustomValidity("");

		if (useEmailAllowedCheck) {
			debouncedEmailAllowedCheck(newValue);
		}

		if (inputRef.current) {
			setShowError(!inputRef.current.validity.valid);
		}
	};

	const handleInvalid = () => {
		setShowError(true);
	};

	return (
		<>
			<input
				ref={inputRef}
				id={id}
				name={id}
				type="email"
				required
				value={value}
				onInput={handleInput}
				onInvalid={handleInvalid}
				className={`
					peer border border-schwarz-40 rounded-3px p-2.5
					focus-visible:outline-default 
					user-invalid:border-berlin-rot
					focus:text-black
					${className}
				`}
				placeholder={placeholder}
			/>
			{showError && (
				<div
					className="text-berlin-rot mt-1.5 text-sm"
					dangerouslySetInnerHTML={{
						__html: getErrorMessage(inputRef),
					}}
				/>
			)}
		</>
	);
}

function getErrorMessage(ref: RefObject<HTMLInputElement>) {
	const current = ref.current;

	if (!current) {
		return "";
	}

	const validity = current.validity;

	if (!validity) {
		return "";
	}

	if (validity.typeMismatch) {
		return Content["form.validation.email.typeMismatch"];
	}

	if (validity.valueMissing) {
		return Content["form.validation.general.valueMissing"];
	}

	if (validity.customError) {
		return Content["form.validation.email.customError"];
	}

	return "";
}
