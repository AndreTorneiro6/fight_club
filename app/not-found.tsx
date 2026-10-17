import Link from "next/link";
export default function NotFound() {
  return (
    <main className="center-screen">
      <div className="panel">
        <p className="eyebrow">404 · FORA DO CAMPO</p>
        <h1>Página não encontrada</h1>
        <Link className="button primary" href="/inicio">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
