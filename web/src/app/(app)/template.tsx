/** Remonta a cada troca de página: aplica uma entrada curta no conteúdo. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
