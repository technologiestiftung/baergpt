function App() {
	return (
		<main className="w-full h-svh bg-dunkelblau-100 text-hellblau-30 text-center flex items-center justify-center p-5">
			<div className="flex flex-col justify-center items-center sm:max-w-[546px] mx-auto">
				<img
					src="/logos/logo_baergpt.svg"
					alt="BärGPT Logo"
					className="bg-white w-auto h-8"
				/>
				<h1 className="mt-6 mb-3 text-2xl leading-8 font-normal w-fit mx-auto">
					Oh nein, BärGPT ist gerade nicht verfügbar
				</h1>
				<p>
					Wir arbeiten an Verbesserungen oder das System ist vorübergehend
					ausgelastet. Bitte versuchen Sie es in ein paar Minuten erneut.
				</p>
				<p className="mb-8">
					Mehr Infos finden Sie auf der{" "}
					<a className="underline" href="https://hilfe.baergpt.berlin/">
						BärGPT-Hilfeseite
					</a>
				</p>
				<button
					className="text-lg leading-7 font-normal border border-hellblau-30 rounded-sm px-3 py-2 hover:bg-dunkelblau-80"
					onClick={() => window.location.reload()}
				>
					Neu laden
				</button>
			</div>
		</main>
	);
}

export default App;
