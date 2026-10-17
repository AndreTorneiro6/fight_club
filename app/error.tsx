"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="center-screen">
      <div className="panel">
        <h1>Algo correu mal</h1>
        <p>Tenta carregar novamente a página.</p>
        <button className="primary" onClick={reset}>
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
