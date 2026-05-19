import { getBoardData } from "@/lib/data";
import BoardClient from "@/components/BoardClient";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const board = await getBoardData();

  if (!board) {
    return (
      <main className="main">
        <div className="page-header">
          <h1>Quadro Kanban</h1>
          <p>Nenhum board encontrado. Rode `npm run db:seed` para criar dados iniciais.</p>
        </div>
      </main>
    );
  }

  return <BoardClient board={board} />;
}
