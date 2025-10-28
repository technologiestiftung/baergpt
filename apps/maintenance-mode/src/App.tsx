function App() {
	return (
		<main className="w-full h-svh bg-dunkelblau-100 text-hellblau-30 text-center flex items-center justify-center p-5">
			<div className="flex flex-col justify-center items-center sm:max-w-[546px] mx-auto">
				<img
					src="/logos/logo_baergpt.svg"
					alt="BärGPT Logo"
					width={100}
					height={32}
				/>
				<h1 className="mt-6 mb-3 text-2xl leading-8 font-normal w-fit mx-auto">
					BärGPT ist vorübergehend nicht erreichbar.
				</h1>
				<p>
					Wir führen gerade Wartungsarbeiten durch oder das System ist
					überlastet. Bitte probieren Sie es in ein paar Minuten erneut.
				</p>
				<p className="mb-8">
					Auf der{" "}
					<a className="underline" href="https://hilfe.baergpt.berlin/">
						BärGPT-Hilfeseite
					</a>{" "}
					finden Sie mögliche Ursachen.
				</p>
				<button
					className="text-lg leading-7 font-normal border border-hellblau-30 rounded-sm px-3 py-2 hover:bg-dunkelblau-80"
					onClick={() => window.location.reload()}
				>
					Erneut laden
				</button>
			</div>
		</main>
	);
}

export default App;
