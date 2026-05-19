import { getBoardData, listBoardsLite } from "@/lib/data";
import BoardClient from "@/components/BoardClient";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const { b } = await searchParams;
  const boards = await listBoardsLite();
  const board = await getBoardData(b);

  if (!board) {
    return (
      <main className="main">
        <div className="page-header">
          <h1>Quadro Kanban</h1>
          <p>Nenhum projeto encontrado. Rode `npm run db:seed` ou crie um projeto.</p>
        </div>
      </main>
    );
  }

  return <BoardClient board={board} boards={boards} />;
}
