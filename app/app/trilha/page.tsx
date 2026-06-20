export default function TrilhaPage() {
  return (
    <main className="container">
      <div className="brand">Bússola IRTF</div>
      <h1>Trilha de entrada</h1>
      <p className="sub">
        Percurso guiado para quem está chegando ao IRTF: do tema ao primeiro contato.
      </p>

      <article className="card">
        <p className="rationale">
          Esta tela é o esqueleto do onboarding (milestone M4). O checklist abaixo será
          ligado ao <code>/api/reading-pack</code> e ao <code>/api/draft-message</code>.
        </p>
        <ul>
          <li>1. Descreva seu tema → ranking de grupos (já disponível na página inicial).</li>
          <li>2. Para onde levar → grupo recomendado com evidência.</li>
          <li>
            3. Pacote de leitura → charter + RFCs-chave + drafts ativos + a{" "}
            <a href="https://www.rfc-editor.org/rfc/rfc7418">RFC 7418</a> (primer do IRTF).
          </li>
          <li>4. Quem procurar → chairs e autores.</li>
          <li>5. Rascunho da 1ª mensagem (tom IETF).</li>
        </ul>
      </article>
    </main>
  );
}
